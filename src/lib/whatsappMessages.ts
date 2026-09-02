import { formatWhatsAppNumber } from "@/lib/formatters";

export const SITE_WHATSAPP_PREFIX = "Estava olhando o site da Netcar e";
export const DEFAULT_SALES_WHATSAPP = "5551997293118";

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

export type VehicleWhatsAppRef = {
  placa?: string;
};

/**
 * Anexa a placa (mascarada, a mesma da URL) à mensagem. Sem isso o vendedor
 * recebe só "Corolla 2022" e precisa perguntar qual dos Corollas.
 * O código de rastreio ` - (X...)` é anexado depois, no clique, por
 * appendWaRefToUrl — esta função não mexe nele.
 */
export function withVehicleRef(
  message: string,
  ref?: VehicleWhatsAppRef,
): string {
  const placa = ref?.placa?.trim();
  if (!placa) return message;
  return `${message}\nPlaca: ${placa.toUpperCase()}`;
}

export function vehicleWhatsAppMessages(
  vehicleLabel: string,
  modeloCompleto?: string,
  ref?: VehicleWhatsAppRef,
) {
  const msg = (body: string) => withVehicleRef(siteWhatsAppMessage(body), ref);

  return {
    info: msg(`quero mais informações sobre o ${vehicleLabel}.`),
    finance: msg(
      `quero simular o financiamento do ${vehicleLabel} e comparar condições entre os bancos e financeiras parceiras.`,
    ),
    visit: msg(`quero agendar uma visita para ver o ${vehicleLabel}.`),
    trade: msg(
      modeloCompleto
        ? `quero avaliar meu carro na troca do ${modeloCompleto}.`
        : "quero avaliar meu carro na troca.",
    ),
    photos: msg(`quero ver mais fotos ou vídeo do ${vehicleLabel}.`),
    km: msg(`quero saber mais sobre a quilometragem do ${vehicleLabel}.`),
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
  evaluationType?: "direct_purchase" | "trade_in";
}): string {
  const isTrade = details.evaluationType === "trade_in";
  const lines = [
    siteWhatsAppMessage(
      isTrade
        ? "quero avaliar meu carro para usar na troca:"
        : "quero avaliar meu carro para venda direta à Netcar:",
    ),
    `Negociação: ${isTrade ? "Usar na troca" : "Venda direta à Netcar"}`,
  ];
  if (details.modelo?.trim()) lines.push(`Modelo: ${details.modelo.trim()}`);
  if (details.ano?.trim()) lines.push(`Ano: ${details.ano.trim()}`);
  if (details.km?.trim()) lines.push(`KM: ${details.km.trim()}`);
  if (details.cityName) lines.push(`Cidade: ${details.cityName}`);
  return lines.join("\n");
}

/** Mensagens de conversão da Home e curadoria de estoque. */
export function homeWhatsAppMessages(options?: { vehicleLabel?: string }) {
  const label = options?.vehicleLabel?.trim();

  return {
    vehicleInterest: label
      ? siteWhatsAppMessage(`tenho interesse no ${label}.`)
      : siteWhatsAppMessage(
          "quero ajuda para escolher um seminovo do estoque.",
        ),
    simulateFinance: siteWhatsAppMessage(
      label
        ? `quero simular entrada e parcelas do ${label}, comparando condições entre os bancos e financeiras parceiras.`
        : "quero simular entrada e parcelas de um seminovo, comparando condições entre os bancos e financeiras parceiras.",
    ),
    similarOptions: siteWhatsAppMessage(
      label
        ? `quero receber opções parecidas com o ${label}.`
        : "quero receber opções de seminovos parecidos com meu perfil.",
    ),
    talkToIan: siteWhatsAppMessage(
      "quero falar com o assistente iAN para me ajudar a procurar um carro.",
    ),
    visitStore: siteWhatsAppMessage(
      "quero agendar uma visita na loja de Esteio para ver seminovos.",
    ),
    askKm: siteWhatsAppMessage(
      label
        ? `quero saber mais sobre a quilometragem do ${label}.`
        : "quero saber mais sobre a quilometragem de um seminovo.",
    ),
  };
}
