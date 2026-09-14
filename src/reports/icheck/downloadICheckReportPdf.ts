import React from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { maskPlate } from "@/lib/slug";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import { resolveIcheckAttachment } from "@/lib/icheckMetadata";
import {
  ICheckReportDocument,
  type ICheckReportData,
} from "./ICheckReportDocument";
import { optimizeStockImage, stockGalleryPreviewSource } from "@/lib/images";
import {
  getHistorySummary,
  normalizeHistoryItems,
  type ICheckHistoryItem,
} from "./icheckHistory";

type ProtocolMeta = {
  consultaId?: string | null;
  dataHoraConsulta?: string | null;
  protocoloConsulta?: string | null;
  tipoChave?: string | null;
  history?: ICheckHistoryItem[];
  consultationHighlights?: Array<{ label: string; value: string }>;
  consultationSections?: ICheckReportData["consultationSections"];
  sourcePdfUrl?: string;
  sourceLabel?: string;
};

function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return CANONICAL_ORIGIN;
}

/** URL absoluta — react-pdf no browser precisa fetch HTTP (não path local). */
function absUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function brandUrl(file: string): string {
  return absUrl(`/brand/${file}`);
}

function galleryFromVehicle(vehicle: Vehicle): string[] {
  return (
    vehicle.imagens_site?.galeria?.length
      ? vehicle.imagens_site.galeria
      : vehicle.fullImages?.length
        ? vehicle.fullImages
        : vehicle.images || []
  )
    .filter(Boolean)
    .slice(0, 9) as string[];
}

export function buildClientICheckReportData(input: {
  vehicle: Vehicle;
  protocol: ProtocolMeta | null;
  slug: string;
}): ICheckReportData {
  const { vehicle, protocol, slug } = input;
  const origin = siteOrigin();
  const gallery = galleryFromVehicle(vehicle).map(absUrl);
  const heroA = gallery[0] || absUrl(vehicle.imagens_site?.capa);
  const heroB = gallery[1] || gallery[0];

  const yearLabel =
    vehicle.anoFabricacao && vehicle.year
      ? `${vehicle.anoFabricacao} / ${vehicle.year}`
      : String(vehicle.year || vehicle.anoFabricacao || "—");

  const placaMasked = vehicle.placa ? maskPlate(vehicle.placa) : "";
  const tipoChave =
    String(protocol?.tipoChave || "").replace(/Placa:\s*[A-Z0-9-]+/i, (m) => {
      const raw = m.replace(/^Placa:\s*/i, "");
      return `Placa: ${maskPlate(raw)}`;
    }) || (vehicle.placa ? `Placa: ${placaMasked}` : "");

  // Histórico só do meta CheckAuto (normalize = mesma regra HTML/PDF)
  const history = normalizeHistoryItems(protocol?.history);

  const summary = getHistorySummary(history);

  const dataHora = protocol?.dataHoraConsulta || "";
  const consultaId = protocol?.consultaId || "";

  const optionals = (vehicle.opcionais || [])
    .map((o) => (typeof o === "string" ? o : o.descricao || o.tag || ""))
    .filter(Boolean);

  const marca = vehicle.marca || "";
  const modelo = vehicle.modelo || vehicle.name || "";

  // Specs = catálogo API (não inventar). Omitir vazio / "—".
  const cambio = String(vehicle.cambio || "").trim();
  const cor = String(vehicle.cor || "").trim();
  const combustivel = String(vehicle.combustivel || "").trim();
  const motor = String(vehicle.motor || "").trim();

  return {
    vehicleName: `${marca} ${modelo} ${vehicle.year || ""}`.trim(),
    marca,
    modelo,
    yearLabel,
    placaMasked,
    kmLabel:
      vehicle.km != null
        ? `${Number(vehicle.km).toLocaleString("pt-BR")} km`
        : "",
    cor,
    combustivel,
    cambio,
    motor,
    chassiMasked: "",
    issuedAt: dataHora,
    consultaId: consultaId || undefined,
    dataHoraConsulta: dataHora || undefined,
    tipoChave: tipoChave || undefined,
    listingUrl: `${origin}/laudo/${slug}`,
    sourcePdfUrl:
      protocol?.sourcePdfUrl || resolveIcheckAttachment(vehicle)?.url,
    sourceLabel: protocol?.sourceLabel,
    dekraLogoPath: brandUrl("dekra.png"),
    checkautoLogoPath: brandUrl("checkauto.png"),
    partnerLogosPath: brandUrl("checkauto-dekra.png"),
    netcarLogoPath: brandUrl("netcar.png"),
    checkIconPath: brandUrl("check-ok.png"),
    heroPhotos: [heroA, heroB].filter(Boolean),
    galleryPhotos: gallery,
    specs: [
      { label: "Ano", value: yearLabel },
      { label: "Cor", value: cor },
      {
        label: "Km",
        value:
          vehicle.km != null
            ? `${Number(vehicle.km).toLocaleString("pt-BR")} km`
            : "",
      },
      { label: "Motor", value: motor },
      {
        label: "Potência",
        value: vehicle.potencia ? `${vehicle.potencia} cv` : "",
      },
      { label: "Combustível", value: combustivel },
      { label: "Câmbio", value: cambio },
      {
        label: "Portas",
        value: vehicle.portas != null ? String(vehicle.portas) : "",
      },
    ].filter((s) => s.value && s.value !== "—"),
    optionals,
    history,
    historyAvailable: history.some((item) => item.riskLevel !== "unknown"),
    allClear: summary.level === "clear",
    consultationHighlights: protocol?.consultationHighlights,
    consultationSections: protocol?.consultationSections,
  };
}

