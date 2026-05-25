/**
 * Constrói uma URL do Google Maps a partir de um endereço em texto livre,
 * opcionalmente fixando o pino em coordenadas exatas (lat/lng).
 *
 * - Sem coordenadas: usa `/maps/search/?api=1&query=...`, que deixa o Google
 *   geocodificar o endereço.
 * - Com coordenadas: usa o padrão `/maps/search/<texto>/@<lat>,<lng>,18z`,
 *   que é o que o próprio Maps gera quando você clica em "Compartilhar" após
 *   pesquisar um local. Isso garante que o pino caia exatamente no ponto certo.
 *
 * Em ambos os formatos, o link abre o **app nativo do Google Maps no mobile**
 * (Android/iOS) e o **Maps web no desktop**, sem precisar de detecção de
 * user agent.
 */
export function buildMapsUrl(
  address: string,
  coords?: { lat: number; lng: number }
): string {
  const cleaned = (address || "").trim();
  if (!cleaned && !coords) {
    return "https://maps.google.com/?q=Netcar+Esteio";
  }

  const query = encodeURIComponent(cleaned || "Netcar Esteio");

  if (coords) {
    return `https://www.google.com/maps/search/${query}/@${coords.lat},${coords.lng},18z`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Coordenadas conhecidas de cada loja. Usadas como pino fixo no Google Maps
 * para garantir que o link sempre abra exatamente no endereço correto, sem
 * depender de geocodificação fuzzy.
 *
 * Fonte: URLs de compartilhamento do próprio Google Maps.
 *
 * Quando uma loja ainda não tem coordenadas confirmadas, ela fica como
 * `undefined` e o link cai no fluxo de busca por endereço (que costuma
 * resolver bem desde que o número da rua seja único).
 */
export const LOJA_COORDS: {
  Loja1?: { lat: number; lng: number };
  Loja2?: { lat: number; lng: number };
} = {
  Loja1: { lat: -29.8395968, lng: -51.1711853 },
  // TODO: confirmar coordenadas da Loja 2 (Av. Getúlio Vargas, 1106) via "Compartilhar" no Google Maps
  Loja2: undefined,
};

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatKm(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + " km";
}

export function formatYear(value: number): string {
  return value.toString();
}

/**
 * Formata um número de telefone para uso em links do WhatsApp, garantindo o prefixo 55 (Brasil)
 * @param phoneNumber - Número de telefone em qualquer formato
 * @returns Número formatado com prefixo 55 (apenas dígitos)
 */
export function formatWhatsAppNumber(phoneNumber: string): string {
  if (!phoneNumber) return "";
  
  // Remove todos os caracteres não numéricos
  const cleaned = phoneNumber.replace(/\D/g, "");
  
  // Se já começa com 55, retorna como está
  if (cleaned.startsWith("55")) {
    return cleaned;
  }
  
  // Se tem 10 ou 11 dígitos (formato brasileiro sem código do país), adiciona 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  
  // Se tem menos de 10 dígitos ou mais de 13, retorna como está (pode ser inválido)
  return cleaned;
}
