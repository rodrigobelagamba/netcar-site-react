import { z } from "zod";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { maskPlate } from "./slug";
import { resolveIcheckProtocol } from "./icheck-protocol";
import {
  canonicalHistoryKey,
  normalizeHistoryItems,
  type ICheckHistoryItem,
} from "@/reports/icheck/icheckHistory";

const SITE_ORIGIN = "https://www.netcarmultimarcas.com.br";
const TRUSTED_HOSTS = new Set([
  "www.netcarmultimarcas.com.br",
  "netcarmultimarcas.com.br",
]);
type AttachmentVehicle = Pick<
  Vehicle,
  "pdf" | "pdf_url" | "icheckAttachmentInvalid"
>;
type MetadataVehicle = AttachmentVehicle & Pick<Vehicle, "id" | "placa">;

export type ICheckAttachment = {
  filename: string;
  url: string;
  metadataUrl: string;
};

/** Only local PDF attachments are eligible for i-CHECK. Never link executable or external files. */
export function resolveIcheckAttachment(
  vehicle: AttachmentVehicle,
): ICheckAttachment | null {
  const filenameIsSafe = (value: string) =>
    /^[a-zA-Z0-9][a-zA-Z0-9_ ().-]*\.pdf$/i.test(value) &&
    !value.includes("..");
  const suppliedName = String(vehicle.pdf || "").trim();
  if (suppliedName && !filenameIsSafe(suppliedName)) return null;
  const raw = String(
    vehicle.pdf_url ||
      (suppliedName ? `/arquivos/autocheck/${suppliedName}` : ""),
  ).trim();
  if (!raw || raw.includes("\\")) return null;
  try {
    const url = new URL(raw.replace(/^\.\//, "/"), SITE_ORIGIN);
    if (
      url.protocol !== "https:" ||
      !TRUSTED_HOSTS.has(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    const decoded = decodeURIComponent(url.pathname);
    if (!decoded.startsWith("/arquivos/autocheck/")) return null;
    const filename = decoded.slice("/arquivos/autocheck/".length);
    if (
      !filenameIsSafe(filename) ||
      (suppliedName && suppliedName !== filename)
    )
      return null;
    return {
      filename,
      url: url.href,
      metadataUrl: `/arquivos/autocheck/${encodeURIComponent(filename.replace(/\.pdf$/i, ".meta.json"))}`,
    };
  } catch {
    return null;
  }
}

const textField = z.string().max(2000);
const detailItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  value: textField,
});
const detailSectionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  items: z.array(detailItemSchema).max(100),
});
const metadataSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  vehicleId: z.string().min(1).max(100),
  placa: z.string().min(1).max(30),
  pdf: z.string().min(1).max(255),
  source: z
    .enum([
      "public-pdf",
      "checkauto-pdf",
      "checkauto-xml",
      "automacar-pdf",
      "unavailable",
    ])
    .optional(),
  available: z.boolean().optional(),
  identity: z.object({ verified: z.boolean() }).optional(),
  sourceSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .nullish(),
  consultaId: z.string().max(100).nullish(),
  protocoloConsulta: z.string().max(100).nullish(),
  dataHoraConsulta: z.string().max(40).nullish(),
  uf: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullish(),
  history: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(100),
        label: z.string().trim().min(1).max(200),
        status: textField.nullable(),
        hint: textField.optional(),
        clear: z.boolean().optional(),
        riskLevel: z.string().max(30).optional(),
      }),
    )
    .max(50),
  consultationHighlights: z.array(detailItemSchema).max(100).optional(),
  consultationSections: z.array(detailSectionSchema).max(30).optional(),
});

export type CheckAutoProtocolMeta = {
  vehicleId: string;
  placa: string;
  pdf: string;
  consultaId: string | null;
  protocoloConsulta: string | null;
  dataHoraConsulta: string | null;
  tipoChave: string | null;
  history: ICheckHistoryItem[];
  sourcePdfUrl: string;
  sourceLabel: string;
  consultationHighlights?: Array<{ label: string; value: string }>;
  consultationSections?: Array<{
    title: string;
    items: Array<{ label: string; value: string }>;
  }>;
};

function normalizePlate(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function consultationDate(value: string): Date | null {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return null;
  const [, d, m, y, h = "00", min = "00", sec = "00"] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d, +h + 3, +min, +sec));
  // Calendar checks independent of the +03:00 conversion to UTC.
  const calendar = new Date(Date.UTC(+y, +m - 1, +d));
  if (
    calendar.getUTCFullYear() !== +y ||
    calendar.getUTCMonth() !== +m - 1 ||
    calendar.getUTCDate() !== +d ||
    +h > 23 ||
    +min > 59 ||
    +sec > 59
  )
    return null;
  return date;
}

