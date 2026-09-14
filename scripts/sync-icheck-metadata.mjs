#!/usr/bin/env node
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  HISTORY_ITEMS,
  parseCheckAutoPdf,
  classifyCertificateStatus,
} from "./lib/parse-checkauto-pdf.mjs";
import { parseCheckAutoDossier } from "./lib/parse-checkauto-xml.mjs";
import { summarizeDossier } from "./lib/icheck-dossier-summary.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_ORIGIN = "https://www.netcarmultimarcas.com.br";
export const PARSER_VERSION = "checkauto-certificate-v3";
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
export const cleanPlate = (value) =>
  String(value || "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
const emptyHistory = () =>
  HISTORY_ITEMS.map(({ key, label }) => ({
    key,
    label,
    ...classifyCertificateStatus(null),
  }));

/** Accept only a PDF in the public certificate directory, without traversal or credentials. */
export function resolveCertificateReference(vehicle, origin = SITE_ORIGIN) {
  const raw =
    vehicle.pdf_url ||
    (vehicle.pdf ? `/arquivos/autocheck/${vehicle.pdf}` : "");
  if (!raw) return null;
  const url = new URL(raw, `${origin}/`);
  const trusted = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.origin !== trusted.origin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /%|\\/.test(url.pathname)
  )
    throw new Error("invalid_reference");
  if (
    !/^\/arquivos\/autocheck\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.pdf$/i.test(
      url.pathname,
    )
  )
    throw new Error("invalid_reference");
  const name = basename(url.pathname);
  if (name.includes("..") || (vehicle.pdf && vehicle.pdf !== name))
    throw new Error("invalid_reference");
  return {
    url: url.href,
    name,
    metaName: name.replace(/\.pdf$/i, ".meta.json"),
  };
}

export function certificateMatchesVehicle(parsed, vehicle) {
  const supplied = cleanPlate(vehicle.placa);
  const certificate = cleanPlate(parsed.placa);
  if (
    !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(supplied) ||
    certificate.length !== 7
  )
    return false;
  if (
    !certificate
      .split("")
      .every(
        (char, index) =>
          ((index === 3 || index === 4) && char === "X") ||
          char === supplied[index],
      )
  )
    return false;
  // Check the known chassis prefix too when the inventory provides one. Masked tails are not full VIN validation.
  if (vehicle.chassi && parsed.chassi) {
    const expected = String(vehicle.chassi)
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
    const actual = String(parsed.chassi).toUpperCase();
    if (
      !actual
        .split("")
        .every(
          (char, index) =>
            char === "X" || char === "*" || char === expected[index],
        )
    )
      return false;
  }
  return true;
}

export function dossierMatchesCertificate(dossier, parsed, vehicle) {
  return Boolean(
    dossier?.ok &&
    parsed?.ok &&
    parsed.dataHoraConsulta &&
    dossier.protocol?.dataHoraConsulta === parsed.dataHoraConsulta &&
    certificateMatchesVehicle(
      {
        placa: dossier.vehicleHint?.placa,
        chassi: dossier.vehicleHint?.chassiMasked,
      },
      vehicle,
    ),
  );
}

export function dossierSectionsForDisplay(sections = []) {
  return sections.map((section) => ({
    title: String(section.title || section.key || "Consulta").replace(
      /^\d+\.\s*/,
      "",
    ),
    items: [
      { label: "Resultado", value: section.riskLabel || "Indisponível" },
      ...(section.retorno
        ? [{ label: "Retorno da base", value: section.retorno }]
        : []),
      ...(section.fields || []),
      ...(section.records || []).flatMap((record, index) =>
        record.map((entry) => ({
          label: `${index + 1}. ${entry.label}`,
          value: entry.value,
        })),
      ),
    ].filter((item) => item.value && item.value !== "—"),
  }));
}

