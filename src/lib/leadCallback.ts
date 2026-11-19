import { trackConfirmedLead } from "@/lib/analytics";
import {
  createWhatsAppClickIdentity,
  getTrafficSource,
  type TrafficSourceContext,
} from "@/lib/waTracking";

export const LEAD_CALLBACK_ENDPOINT = "/lead-callback.php";

export interface VehicleCallbackRequest {
  phone: string;
  vehicleId?: string | number;
  vehicleName: string;
  intentSummary?: string;
  pageUrl?: string;
  website?: string;
  clickId?: string;
  waRef?: string;
  traffic?: TrafficSourceContext;
}

export interface CrmLeadPayload {
  event: "lead_created";
  timestamp: string;
  data: {
    phone: string;
    name: "Lead Site";
    interest: string;
    origem: "SITE";
    canal: "Site";
    id_carro: string;
    summary: string;
  };
}

export interface VehicleCallbackResult {
  ok: boolean;
  crmConfirmed: boolean;
  dryRun?: boolean;
  duplicate?: boolean;
  leadId?: string;
  payload?: CrmLeadPayload;
  error?: string;
}

/** Normaliza telefone BR para `55` + DDD + número (10 ou 11 dígitos), ou null se inválido. */
export function normalizeBrazilCallbackPhone(raw: string): string | null {
  let digits = (raw || "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) {
    return null;
  }
  const ddd = Number(digits.slice(0, 2));
  if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) {
    return null;
  }
  if (digits.length === 11 && digits[2] !== "9") {
    return null;
  }
  if (/^(\d)\1+$/.test(digits)) {
    return null;
  }
  return `55${digits}`;
}

function cleanSingleLine(value: string | undefined, maxLength: number): string {
  return String(value ?? "")
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Monta o mesmo payload de `public/lead-callback.php` para dry-run/testes. */
export function buildCrmCallbackPayload(
  input: VehicleCallbackRequest,
  nowIso?: string,
): CrmLeadPayload | null {
  const normalizedPhone = normalizeBrazilCallbackPhone(input.phone);
  if (!normalizedPhone) return null;

  const vehicleId = String(input.vehicleId ?? "")
    .replace(/\D/g, "")
    .slice(0, 12);
  const vehicleName = cleanSingleLine(input.vehicleName, 160) || "Seminovo Netcar";
  const interest = vehicleId ? `${vehicleName} (ID ${vehicleId})` : vehicleName;

  const summaryParts = ["Pedido de retorno no site (Me chamar)."];
  const intent = cleanSingleLine(input.intentSummary, 220);
  if (intent) summaryParts.push(`Intenção: ${intent}.`);

  const pageUrl = cleanSingleLine(input.pageUrl, 260);
  if (pageUrl) summaryParts.push(`Página: ${pageUrl}.`);

  const trafficBits: string[] = [];
  const traffic = input.traffic;
  if (traffic) {
    const map: Array<[keyof TrafficSourceContext, string]> = [
      ["src", "Fonte"],
      ["campaign", "Campanha"],
      ["utmSource", "utm_source"],
      ["utmMedium", "utm_medium"],
      ["utmContent", "utm_content"],
      ["utmTerm", "utm_term"],
      ["gclid", "gclid"],
      ["gbraid", "gbraid"],
      ["wbraid", "wbraid"],
      ["fbclid", "fbclid"],
    ];
    for (const [key, label] of map) {
      const value = cleanSingleLine(traffic[key], 120);
      if (value) trafficBits.push(`${label}=${value}`);
    }
  }
  const waRef = cleanSingleLine(input.waRef, 16);
  if (waRef) trafficBits.push(`wa_ref=${waRef}`);
  const clickId = cleanSingleLine(input.clickId, 40);
  if (clickId) trafficBits.push(`click_id=${clickId}`);

  if (trafficBits.length > 0) {
    summaryParts.push(`Atribuição: ${trafficBits.join(" | ")}.`);
  }

  return {
    event: "lead_created",
    timestamp: nowIso || new Date().toISOString(),
    data: {
      phone: normalizedPhone,
      name: "Lead Site",
      interest,
      origem: "SITE",
      canal: "Site",
      id_carro: vehicleId,
      summary: cleanSingleLine(summaryParts.join(" "), 1000),
    },
  };
}

export async function submitVehicleCallbackLead(
  params: {
    phone: string;
    vehicleId?: string | number;
    vehicleName: string;
    intentSummary?: string;
    website?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<VehicleCallbackResult> {
  const normalizedPhone = normalizeBrazilCallbackPhone(params.phone);
  if (!normalizedPhone) {
    return {
      ok: false,
      crmConfirmed: false,
      error: "Informe um WhatsApp válido com DDD.",
    };
  }

  const traffic = getTrafficSource();
  const identity = createWhatsAppClickIdentity();
  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "";

  const body: VehicleCallbackRequest = {
    phone: params.phone,
    vehicleId: params.vehicleId != null ? String(params.vehicleId) : "",
    vehicleName: params.vehicleName,
    intentSummary: params.intentSummary,
    pageUrl,
    website: params.website ?? "",
    clickId: identity.clickId,
    waRef: identity.waRef,
    traffic,
  };

  try {
    const response = await fetchImpl(LEAD_CALLBACK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!response.ok || !data || data.ok !== true) {
      return {
        ok: false,
        crmConfirmed: false,
        error:
          (typeof data?.error === "string" && data.error) ||
          "Não foi possível confirmar o pedido agora. Chame direto no WhatsApp.",
      };
    }

    const crmConfirmed = data.crm_confirmed === true;
    const dryRun = data.dry_run === true;
    const duplicate = data.duplicate === true;
    const leadId = typeof data.lead_id === "string" ? data.lead_id : undefined;

    if (crmConfirmed && leadId) {
      trackConfirmedLead({
        leadId,
        leadType: "vehicle_callback",
        clickId: identity.clickId,
        waRef: identity.waRef,
      });
    }

    return {
      ok: true,
      crmConfirmed,
      dryRun,
      duplicate,
      leadId,
      payload:
        dryRun && data.payload && typeof data.payload === "object"
          ? (data.payload as CrmLeadPayload)
          : undefined,
    };
  } catch {
    return {
      ok: false,
      crmConfirmed: false,
      error: "Sem conexão no momento. Chame direto no WhatsApp.",
    };
  }
}
