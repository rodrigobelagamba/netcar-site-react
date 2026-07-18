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

import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { parseCheckAutoPdf } from "./lib/parse-checkauto-pdf.mjs";
import { parseCheckAutoDossier } from "./lib/parse-checkauto-xml.mjs";
import { summarizeDossier } from "./lib/icheck-dossier-summary.mjs";
import { loadDeployEnv, uploadIcheckPdf } from "./lib/upload-icheck-pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

/** Dump Dropbox Automacar = fonte da verdade do certificado CheckAuto. */
const AUTOMACAR_SITE_ROOT =
  process.env.AUTOMACAR_SITE_ROOT ||
  (existsSync(
    "/Users/marcelomarchis/Library/CloudStorage/Dropbox/AUTOMACAR/ArquivosSite",
  )
    ? "/Users/marcelomarchis/Library/CloudStorage/Dropbox/AUTOMACAR/ArquivosSite"
    : join(rootDir, "..", "..", "AUTOMACAR", "ArquivosSite"));
const AUTOMACAR_PRIMARY_DUMP =
  process.env.AUTOMACAR_PRIMARY_DUMP || "AutomacarSite_20260626_091800";

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
    else if (arg.startsWith("--xml=")) out.xml = arg.slice("--xml=".length).trim();
    else if (arg.startsWith("--pdf=")) out.pdf = arg.slice("--pdf=".length).trim();
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

/**
 * PDF oficial CheckAuto na pasta AutomacarSite (Dropbox).
 * Ordem: dump primário por nome → primário por placa → outros dumps (mais novo primeiro).
 */