export function buildCertificateMetadata(
  vehicle,
  reference,
  buffer,
  parsed,
  dossier = null,
) {
  if (!parsed.ok) throw new Error("parse_failed");
  if (!certificateMatchesVehicle(parsed, vehicle))
    throw new Error("identity_mismatch");
  if (!parsed.dataHoraConsulta) throw new Error("missing_consultation_date");
  const trusted = dossierMatchesCertificate(dossier, parsed, vehicle);
  const summary = trusted
    ? summarizeDossier(dossier.sections)
    : { highlights: [] };
  return {
    schemaVersion: 2,
    parserVersion: PARSER_VERSION,
    vehicleId: String(vehicle.id),
    placa: cleanPlate(vehicle.placa),
    pdf: reference.name,
    source: "checkauto-pdf",
    sourceSha256: hash(buffer),
    sourceUrl: reference.url,
    dataHoraConsulta: parsed.dataHoraConsulta,
    issuedAt: parsed.issuedAt,
    consultaId:
      parsed.consultaId ||
      (trusted ? dossier.protocol.consultaId : null) ||
      null,
    tipoChave: parsed.tipoChave || null,
    identity: {
      verified: true,
      method: parsed.placa?.includes("X") ? "masked-compatible" : "plate-exact",
      placaMasked: parsed.placa,
      chassiMasked: parsed.chassi,
    },
    history: parsed.history,
    consultationNotes: parsed.consultationNotes || [],
    available: parsed.available,
    allClear: parsed.allClear && (!trusted || dossier.allClear),
    consultationHighlights: [
      ...parsed.history
        .filter((item) => item.status)
        .map((item) => ({ label: item.label, value: item.status })),
      ...summary.highlights,
    ],
    sections: trusted ? dossier.sections : [],
    consultationSections: trusted
      ? dossierSectionsForDisplay(dossier.sections)
      : [],
    updatedAt: new Date().toISOString(),
  };
}

function unavailableMetadata(
  vehicle,
  reference,
  errorCode,
  sourceSha256 = null,
) {
  return {
    schemaVersion: 2,
    parserVersion: PARSER_VERSION,
    vehicleId: String(vehicle.id),
    placa: cleanPlate(vehicle.placa),
    pdf: reference.name,
    source: "unavailable",
    sourceSha256,
    sourceUrl: reference.url,
    errorCode,
    dataHoraConsulta: null,
    issuedAt: null,
    consultaId: null,
    tipoChave: null,
    identity: {
      verified: false,
      method: null,
      placaMasked: null,
      chassiMasked: null,
    },
    history: emptyHistory(),
    consultationNotes: [],
    available: false,
    allClear: false,
    consultationHighlights: [],
    sections: [],
    consultationSections: [],
    updatedAt: new Date().toISOString(),
  };
}

function retryableDownloadError(error) {
  if (error.retryable === true) return true;
  if (["TimeoutError", "AbortError"].includes(error.name)) return true;
  const code = error.cause?.code || error.code;
  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "EPIPE",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
  ].includes(code);
}

async function fetchPdfAttempt(reference, fetchImpl) {
  const response = await fetchImpl(reference.url, {
    redirect: "error",
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw Object.assign(new Error(`http_${response.status}`), {
      retryable:
        response.status === 408 ||
        response.status === 429 ||
        (response.status >= 500 && response.status <= 599),
    });
  }
  if (Number(response.headers.get("content-length")) > 15 * 1024 * 1024) {
    await response.body?.cancel().catch(() => {});
    throw new Error("pdf_too_large");
  }
  const reader = response.body?.getReader();
  let buffer;
  if (reader) {
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 15 * 1024 * 1024) {
        await reader.cancel().catch(() => {});
        throw new Error("pdf_too_large");
      }
      chunks.push(Buffer.from(value));
    }
    buffer = Buffer.concat(chunks);
  } else buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 15 * 1024 * 1024) throw new Error("pdf_too_large");
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new Error("invalid_pdf");
  return buffer;
}

