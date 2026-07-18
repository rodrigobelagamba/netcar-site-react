import React from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { maskPlate } from "@/lib/slug";
import { resolveIcheckProtocol } from "@/lib/icheck-protocol";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  ICheckReportDocument,
  type ICheckReportData,
} from "./ICheckReportDocument";
import {
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
  const tipoChave = vehicle.placa
    ? `Placa: ${placaMasked} UF: RS`
    : String(protocol?.tipoChave || "").replace(/Placa:\s*[A-Z0-9-]+/i, (m) => {
        const raw = m.replace(/^Placa:\s*/i, "");
        return `Placa: ${maskPlate(raw)}`;
      });

  // Histórico só do meta CheckAuto (normalize = mesma regra HTML/PDF)
  const history = normalizeHistoryItems(protocol?.history);

  const allClear =
    history.length === 0 ||
    history.every((item) => item.riskLevel !== "alert");

  const dataHora = protocol?.dataHoraConsulta || "";
  const consultaId =
    resolveIcheckProtocol(protocol?.protocoloConsulta, dataHora) ||
    protocol?.consultaId ||
    "";

  const optionals = (vehicle.opcionais || [])
    .map((o) => (typeof o === "string" ? o : o.descricao || o.tag || ""))
    .filter(Boolean)
    .slice(0, 28);

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
    listingUrl: `${origin}/veiculo/${slug}`,
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
    historyAvailable: history.length > 0,
    allClear,
    consultationHighlights: protocol?.consultationHighlights,
  };
}

export async function downloadICheckReportPdf(
  data: ICheckReportData,
  filename: string,
): Promise<void> {
  const element = React.createElement(ICheckReportDocument, {
    data,
  }) as unknown as React.ReactElement<DocumentProps>;
  const blob = await pdf(element).toBlob();
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
    URL.revokeObjectURL(url);
  }
}
