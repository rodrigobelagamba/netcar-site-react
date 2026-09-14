#!/usr/bin/env node
/**
 * Gera PDF i-CHECK moderno (fotos + ficha + histórico CheckAuto).
 *
 * Uso:
 *   npm run report:icheck -- --id=19888
 *   npm run report:icheck -- --placa=JDB4D51
 *   npm run report:icheck -- --id=19888 --deploy
 *   npm run report:icheck -- --placa=JDB4D51 --xml=/path/placa.xml
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import {
  parseCheckAutoPdf,
  classifyCertificateStatus,
} from "./lib/parse-checkauto-pdf.mjs";
import { parseCheckAutoDossier } from "./lib/parse-checkauto-xml.mjs";
import { summarizeDossier } from "./lib/icheck-dossier-summary.mjs";
import {
  resolveCertificateReference,
  certificateMatchesVehicle,
  dossierMatchesCertificate,
  dossierSectionsForDisplay,
  buildCertificateMetadata,
} from "./sync-icheck-metadata.mjs";
import { loadDeployEnv, uploadIcheckPdf } from "./lib/upload-icheck-pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Carrega .env.local se existir (sem dependência dotenv)
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(rootDir, ".env.local"));
loadEnvFile(join(rootDir, ".env"));

const API_BASE =
  process.env.VITE_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "https://www.netcarmultimarcas.com.br/api/v1";

const SITE_ORIGIN =
  process.env.SITE_ORIGIN || "https://www.netcarmultimarcas.com.br";

function parseArgs(argv) {
  const out = {
    id: null,
    placa: null,
    xml: null,
    pdf: null,
    deploy: false,
    help: false,
  };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--deploy") out.deploy = true;
    else if (arg.startsWith("--id=")) out.id = arg.slice(5).trim();
    else if (arg.startsWith("--placa=")) out.placa = arg.slice(8).trim();
    else if (arg.startsWith("--xml="))
      out.xml = arg.slice("--xml=".length).trim();
    else if (arg.startsWith("--pdf="))
      out.pdf = arg.slice("--pdf=".length).trim();
  }
  return out;
}

function cleanPlaca(placa) {
  return String(placa || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

/** XML CheckAuto com ConsultaID — Fábrica local ou CHECKAUTO_XML_DIR */
function resolveCheckAutoXmlPath(placa, explicitPath) {
  if (explicitPath && existsSync(explicitPath)) return explicitPath;
  const clean = cleanPlaca(placa);
  if (!clean) return null;
  const dirs = [
    process.env.CHECKAUTO_XML_DIR,
    join(rootDir, "..", "FABRICA DE VALOR", "fabrica", "checkauto"),
    join(rootDir, "output", "icheck", "xml"),
  ].filter(Boolean);
  for (const dir of dirs) {
    const candidate = join(dir, `${clean}.xml`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function maskPlate(placa) {
  const clean = String(placa || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (clean.length < 5) return clean || "—";
  // Padrão certificado CheckAuto: IZT6J30 → IZT-XX30
  return `${clean.slice(0, 3)}-XX${clean.slice(-2)}`;
}

function maskTipoChave(tipoChave) {
  const raw = String(tipoChave || "").trim();
  if (!raw) return "";
  return raw.replace(
    /Placa:\s*([A-Z0-9-]{5,})/i,
    (_, placa) => `Placa: ${maskPlate(placa)}`,
  );
}

function maskChassi(chassi) {
  const clean = String(chassi || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (clean.length < 8) return clean || "—";
  return `${clean.slice(0, 5)}${"X".repeat(Math.max(0, clean.length - 8))}${clean.slice(-3)}`;
}

function absUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}

function generateSlug(vehicle) {
  const parts = [
    vehicle.marca,
    vehicle.modelo,
    vehicle.ano || vehicle.year,
    vehicle.id,
  ]
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return parts;
}

async function fetchVehicleById(id) {
  const url = `${API_BASE.replace(/\/$/, "")}/veiculos/id/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status} em ${url}`);
  const json = await res.json();
  const vehicle = json?.data?.[0];
  if (!vehicle) throw new Error(`Veículo ${id} não encontrado na API`);
  return vehicle;
}

async function findVehicleIdByPlaca(placa) {
  const clean = String(placa)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const url = `${API_BASE.replace(/\/$/, "")}/veiculos.php?limit=500`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API lista ${res.status}`);
  const json = await res.json();
  const list = json?.data || [];
  const found = list.find(
    (v) =>
      String(v.placa || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase() === clean,
  );
  if (!found) throw new Error(`Placa ${placa} não encontrada no estoque`);
  return String(found.id);
}

function ensureJpeg(localPath, cacheDir, basename) {
  const outPath = join(cacheDir, `${basename}.jpg`);
  try {
    // Converte e limita largura para reduzir o resumo derivado.
    execFileSync(
      "sips",
      ["-s", "format", "jpeg", "-Z", "1400", localPath, "--out", outPath],
      { stdio: "ignore" },
    );
    return existsSync(outPath) ? outPath : null;
  } catch {
    console.warn(`   Aviso: não converteu ${localPath} para JPEG`);
    return null;
  }
}

async function downloadToCache(url, cacheDir, basename) {
  if (!url) return null;
  const pathname = new URL(url).pathname;
  let ext = extname(pathname).toLowerCase() || ".jpg";
  if (![".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"].includes(ext)) {
    ext = ".jpg";
  }
  const rawPath = join(cacheDir, `${basename}${ext}`);
  if (!existsSync(rawPath)) {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`   Aviso: falha ao baixar ${url} (${res.status})`);
      return null;
    }
    writeFileSync(rawPath, Buffer.from(await res.arrayBuffer()));
  }
  return ensureJpeg(rawPath, cacheDir, basename);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.id && !args.placa && !args.xml)) {
    console.log(`Uso:
  npm run report:icheck -- --id=19888
  npm run report:icheck -- --placa=JDB4D51
  npm run report:icheck -- --id=19888 --deploy
  npm run report:icheck -- --xml=/path/placa.xml   # preview completo só com XML`);
    process.exit(args.help ? 0 : 1);
  }

  const { ICheckReportDocument } =
    await import("../src/reports/icheck/ICheckReportDocument.tsx");

  let vehicleId = args.id;
  let vehicle = null;
  let dossier = null;

  const xmlEarly = args.xml && existsSync(args.xml) ? args.xml : null;
  if (xmlEarly) {
    dossier = parseCheckAutoDossier(xmlEarly);
    console.log(
      `XML dossier: ConsultaID ${dossier.protocol?.consultaId || "—"} · ${dossier.sections?.length || 0} seções`,
    );
  }

  if (!vehicleId && args.placa) {
    console.log(`Buscando placa ${args.placa}…`);
    try {
      vehicleId = await findVehicleIdByPlaca(args.placa);
    } catch (err) {
      if (!dossier?.ok) throw err;
      console.warn(`   Estoque sem placa — usando só XML (${err.message})`);
    }
  }

  if (vehicleId) {
    console.log(`Buscando veículo ${vehicleId}…`);
    vehicle = await fetchVehicleById(vehicleId);
  } else if (dossier?.ok && dossier.vehicleHint) {
    const hint = dossier.vehicleHint;
    const [marca, ...modeloParts] = String(
      hint.marcaModelo || "VEICULO CHECKAUTO",
    ).split("/");
    vehicle = {
      id: `xml-${cleanPlaca(hint.placa) || "preview"}`,
      placa: hint.placa,
      marca: (marca || "VEICULO").trim(),
      modelo: (modeloParts.join("/") || hint.marcaModelo || "CHECKAUTO").trim(),
      ano: hint.yearLabel?.split("/")?.[1]?.trim() || "",
      ano_fabricacao: hint.yearLabel?.split("/")?.[0]?.trim() || "",
      cor: hint.cor,
      combustivel: hint.combustivel,
      chassi: hint.chassiMasked,
      motor: hint.motor,
      km: null,
      opcionais: [],
      imagens_site: null,
      imagens: null,
      pdf: `CheckAuto_${cleanPlaca(hint.placa) || "preview"}.pdf`,
    };
    vehicleId = vehicle.id;
    console.log(
      `Preview XML → ${vehicle.marca} ${vehicle.modelo} (${vehicle.placa})`,
    );
  } else {
    throw new Error("Informe --id, --placa ou --xml=");
  }

  const pdfName = (
    args.pdf ||
    vehicle.pdf ||
    `CheckAuto_${String(vehicle.placa || vehicleId).replace(/[^a-zA-Z0-9]/g, "")}.pdf`
  ).replace(/^.*\//, "");
  const sourceReference =
    vehicle.pdf || args.pdf
      ? resolveCertificateReference(
          {
            ...vehicle,
            pdf: pdfName,
            pdf_url: `arquivos/autocheck/${pdfName}`,
          },
          SITE_ORIGIN,
        )
      : null;
  const pdfUrl = sourceReference?.url || null;

  const cacheDir = join(
    rootDir,
    "output",
    "icheck",
    "cache",
    String(vehicleId),
  );
  const outDir = join(rootDir, "output", "icheck");
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  let checkautoLocal = null;
  let historyParse = {
    available: false,
    allClear: false,
    history: [],
    issuedAt: null,
    chassi: null,
    consultaId: null,
    dataHoraConsulta: null,
    tipoChave: null,
  };
  let sourceBuf = null;
  if (pdfUrl) {
    console.log(`Baixando certificado associado: ${pdfUrl}`);
    try {
      const response = await fetch(pdfUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (
        buffer.subarray(0, 5).toString("ascii") !== "%PDF-" ||
        buffer.length > 15 * 1024 * 1024
      )
        throw new Error("PDF inválido");
      sourceBuf = buffer;
    } catch (error) {
      console.warn(`   Certificado indisponível: ${error.message}`);
    }
  }

  if (sourceBuf) {
    checkautoLocal = join(cacheDir, "source-checkauto.pdf");
    writeFileSync(checkautoLocal, sourceBuf);
    historyParse = await parseCheckAutoPdf(sourceBuf);
    if (!certificateMatchesVehicle(historyParse, vehicle))
      throw new Error("Certificado não corresponde à placa/chassi do veículo");
    console.log(
      `   Fonte: ${pdfUrl} (${(sourceBuf.length / 1024).toFixed(0)} KB)`,
    );
    console.log(
      historyParse.available
        ? `   Histórico parseado (${historyParse.allClear ? "limpo" : "com detalhes"})`
        : "   Histórico não parseado — marcará indisponível",
    );
  } else {
    console.warn("   Certificado associado indisponível");
  }

  // XML só enriquece um PDF quando identidade e data indicam a mesma consulta.
  const xmlPath = resolveCheckAutoXmlPath(vehicle.placa, args.xml);
  let xmlTrustedForProtocol = false;
  if (xmlPath) {
    dossier = parseCheckAutoDossier(xmlPath);
    console.log(`XML CheckAuto: ${xmlPath}`);
    const pdfDate = historyParse.dataHoraConsulta || historyParse.issuedAt;
    const xmlDate = dossier.protocol?.dataHoraConsulta || null;
    xmlTrustedForProtocol =
      dossierMatchesCertificate(dossier, historyParse, vehicle) ||
      (String(vehicleId).startsWith("xml-") && dossier.ok);
    if (!xmlTrustedForProtocol) {
      console.warn(
        "   XML ignorado: identidade ou data não correspondem ao certificado associado.",
      );
    } else {
      const fromXmlOnly = String(vehicleId).startsWith("xml-");
      historyParse = {
        ...historyParse,
        dataHoraConsulta: pdfDate || (fromXmlOnly ? xmlDate : null),
        issuedAt: pdfDate || (fromXmlOnly ? xmlDate : null),
        consultaId:
          historyParse.consultaId || dossier.protocol?.consultaId || null,
        tipoChave:
          historyParse.tipoChave || dossier.protocol?.tipoChave || null,
        history: fromXmlOnly ? dossier.history : historyParse.history,
        available: fromXmlOnly ? dossier.available : historyParse.available,
        allClear: fromXmlOnly
          ? dossier.allClear
          : historyParse.allClear && dossier.allClear,
      };
    }
    if (historyParse.consultaId) {
      console.log(`   Protocolo ConsultaID ${historyParse.consultaId}`);
    }
    if (historyParse.dataHoraConsulta) {
      console.log(`   Data consulta ${historyParse.dataHoraConsulta}`);
    }
  } else {
    console.warn(
      "   XML CheckAuto não encontrado — dossiê completo fica limitado. Use --xml= ou pasta fabrica/checkauto.",
    );
  }

  if (!historyParse.tipoChave && vehicle.placa) {
    historyParse.tipoChave = `Placa: ${maskPlate(vehicle.placa)}`;
  } else if (historyParse.tipoChave) {
    historyParse.tipoChave = maskTipoChave(historyParse.tipoChave);
  }

  const dossierSummary =
    xmlTrustedForProtocol && dossier?.sections?.length
      ? summarizeDossier(dossier.sections)
      : { history: [], highlights: [] };

  const certificateHistory = (historyParse.history || []).map((item) => ({
    ...item,
    ...classifyCertificateStatus(item.status),
  }));
  const webHistory = certificateHistory.length
    ? certificateHistory
    : HISTORY_FALLBACK();
  const webHighlights = dossierSummary.highlights || [];

  function HISTORY_FALLBACK() {
    return [
      ["leilao", "Leilão"],
      ["sinistro", "Sinistro / Perda"],
      ["roubo", "Roubo / Furto"],
      ["estaduais", "Informações Estaduais"],
    ].map(([key, label]) => ({
      key,
      label,
      ...classifyCertificateStatus(null),
    }));
  }

  // Prefer imagens_site (fundo cinza + logo Netcar); AVIF/PNG → JPEG via sips
  const galeria = (
    vehicle.imagens_site?.galeria?.length
      ? vehicle.imagens_site.galeria
      : vehicle.imagens?.full?.length
        ? vehicle.imagens.full
        : vehicle.imagens?.thumb || []
  ).filter(Boolean);

  console.log(`Baixando ${Math.min(galeria.length, 9)} fotos…`);
  const photoPaths = [];
  for (let i = 0; i < Math.min(galeria.length, 9); i++) {
    const url = absUrl(galeria[i]);
    const local = await downloadToCache(url, cacheDir, `photo-${i}`);
    if (local) photoPaths.push(local);
  }

  // capa PNG às vezes vem sem fundo cinza/logo — preferir 1ª da galeria site
  const capa =
    (galeria[0] ? absUrl(galeria[0]) : null) ||
    absUrl(vehicle.imagens_site?.capa) ||
    absUrl(vehicle.imagens_site?.capa_thumb);
  const capaLocal = capa
    ? await downloadToCache(capa, cacheDir, "capa")
    : photoPaths[0] || null;

  const brandDir = join(rootDir, "public", "brand");
  const netcarLogoPath = join(brandDir, "netcar.png");
  const dekraLogoPath = join(brandDir, "dekra.png");
  const checkautoLogoPath = join(brandDir, "checkauto.png");
  const partnerLogosPath = join(brandDir, "checkauto-dekra.png");
  const checkIconPath = existsSync(join(brandDir, "check-ok.png"))
    ? join(brandDir, "check-ok.png")
    : join(brandDir, "check-ok.svg");

  const marca = vehicle.marca || "";
  const modelo = vehicle.modelo || "";
  const yearLabel =
    vehicle.ano_fabricacao && vehicle.ano
      ? `${vehicle.ano_fabricacao} / ${vehicle.ano}`
      : String(vehicle.ano || vehicle.ano_fabricacao || "—");

  const slug = generateSlug(vehicle);
  const listingUrl = `${SITE_ORIGIN}/veiculo/${slug}`;

  const data = {
    vehicleName: `${marca} ${modelo} ${vehicle.ano || ""}`.trim(),
    marca,
    modelo,
    yearLabel,
    placaMasked: maskPlate(vehicle.placa),
    kmLabel:
      vehicle.km != null
        ? `${Number(vehicle.km).toLocaleString("pt-BR")} km`
        : "—",
    cor: vehicle.cor || "—",
    combustivel: vehicle.combustivel || "—",
    cambio: vehicle.cambio || "—",
    motor: vehicle.motor || "—",
    chassiMasked: maskChassi(historyParse.chassi || vehicle.chassi),
    issuedAt: historyParse.dataHoraConsulta || historyParse.issuedAt || "",
    consultaId: historyParse.consultaId || "",
    dataHoraConsulta:
      historyParse.dataHoraConsulta || historyParse.issuedAt || "",
    tipoChave: historyParse.tipoChave || "",
    listingUrl,
    dekraLogoPath: existsSync(dekraLogoPath) ? dekraLogoPath : "",
    checkautoLogoPath: existsSync(checkautoLogoPath) ? checkautoLogoPath : "",
    partnerLogosPath: existsSync(partnerLogosPath) ? partnerLogosPath : "",
    netcarLogoPath: existsSync(netcarLogoPath) ? netcarLogoPath : "",
    checkIconPath: existsSync(checkIconPath) ? checkIconPath : "",
    heroPhotos: [capaLocal, photoPaths[1] || photoPaths[0]].filter(Boolean),
    galleryPhotos: photoPaths,
    specs: [
      { label: "Ano", value: yearLabel },
      { label: "Cor", value: vehicle.cor || "—" },
      { label: "Km", value: vehicle.km != null ? String(vehicle.km) : "—" },
      { label: "Motor", value: vehicle.motor || "—" },
      {
        label: "Potência",
        value: vehicle.potencia ? `${vehicle.potencia} cv` : "—",
      },
      { label: "Combustível", value: vehicle.combustivel || "—" },
      { label: "Câmbio", value: vehicle.cambio || "—" },
      {
        label: "Portas",
        value: vehicle.portas != null ? String(vehicle.portas) : "—",
      },
    ].filter((s) => s.value && s.value !== "—"),
    optionals: (vehicle.opcionais || [])
      .map((o) => (typeof o === "string" ? o : o.descricao || o.nome || ""))
      .filter(Boolean),
    history:
      webHistory.length > 0
        ? webHistory
        : [
            { key: "leilao", label: "Leilão", status: null },
            { key: "sinistro", label: "Sinistro / Perda", status: null },
            { key: "roubo", label: "Roubo / Furto", status: null },
            { key: "estaduais", label: "Informações Estaduais", status: null },
          ],
    historyAvailable: webHistory.some(
      (item) => item.status && item.riskLevel !== "unavailable",
    ),
    allClear: Boolean(
      historyParse.allClear && webHistory.every((item) => item.clear),
    ),
    sourcePdfUrl: pdfUrl || undefined,
    sourceLabel: pdfUrl ? "Certificado CheckAuto / DEKRA associado" : undefined,
    consultationHighlights: webHighlights,
    consultationSections: xmlTrustedForProtocol
      ? dossierSectionsForDisplay(dossier?.sections)
      : [],
  };

  console.log("Gerando PDF…");
  const element = React.createElement(ICheckReportDocument, { data });
  const streamOrBuffer = await pdf(element).toBuffer();
  let buffer;
  if (Buffer.isBuffer(streamOrBuffer)) {
    buffer = streamOrBuffer;
  } else if (
    streamOrBuffer &&
    typeof streamOrBuffer[Symbol.asyncIterator] === "function"
  ) {
    const chunks = [];
    for await (const chunk of streamOrBuffer) chunks.push(chunk);
    buffer = Buffer.concat(chunks);
  } else if (typeof streamOrBuffer?.arrayBuffer === "function") {
    buffer = Buffer.from(await streamOrBuffer.arrayBuffer());
  } else {
    // fallback toBlob
    const blob = await pdf(element).toBlob();
    buffer = Buffer.from(await blob.arrayBuffer());
  }

  // Derived documents always have their own filename. The associated source PDF is immutable here.
  const outName = `Netcar_iCheck_${vehicleId}_${maskPlate(vehicle.placa).replace(/[^a-zA-Z0-9]/g, "")}.pdf`;
  if (outName === pdfName)
    throw new Error("Nome do resumo coincide com o certificado original");
  const outPath = join(outDir, outName);
  writeFileSync(outPath, buffer);
  console.log(`OK → ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);

  let metaPath = null;
  let metaName = null;
  if (
    sourceReference &&
    sourceBuf &&
    historyParse.ok &&
    certificateMatchesVehicle(historyParse, vehicle)
  ) {
    const parsedSource = await parseCheckAutoPdf(sourceBuf);
    const meta = buildCertificateMetadata(
      vehicle,
      sourceReference,
      sourceBuf,
      parsedSource,
      xmlTrustedForProtocol ? dossier : null,
    );
    metaName = sourceReference.metaName;
    metaPath = join(outDir, metaName);
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    const publicAutocheck = join(rootDir, "public", "arquivos", "autocheck");
    mkdirSync(publicAutocheck, { recursive: true });
    writeFileSync(
      join(publicAutocheck, metaName),
      `${JSON.stringify(meta, null, 2)}\n`,
    );
    console.log(`OK → public/arquivos/autocheck/${metaName}`);
  }

  if (args.deploy) {
    const deploy = loadDeployEnv(process.env);
    await uploadIcheckPdf({
      localPath: outPath,
      remoteFileName: outName,
      ...deploy,
      onProgress: (message) => console.log(message),
    });
    if (metaPath && metaName)
      await uploadIcheckPdf({
        localPath: metaPath,
        remoteFileName: metaName,
        ...deploy,
        onProgress: (message) => console.log(message),
      });
  } else
    console.log(
      "Resumo salvo em output/icheck. --deploy publica o resumo separado e os metadados.",
    );
}

main().catch((err) => {
  console.error("Erro:", err.message || err);
  process.exit(1);
});