function resolveOfficialAutomacarPdf(pdfName, placa) {
  const root = AUTOMACAR_SITE_ROOT;
  if (!existsSync(root)) return null;

  const dumps = readdirSync(root)
    .filter((d) => d.startsWith("AutomacarSite_"))
    .sort()
    .reverse();
  const primary = AUTOMACAR_PRIMARY_DUMP;
  const ordered = [
    primary,
    ...dumps.filter((d) => d !== primary),
  ].filter((d) => existsSync(join(root, d)));

  const wantName = pdfName ? basename(String(pdfName)) : null;
  const wantPlaca = cleanPlaca(placa);

  // 1) nome exato no dump primário
  if (wantName) {
    const exactPrimary = join(root, primary, wantName);
    if (existsSync(exactPrimary)) {
      return { path: exactPrimary, dump: primary, match: "name-primary" };
    }
  }

  // 2) placa no dump primário (qualquer HHMM)
  if (wantPlaca) {
    const primaryDir = join(root, primary);
    if (existsSync(primaryDir)) {
      const hit = readdirSync(primaryDir).find((f) =>
        new RegExp(`^CheckAuto_${wantPlaca}_\\d+\\.pdf$`, "i").test(f),
      );
      if (hit) {
        return {
          path: join(primaryDir, hit),
          dump: primary,
          match: "placa-primary",
          pdfName: hit,
        };
      }
    }
  }

  // 3) nome exato em qualquer dump (mais novo primeiro)
  if (wantName) {
    for (const dump of ordered) {
      const p = join(root, dump, wantName);
      if (existsSync(p)) {
        return { path: p, dump, match: "name-other" };
      }
    }
  }

  // 4) placa em qualquer dump (mais novo primeiro)
  if (wantPlaca) {
    for (const dump of ordered) {
      const dir = join(root, dump);
      const hit = readdirSync(dir).find((f) =>
        new RegExp(`^CheckAuto_${wantPlaca}_\\d+\\.pdf$`, "i").test(f),
      );
      if (hit) {
        return {
          path: join(dir, hit),
          dump,
          match: "placa-other",
          pdfName: hit,
        };
      }
    }
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

/** Campo cambio API às vezes erra; opcional cambio_automatico corrige. */
function resolveVehicleCambio(cambio, opcionais) {
  const field = String(cambio || "").trim();
  const tags = new Set(
    (opcionais || []).map((o) => String(o?.tag || "").toLowerCase()),
  );
  const hasAutoOpt =
    tags.has("cambio_automatico") ||
    tags.has("cambio_automatizado") ||
    tags.has("cvt");
  const hasManualOpt = tags.has("cambio_manual");
  if (hasAutoOpt && !hasManualOpt) {
    if (!field || /manual/i.test(field)) return "AUTOMATICO";
    return field;
  }
  if (hasManualOpt && !hasAutoOpt) {
    if (!field || /autom/i.test(field)) return "MANUAL";
    return field;
  }
  return field || "";
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
  const clean = String(chassi || "").toUpperCase().replace(/\s+/g, "");
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
  const clean = String(placa).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
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
    // Converte + limita largura — PDF leve o bastante pra overwrite no host
    execFileSync(
      "sips",
      [
        "-s",
        "format",
        "jpeg",
        "-Z",
        "1400",
        localPath,
        "--out",
        outPath,
      ],
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

  const { ICheckReportDocument } = await import(
    "../src/reports/icheck/ICheckReportDocument.tsx"
  );

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
    const [marca, ...modeloParts] = String(hint.marcaModelo || "VEICULO CHECKAUTO")
      .split("/");
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
    console.log(`Preview XML → ${vehicle.marca} ${vehicle.modelo} (${vehicle.placa})`);
  } else {
    throw new Error("Informe --id, --placa ou --xml=");
  }

  const pdfName = (
    args.pdf ||
    vehicle.pdf ||
    `CheckAuto_${String(vehicle.placa || vehicleId).replace(/[^a-zA-Z0-9]/g, "")}.pdf`
  ).replace(/^.*\//, "");
  const pdfRel = `arquivos/autocheck/${pdfName}`;
  const pdfUrl = absUrl(pdfRel);

  const cacheDir = join(rootDir, "output", "icheck", "cache", String(vehicleId));
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
  let sourceKind = null; // automacar | remote | local-fallback

  // 1) FONTE DA VERDADE: PDF oficial AutomacarSite (Dropbox)
  const official = resolveOfficialAutomacarPdf(pdfName, vehicle.placa);
  let sourceBuf = null;
  let sourceLabel = null;
  if (official?.path) {
    sourceBuf = readFileSync(official.path);
    sourceLabel = official.path;
    sourceKind = "automacar";
    if (official.pdfName && official.pdfName !== pdfName) {
      console.log(
        `   PDF Automacar por placa: ${official.pdfName} (API tinha ${pdfName})`,
      );
    }
    console.log(
      `Fonte oficial Automacar (${official.match}): ${official.dump}/${basename(official.path)}`,
    );
  } else {
    console.warn(
      `   Sem PDF em AutomacarSite para ${pdfName || vehicle.placa} — fallback remoto/local`,
    );
  }

  // 2) Fallback: remoto site / cópias locais (só se Automacar não tiver)
  if (!sourceBuf) {
    console.log(`Baixando CheckAuto: ${pdfUrl}`);
    if (pdfUrl) {
      try {
        const res = await fetch(pdfUrl);
        if (res.ok) {
          sourceBuf = Buffer.from(await res.arrayBuffer());
          sourceLabel = pdfUrl;
          sourceKind = "remote";
        } else {
          console.warn(`   Remoto indisponível (${res.status})`);
        }
      } catch (err) {
        console.warn(`   Remoto falhou: ${err.message || err}`);
      }
    }
    const localFallback = [
      join(rootDir, "public", "arquivos", "autocheck", pdfName),
      join(rootDir, "arquivos", "autocheck", pdfName),
    ];
    const looksLikeNetcarRebuild = sourceBuf && sourceBuf.length > 400_000;
    if (!sourceBuf || looksLikeNetcarRebuild) {
      for (const candidate of localFallback) {
        if (!existsSync(candidate)) continue;
        const localBuf = readFileSync(candidate);
        if (!sourceBuf || (looksLikeNetcarRebuild && localBuf.length < sourceBuf.length)) {
          sourceBuf = localBuf;
          sourceLabel = candidate;
          sourceKind = "local-fallback";
        }
      }
    }
  }

  if (sourceBuf) {
    checkautoLocal = join(cacheDir, "source-checkauto.pdf");
    writeFileSync(checkautoLocal, sourceBuf);
    historyParse = await parseCheckAutoPdf(sourceBuf);
    console.log(`   Fonte: ${sourceLabel} (${(sourceBuf.length / 1024).toFixed(0)} KB)`);
    console.log(
      historyParse.available
        ? `   Histórico parseado (${historyParse.allClear ? "limpo" : "com detalhes"})`
        : "   Histórico não parseado — marcará indisponível",
    );
  } else {
    console.warn("   CheckAuto indisponível (Automacar/remoto/local)");
  }

  // XML NÃO é fonte da verdade. Só enriquece se data bater com PDF Automacar/oficial.
  const xmlPath = resolveCheckAutoXmlPath(vehicle.placa, args.xml);
  let xmlTrustedForProtocol = false;
  let xmlConflictIgnored = false;
  if (xmlPath) {
    dossier = parseCheckAutoDossier(xmlPath);
    console.log(`XML CheckAuto: ${xmlPath}`);
    const pdfDate = historyParse.dataHoraConsulta || historyParse.issuedAt;
    const xmlDate = dossier.protocol?.dataHoraConsulta || null;
    xmlTrustedForProtocol = Boolean(
      sourceKind === "automacar"
        ? xmlDate && pdfDate && xmlDate === pdfDate
        : xmlDate && (!pdfDate || xmlDate === pdfDate),
    );

    if (pdfDate && xmlDate && pdfDate !== xmlDate) {
      xmlConflictIgnored = true;
      console.warn(
        `   AVISO: XML (${xmlDate}) ≠ PDF oficial (${pdfDate}). Usando data/histórico do PDF. ConsultaID do XML ignorado.`,
      );
    }

    historyParse = {
      ...historyParse,
      // Data: PDF oficial primeiro
      dataHoraConsulta: pdfDate || xmlDate || null,
      issuedAt: pdfDate || xmlDate || historyParse.issuedAt,
      // ConsultaID só se XML for da mesma consulta do PDF (ou se não houver data no PDF)
      consultaId: xmlTrustedForProtocol
        ? dossier.protocol?.consultaId || historyParse.consultaId
        : historyParse.consultaId || null,
      tipoChave:
        historyParse.tipoChave ||
        (xmlTrustedForProtocol ? dossier.protocol?.tipoChave : null) ||
        dossier.protocol?.tipoChave ||
        null,
      // Histórico certificado: PDF primeiro quando parseou
      history:
        historyParse.available && historyParse.history?.length
          ? historyParse.history
          : dossier.history?.length
            ? dossier.history
            : historyParse.history,
      available: historyParse.available || dossier.available,
      allClear: historyParse.available
        ? historyParse.allClear
        : dossier.allClear,
    };
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
    historyParse.tipoChave = `Placa: ${maskPlate(vehicle.placa)} UF: RS`;
  } else if (historyParse.tipoChave) {
    historyParse.tipoChave = maskTipoChave(historyParse.tipoChave);
  }

  const dossierSummary =
    xmlTrustedForProtocol && dossier?.sections?.length
      ? summarizeDossier(dossier.sections)
      : { history: [], highlights: [] };

  /** Cards do certificado PDF (fonte oficial quando XML é antigo/truncado). */
  function pdfHistoryForWeb(items = []) {
    return (items || [])
      .filter((h) => h?.status)
      .map((h) => {
        const status = String(h.status);
        const clear =
          /^sem\s*registro/i.test(status) || /^consultado\.?$/i.test(status);
        // Alienação = aviso amarelo (CheckAuto), não alerta grave vermelho
        const warn = /aliena/i.test(status);
        const alert =
          !clear &&
          !warn &&
          /roubo|furto|leil[aã]o|sinistro|bloqueio|restri|com\s*registro/i.test(
            status,
          );
        return {
          key: h.key,
          label: h.label,
          hint:
            h.key === "estaduais"
              ? "Situação no DETRAN / gravames"
              : h.key === "leilao"
                ? "Remarketing e leilão"
                : h.key === "sinistro"
                  ? "Perda total / sinistro"
                  : h.key === "roubo"
                    ? "Bases de roubo e furto"
                    : "",
          status,
          clear: clear && !warn,
          riskLevel: alert ? "alert" : warn ? "warn" : "ok",
        };
      });
  }

  const certificateHistory = pdfHistoryForWeb(historyParse.history);
  const webHistory =
    certificateHistory.length > 0
      ? certificateHistory
      : dossierSummary.history.length > 0
        ? dossierSummary.history
        : [];

  const webHighlights =
    certificateHistory.length > 0
      ? certificateHistory
          .filter((h) => h.status)
          .slice(0, 4)
          .map((h) => ({ label: h.label, value: h.status }))
      : dossierSummary.highlights;

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
  const cambio = resolveVehicleCambio(vehicle.cambio, vehicle.opcionais);

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
    cambio,
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
      { label: "Potência", value: vehicle.potencia ? `${vehicle.potencia} cv` : "—" },
      { label: "Combustível", value: vehicle.combustivel || "—" },
      { label: "Câmbio", value: cambio },
      { label: "Portas", value: vehicle.portas != null ? String(vehicle.portas) : "—" },
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
    historyAvailable: Boolean(
      historyParse.available || webHistory.length || dossierSummary.history.length,
    ),
    allClear: Boolean(
      historyParse.available
        ? historyParse.allClear
        : webHistory.length > 0 && webHistory.every((h) => h.clear),
    ),
    consultationHighlights: webHighlights,
  };

  console.log("Gerando PDF…");
  const element = React.createElement(ICheckReportDocument, { data });
  const streamOrBuffer = await pdf(element).toBuffer();
  let buffer;
  if (Buffer.isBuffer(streamOrBuffer)) {
    buffer = streamOrBuffer;
  } else if (streamOrBuffer && typeof streamOrBuffer[Symbol.asyncIterator] === "function") {
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

  const outName = pdfName.endsWith(".pdf") ? pdfName : `${pdfName}.pdf`;
  const outPath = join(outDir, outName);
  writeFileSync(outPath, buffer);
  console.log(`OK → ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);

  // cópia com nome amigável
  const friendly = join(
    outDir,
    `Netcar_iCheck_${vehicleId}_${maskPlate(vehicle.placa).replace(/[^a-zA-Z0-9]/g, "")}.pdf`,
  );
  writeFileSync(friendly, buffer);
  console.log(`OK → ${friendly}`);

  // Copia pro public/ p/ overwrite no deploy:local (mesmo path do host)
  const publicAutocheck = join(rootDir, "public", "arquivos", "autocheck");
  mkdirSync(publicAutocheck, { recursive: true });
  writeFileSync(join(publicAutocheck, outName), buffer);
  console.log(`OK → public/arquivos/autocheck/${outName}`);

  const dataHoraMeta =
    historyParse.dataHoraConsulta || historyParse.issuedAt || null;
  const protocoloMatch = String(dataHoraMeta || "").match(
    /(\d{2})\/(\d{2})\/(\d{4})/,
  );
  // MMDDYYYY (americano): 22/12/2023 → 12222023
  const protocoloConsulta = protocoloMatch
    ? `${protocoloMatch[2]}${protocoloMatch[1]}${protocoloMatch[3]}`
    : null;

  const meta = {
    vehicleId: String(vehicleId),
    placa: cleanPlaca(vehicle.placa),
    consultaId: historyParse.consultaId || null,
    dataHoraConsulta: dataHoraMeta,
    protocoloConsulta,
    tipoChave: historyParse.tipoChave || null,
    history: webHistory,
    consultationHighlights: webHighlights,
    source:
      sourceKind === "automacar"
        ? "automacar-pdf"
        : historyParse.available && certificateHistory.length > 0
          ? "checkauto-pdf"
          : xmlTrustedForProtocol
            ? "checkauto-xml"
            : "partial",
    sourcePath: sourceLabel || null,
    pdf: outName,
    updatedAt: new Date().toISOString(),
  };
  const metaName = outName.replace(/\.pdf$/i, ".meta.json");
  const metaPath = join(outDir, metaName);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  writeFileSync(join(publicAutocheck, metaName), JSON.stringify(meta, null, 2));
  console.log(`OK → public/arquivos/autocheck/${metaName}`);

  if (args.deploy) {
    const deploy = loadDeployEnv(process.env);
    await uploadIcheckPdf({
      localPath: outPath,
      remoteFileName: outName,
      ...deploy,
      onProgress: (msg) => console.log(msg),
    });
    await uploadIcheckPdf({
      localPath: metaPath,
      remoteFileName: metaName,
      ...deploy,
      onProgress: (msg) => console.log(msg),
    });
  } else {
    console.log("Dica: adicione --deploy para sobrescrever no servidor (com .bak).");
  }
}

main().catch((err) => {
  console.error("Erro:", err.message || err);
  process.exit(1);
});
