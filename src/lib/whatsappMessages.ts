import { formatWhatsAppNumber } from "@/lib/formatters";

export const SITE_WHATSAPP_PREFIX = "Estava olhando o site da Netcar e";

/** Prefixo padrão para identificar leads vindos do site (filtro no WhatsApp). */
export function siteWhatsAppMessage(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return `${SITE_WHATSAPP_PREFIX} gostaria de mais informações.`;
  }
  if (trimmed.startsWith(SITE_WHATSAPP_PREFIX)) {
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }
  const normalized = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `${SITE_WHATSAPP_PREFIX} ${normalized.endsWith(".") ? normalized : `${normalized}.`}`;
}

export function resolveSiteWhatsAppMessage(apiMessage?: string): string {
  const body = apiMessage?.trim() || "gostaria de mais informações.";
  return siteWhatsAppMessage(body);
}

export function buildWhatsAppUrl(numero: string, message: string): string {
  const formattedNumber = formatWhatsAppNumber(numero);
  return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
}

export function vehicleWhatsAppMessages(
  vehicleLabel: string,
  modeloCompleto?: string,
) {
  return {
    info: siteWhatsAppMessage(`quero mais informações sobre o ${vehicleLabel}.`),
    finance: siteWhatsAppMessage(
      `quero simular o financiamento do ${vehicleLabel}.`,
    ),
    visit: siteWhatsAppMessage(
      `quero agendar uma visita para ver o ${vehicleLabel}.`,
    ),
    trade: siteWhatsAppMessage(
      modeloCompleto
        ? `quero avaliar meu usado na troca do ${modeloCompleto}.`
        : "quero avaliar meu usado na troca.",
    ),
    photos: siteWhatsAppMessage(
      `quero ver mais fotos ou vídeo do ${vehicleLabel}.`,
    ),
  };
}

export function contactFormWhatsAppMessage(form: {
  nome: string;
  email: string;
  telefone: string;
  assunto: string;
  mensagem: string;
}): string {
  return `${SITE_WHATSAPP_PREFIX} enviei este contato pelo site:

*Nome:* ${form.nome}
*Email:* ${form.email}
*Telefone:* ${form.telefone}
*Assunto:* ${form.assunto}

*Mensagem:*
${form.mensagem}`;
}

export function quickSellWhatsAppMessage(details: {
  modelo?: string;
  ano?: string;
  km?: string;
  cityName?: string;
}): string {
  const lines = [
    siteWhatsAppMessage("quero avaliar meu carro para venda:"),
  ];
  if (details.modelo?.trim()) lines.push(`Modelo: ${details.modelo.trim()}`);
  if (details.ano?.trim()) lines.push(`Ano: ${details.ano.trim()}`);
  if (details.km?.trim()) lines.push(`KM: ${details.km.trim()}`);
  if (details.cityName) lines.push(`Cidade: ${details.cityName}`);
  return lines.join("\n");
}