async function fetchPdf(reference, fetchImpl) {
  // Fetch/stream failures can be transient on a reused socket. Only retry transport
  // errors and temporary HTTP responses; invalid certificates remain unavailable.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetchPdfAttempt(reference, fetchImpl);
    } catch (error) {
      if (attempt === 2 || !retryableDownloadError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
}

export async function fetchInventory({
  api = `${SITE_ORIGIN}/api/v1/veiculos.php`,
  fetchImpl = fetch,
} = {}) {
  const seen = new Map();
  for (let page = 1; page <= 100; page++) {
    const url = new URL(api);
    url.searchParams.set("limit", "500");
    url.searchParams.set("page", String(page));
    url.searchParams.set("offset", String((page - 1) * 500));
    const response = await fetchImpl(url.href, {
      signal: AbortSignal.timeout(45000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`inventory_http_${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.data;
    if (payload.success === false || !Array.isArray(rows))
      throw new Error("invalid_inventory");
    const before = seen.size;
    for (const row of rows) {
      if (row.id == null) throw new Error("invalid_vehicle_id");
      seen.set(String(row.id), row);
    }
    const total = Number(
      payload.total_results ?? payload.total ?? payload.pagination?.total,
    );
    if (Number.isFinite(total) && total >= 0 && seen.size >= total)
      return [...seen.values()];
    if (!rows.length && Number.isFinite(total) && seen.size < total)
      throw new Error("inventory_incomplete");
    if (!rows.length || (!Number.isFinite(total) && rows.length < 500))
      return [...seen.values()];
    if (seen.size === before) throw new Error("inventory_pagination_stalled");
  }
  throw new Error("inventory_pagination_limit");
}

export async function syncMetadata({
  inventory,
  sourceDir,
  outputDir = join(ROOT, "public", "arquivos", "autocheck"),
  xmlDir,
  fetchImpl = fetch,
} = {}) {
  const vehicles = inventory || (await fetchInventory({ fetchImpl }));
  mkdirSync(outputDir, { recursive: true });
  const summary = {
    total: vehicles.length,
    generated: 0,
    reused: 0,
    unavailable: 0,
    noPdf: 0,
    rejected: 0,
    failures: [],
  };
  for (const vehicle of vehicles) {
    let reference;
    try {
      reference = resolveCertificateReference(vehicle);
    } catch {
      summary.rejected++;
      summary.failures.push({
        vehicleId: String(vehicle.id),
        reason: "invalid_reference",
      });
      continue;
    }
    if (!reference) {
      summary.noPdf++;
      continue;
    }
    const target = join(outputDir, reference.metaName);
    let metadata;
    let checksum = null;
    try {
      const buffer = sourceDir
        ? readFileSync(join(sourceDir, reference.name))
        : await fetchPdf(reference, fetchImpl);
      if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-")
        throw new Error("invalid_pdf");
      checksum = hash(buffer);
      let previous = null;
      if (existsSync(target)) {
        try {
          previous = JSON.parse(readFileSync(target, "utf8"));
        } catch {
          /* rebuild corrupt metadata */
        }
      }
      if (
        !xmlDir &&
        previous?.schemaVersion === 2 &&
        previous.parserVersion === PARSER_VERSION &&
        previous.source === "checkauto-pdf" &&
        previous.identity?.verified &&
        previous.sourceSha256 === checksum &&
        previous.vehicleId === String(vehicle.id) &&
        previous.placa === cleanPlate(vehicle.placa) &&
        previous.pdf === reference.name &&
        certificateMatchesVehicle(
          {
            placa: previous.identity.placaMasked,
            chassi: previous.identity.chassiMasked,
          },
          vehicle,
        )
      ) {
        summary.reused++;
        continue;
      }
      const parsed = await parseCheckAutoPdf(buffer);
      const xmlPath = xmlDir
        ? join(xmlDir, `${cleanPlate(vehicle.placa)}.xml`)
        : null;
      const dossier =
        xmlPath && existsSync(xmlPath) ? parseCheckAutoDossier(xmlPath) : null;
      metadata = buildCertificateMetadata(
        vehicle,
        reference,
        buffer,
        parsed,
        dossier,
      );
      summary.generated++;
    } catch (error) {
      const reason =
        /^(?:invalid_pdf|parse_failed|identity_mismatch|missing_consultation_date|pdf_too_large|http_\d+)$/.test(
          error?.message,
        )
          ? error.message
          : "source_unavailable";
      metadata = unavailableMetadata(vehicle, reference, reason, checksum);
      summary.unavailable++;
      summary.failures.push({ vehicleId: String(vehicle.id), reason });
    }
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(metadata, null, 2)}\n`);
    renameSync(temporary, target);
  }
  return summary;
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const split = arg.indexOf("=");
      return split < 0
        ? [arg.replace(/^--/, ""), true]
        : [arg.slice(2, split), arg.slice(split + 1)];
    }),
  );
  if (args.help) {
    console.log(
      "node scripts/sync-icheck-metadata.mjs [--inventory=JSON] [--source-dir=PDF_DIRECTORY] [--output-dir=DIRECTORY] [--xml-dir=XML_DIRECTORY]",
    );
    return;
  }
  for (const key of Object.keys(args))
    if (!["inventory", "source-dir", "output-dir", "xml-dir"].includes(key))
      throw new Error(`Unknown option: ${key}`);
  const payload = args.inventory
    ? JSON.parse(readFileSync(args.inventory, "utf8"))
    : null;
  const inventory = payload
    ? Array.isArray(payload)
      ? payload
      : payload.data
    : undefined;
  if (payload && !Array.isArray(inventory))
    throw new Error("invalid_inventory");
  console.log(
    JSON.stringify(
      await syncMetadata({
        inventory,
        sourceDir: args["source-dir"],
        outputDir: args["output-dir"],
        xmlDir: args["xml-dir"],
      }),
      null,
      2,
    ),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(`i-CHECK synchronization failed: ${error.message}`);
    process.exitCode = 1;
  });
