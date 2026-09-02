import { maskPlate } from "@/lib/slug";
import type { VehicleWhatsAppRef } from "@/lib/whatsappMessages";

/**
 * Placa mascarada (mesma que já aparece na URL da ficha). Vai junto na mensagem
 * do WhatsApp pra o vendedor identificar o carro sem perguntar de volta.
 */
export function vehicleWhatsAppRef(vehicle: {
  placa?: string;
}): VehicleWhatsAppRef {
  return {
    placa: vehicle.placa ? maskPlate(vehicle.placa) : undefined,
  };
}
