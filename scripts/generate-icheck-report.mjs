#!/usr/bin/env node
/**
 * Gera PDF i-CHECK moderno (fotos + ficha + histórico CheckAuto).
 *
 * Uso:
 *   npm run report:icheck -- --id=19888
 *   npm run report:icheck -- --placa=JDB4D51
 *   npm run report:icheck -- --id=19888 --deploy
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { parseCheckAutoPdf } from "./lib/parse-checkauto-pdf.mjs";
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
  const out = { id: null, placa: null, deploy: false, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--deploy") out.deploy = true;
    else if (arg.startsWith("--id=")) out.id = arg.slice(5).trim();
    else if (arg.startsWith("--placa=")) out.placa = arg.slice(8).trim();
  }
  return out;
}

function maskPlate(placa) {
  const clean = String(placa || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (clean.length < 4) return clean || "—";
  return `${clean.slice(0, 3)}-xx${clean.slice(-2)}`;
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
  if (args.help || (!args.id && !args.placa)) {
    console.log(`Uso:
  npm run report:icheck -- --id=19888
  npm run report:icheck -- --placa=JDB4D51
  npm run report:icheck -- --id=19888 --deploy`);
    process.exit(args.help ? 0 : 1);
  }

  const { ICheckReportDocument } = await import(
    "../src/reports/icheck/ICheckReportDocument.tsx"
  );

  let vehicleId = args.id;
  if (!vehicleId && args.placa) {
    console.log(`Buscando placa ${args.placa}…`);
    vehicleId = await findVehicleIdByPlaca(args.placa);
  }

  console.log(`Buscando veículo ${vehicleId}…`);
  const vehicle = await fetchVehicleById(vehicleId);

  const pdfName =
    vehicle.pdf ||
    `CheckAuto_${String(vehicle.placa || vehicleId).replace(/[^a-zA-Z0-9]/g, "")}.pdf`;
  const pdfRel = vehicle.pdf_url || `arquivos/autocheck/${pdfName}`;
  const pdfUrl = absUrl(pdfRel);

  const cacheDir = join(rootDir, "output", "icheck", "cache", String(vehicleId));
  const outDir = join(rootDir, "output", "icheck");
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  console.log(`Baixando CheckAuto: ${pdfUrl}`);
  let checkautoLocal = null;
  let historyParse = {
    available: false,
    allClear: false,
    history: [],
    issuedAt: null,
    chassi: null,
  };

  if (pdfUrl) {
    const res = await fetch(pdfUrl);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      checkautoLocal = join(cacheDir, "source-checkauto.pdf");
      writeFileSync(checkautoLocal, buf);
      historyParse = await parseCheckAutoPdf(buf);
      console.log(
        historyParse.available
          ? `   Histórico parseado (${historyParse.allClear ? "limpo" : "com detalhes"})`
          : "   Histórico não parseado — marcará indisponível",
      );
    } else {
      console.warn(`   CheckAuto indisponível (${res.status})`);
    }
  }

  // Prefer full (jpg/png); galeria AVIF cai no conversor sips
  const galeria = (
    vehicle.imagens?.full?.length
      ? vehicle.imagens.full
      : vehicle.imagens_site?.galeria?.length
        ? vehicle.imagens_site.galeria
        : vehicle.imagens?.thumb || []
  ).filter(Boolean);

  console.log(`Baixando ${Math.min(galeria.length, 9)} fotos…`);
  const photoPaths = [];
  for (let i = 0; i < Math.min(galeria.length, 9); i++) {
    const url = absUrl(galeria[i]);
    const local = await downloadToCache(url, cacheDir, `photo-${i}`);
    if (local) photoPaths.push(local);
  }

  const capa =
    absUrl(vehicle.imagens_site?.capa) ||
    absUrl(vehicle.imagens_site?.capa_thumb) ||
    (galeria[0] ? absUrl(galeria[0]) : null);
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
    issuedAt:
      historyParse.issuedAt ||
      new Date().toLocaleString("pt-BR", { hour12: false }),
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
      { label: "Câmbio", value: vehicle.cambio || "—" },
      { label: "Portas", value: vehicle.portas != null ? String(vehicle.portas) : "—" },
    ].filter((s) => s.value && s.value !== "—"),
    optionals: (vehicle.opcionais || [])
      .map((o) => (typeof o === "string" ? o : o.descricao || o.nome || ""))
      .filter(Boolean),
    history:
      historyParse.history?.length > 0
        ? historyParse.history
        : [
            { key: "leilao", label: "Leilão", status: null },
            { key: "sinistro", label: "Sinistro / Perda", status: null },
            { key: "roubo", label: "Roubo / Furto", status: null },
            { key: "estaduais", label: "Informações Estaduais", status: null },
          ],
    historyAvailable: Boolean(historyParse.available),
    allClear: Boolean(historyParse.allClear),
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

  if (args.deploy) {
    const deploy = loadDeployEnv(process.env);
    await uploadIcheckPdf({
      localPath: outPath,
      remoteFileName: outName,
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
