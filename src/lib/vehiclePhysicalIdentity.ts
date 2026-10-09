import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

/** Bind a supplier listing to the supplied plate without persisting its raw
 * identifier. This is pseudonymization, not a VIN lookup or proof of ownership.
 * Keep the ASCII preimage/normalization in sync with vehicle-equipment.php. */
export function vehiclePhysicalIdentityKey(vehicleId: unknown, plate: unknown): string | null {
  if (typeof vehicleId !== "string" && !(typeof vehicleId === "number" && Number.isSafeInteger(vehicleId) && vehicleId >= 0)) return null;
  const id = String(vehicleId).replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, "");
  if (!/^\d{1,20}$/.test(id) || typeof plate !== "string") return null;
  const normalized = plate.replace(/[ \t\r\n\f\v-]/g, "");
  if (!/^[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}$/.test(normalized)) return null;
  const preimage = `netcar-physical-unit-v1\0${id}\0${normalized.toUpperCase()}`;
  return bytesToHex(sha256(new TextEncoder().encode(preimage)));
}
