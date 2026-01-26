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