/** Browser decodes AVIF/WebP, while react-pdf receives only small JPEGs. */
async function compressedPhoto(source: string): Promise<string | null> {
  const candidates = [
    ...new Set([
      optimizeStockImage(stockGalleryPreviewSource(source), 800),
      source,
    ]),
  ];
  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let objectUrl = "";
    try {
      const response = await fetch(candidate, { signal: controller.signal });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (
        !/^image\/(?:png|jpe?g|webp|avif)$/i.test(blob.type) ||
        blob.size > 25 * 1024 * 1024
      )
        continue;
      objectUrl = URL.createObjectURL(blob);
      const photo = new window.Image();
      photo.src = objectUrl;
      await photo.decode();
      if (!photo.naturalWidth || !photo.naturalHeight) continue;
      const scale = Math.min(
        1,
        800 / Math.max(photo.naturalWidth, photo.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.76);
    } catch {
      // A failed photo must not hide the consultation or break the download.
    } finally {
      window.clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }
  return null;
}

export async function prepareICheckReportImages(
  data: ICheckReportData,
): Promise<ICheckReportData> {
  const sources = [
    ...new Set(
      data.galleryPhotos.length ? data.galleryPhotos : data.heroPhotos,
    ),
  ].slice(0, 9);
  const prepared = new Map<string, string>();
  // Limit simultaneous decodes to avoid retaining nine full-size stock photos.
  for (let offset = 0; offset < sources.length; offset += 3) {
    const batch = sources.slice(offset, offset + 3);
    const results = await Promise.all(batch.map(compressedPhoto));
    results.forEach((result, index) => {
      if (result) prepared.set(batch[index], result);
    });
  }
  const galleryPhotos = sources.flatMap((source) => prepared.get(source) || []);
  return {
    ...data,
    galleryPhotos,
    heroPhotos: galleryPhotos.slice(0, 2),
    photosUnavailable: sources.length - galleryPhotos.length,
  };
}

export async function downloadICheckReportPdf(
  data: ICheckReportData,
  filename: string,
): Promise<void> {
  const blob = await renderICheckReportPdf(data);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser time to start reading the download before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** @react-pdf/layout expects the Node Buffer API even in its browser build. */
export async function renderICheckReportPdf(
  data: ICheckReportData,
): Promise<Blob> {
  if (typeof globalThis.Buffer === "undefined") {
    const { Buffer } = await import("buffer/");
    // Load only this small compatibility API, and only when a PDF is requested.
    Object.defineProperty(globalThis, "Buffer", {
      value: Buffer,
      configurable: true,
      writable: true,
    });
  }
  const prepared = await prepareICheckReportImages(data);
  const element = React.createElement(ICheckReportDocument, {
    data: prepared,
  }) as unknown as React.ReactElement<DocumentProps>;
  return pdf(element).toBlob();
}