export function getConsultationAgeDays(
  value: string | null | undefined,
  now = new Date(),
): number | null {
  const date = value ? consultationDate(value.trim()) : null;
  return date
    ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
    : null;
}

export function validateIcheckMetadata(
  value: unknown,
  vehicle: MetadataVehicle,
): CheckAutoProtocolMeta | null {
  const attachment = resolveIcheckAttachment(vehicle);
  const parsed = metadataSchema.safeParse(value);
  if (!attachment || !parsed.success) return null;
  const meta = parsed.data;
  const plate = normalizePlate(String(vehicle.placa || ""));
  if (
    !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) ||
    normalizePlate(meta.placa) !== plate ||
    meta.vehicleId !== String(vehicle.id) ||
    meta.pdf !== attachment.filename
  )
    return null;
  const normalizedHistory = normalizeHistoryItems(meta.history);
  const hasResult = normalizedHistory.some(
    ({ riskLevel }) => riskLevel !== "unknown",
  );
  const isUnavailable =
    meta.source === "unavailable" || meta.available === false;
  if ((isUnavailable || meta.identity?.verified === false) && hasResult)
    return null;
  if (
    meta.schemaVersion === 2 &&
    !isUnavailable &&
    (!meta.sourceSha256 ||
      !meta.source ||
      meta.identity?.verified !== true ||
      meta.available !== true)
  )
    return null;
  const keys = meta.history.map(({ key }) => canonicalHistoryKey(key));
  if (new Set(keys).size !== keys.length) return null;
  const dataHoraConsulta = meta.dataHoraConsulta?.trim() || null;
  if (dataHoraConsulta && !consultationDate(dataHoraConsulta)) return null;
  // A result without its consultation date cannot safely be presented as validated.
  if (
    !dataHoraConsulta &&
    meta.history.some(
      ({ status }) =>
        status && !/indispon[ií]vel|n[aã]o\s+consultad/i.test(status),
    )
  )
    return null;
  const consultaId = resolveIcheckProtocol(meta.consultaId, dataHoraConsulta);
  const protocoloConsulta = resolveIcheckProtocol(
    meta.protocoloConsulta,
    dataHoraConsulta,
  );
  return {
    vehicleId: meta.vehicleId,
    placa: plate,
    pdf: meta.pdf,
    consultaId,
    protocoloConsulta,
    dataHoraConsulta,
    tipoChave: `Placa: ${maskPlate(plate)}${meta.uf ? ` UF: ${meta.uf}` : ""}`,
    history: normalizedHistory,
    sourcePdfUrl: attachment.url,
    sourceLabel:
      meta.source === "checkauto-xml"
        ? "Retorno CheckAuto / DEKRA associado ao certificado"
        : "Certificado CheckAuto / DEKRA anexado",
    consultationHighlights: meta.consultationHighlights?.filter(
      (detail) =>
        !meta.history.some(
          (item) =>
            item.label.trim().toLocaleLowerCase("pt-BR") ===
              detail.label.trim().toLocaleLowerCase("pt-BR") &&
            item.status === detail.value,
        ),
    ),
    consultationSections: meta.consultationSections,
  };
}

export type ICheckMetadataResult = {
  status:
    | "ready"
    | "no_pdf"
    | "invalid_attachment"
    | "unavailable"
    | "invalid_metadata";
  protocol: CheckAutoProtocolMeta | null;
};

/** A shared, bounded request prevents stale identity/data from being reused across vehicles. */
export async function loadIcheckMetadata(
  vehicle: MetadataVehicle,
  signal?: AbortSignal,
): Promise<ICheckMetadataResult> {
  const attachment = resolveIcheckAttachment(vehicle);
  if (!attachment)
    return {
      status:
        vehicle.icheckAttachmentInvalid || vehicle.pdf || vehicle.pdf_url
          ? "invalid_attachment"
          : "no_pdf",
      protocol: null,
    };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 12_000);
  try {
    const response = await fetch(attachment.metadataUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { status: "unavailable", protocol: null };
    const contentType = response.headers.get("content-type") || "";
    if (!/application\/(?:[a-z.+-]*\+)?json/i.test(contentType))
      return { status: "invalid_metadata", protocol: null };
    const body = await response.text();
    if (body.length > 512_000)
      return { status: "invalid_metadata", protocol: null };
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return { status: "invalid_metadata", protocol: null };
    }
    const protocol = validateIcheckMetadata(json, vehicle);
    return { status: protocol ? "ready" : "invalid_metadata", protocol };
  } catch {
    return { status: "unavailable", protocol: null };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
