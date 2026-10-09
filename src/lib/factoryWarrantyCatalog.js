import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => (typeof value === "string" ? value : undefined);
const number = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const timestamp = (value) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
const validUnitKey = (value) =>
  typeof value === "string" && /^(vin|plate)-sha256:[a-f0-9]{64}$/.test(value)
    ? value
    : undefined;

/** Hash locally; raw chassis/plate identifiers never enter the projection. */
export function factoryWarrantyUnitKey(vehicle) {
  if (!object(vehicle)) return undefined;
  const chassis = vehicle.chassi;
  const vinAbsent =
    chassis == null || (typeof chassis === "string" && chassis.trim() === "");
  if (!vinAbsent) {
    const vin = typeof chassis === "string" ? chassis.trim().toUpperCase() : "";
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return undefined;
    return `vin-sha256:${bytesToHex(sha256(vin))}`;
  }
  const plate =
    typeof vehicle.placa === "string" ? vehicle.placa.trim().toUpperCase() : "";
  if (!/^(?:[A-Z]{3}-?\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/.test(plate))
    return undefined;
  return `plate-sha256:${bytesToHex(sha256(plate.replace("-", "")))}`;
}

function snapshotMatchesEnvelope(vehicle, source) {
  if (typeof source.id !== "string" || source.id !== vehicle.id) return false;
  const fields = [
    ["marca", "marca"],
    ["modelo", "modelo"],
    ["motor", "motor"],
    ["cambio", "cambio"],
    ["ano", "year"],
    ["ano_fabricacao", "anoFabricacao"],
    ["km", "km"],
    ["valor", "price"],
  ];
  if (
    fields.some(
      ([outer, inner]) =>
        Object.hasOwn(vehicle, outer) && vehicle[outer] !== source[inner],
    )
  )
    return false;
  // Caches intentionally omit administrative identifiers and retain the hash.
  const rawKey = factoryWarrantyUnitKey(vehicle);
  const chassisPresent = vehicle.chassi != null && vehicle.chassi !== "";
  if (chassisPresent && !rawKey) return false;
  // A cache may retain a plate after dropping the VIN. Do not compare hashes
  // from different namespaces when the weaker plate cannot verify that VIN.
  if (
    rawKey &&
    (rawKey.startsWith("vin-") ||
      !validUnitKey(source.unitKey)?.startsWith("vin-")) &&
    rawKey !== source.unitKey
  )
    return false;
  if (Object.hasOwn(vehicle, "diferenciais")) {
    const marked = (items) =>
      Array.isArray(items) &&
      items.some((item) => item?.tag === "garantia_fabrica");
    if (marked(vehicle.diferenciais) !== marked(source.diferenciais))
      return false;
  }
  return true;
}

/** Preserve original gate fields; cache/build reuse must not renew observedAt. */
export function factoryWarrantyCatalogFromApi(vehicle, { observedAt } = {}) {
  if (!object(vehicle)) return null;
  const preserved = Object.hasOwn(vehicle, "factoryWarrantyVehicle");
  const source = preserved
    ? vehicle.factoryWarrantyVehicle
    : {
        id: vehicle.id,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        motor: vehicle.motor,
        cambio: vehicle.cambio,
        year: vehicle.ano,
        anoFabricacao: vehicle.ano_fabricacao,
        km: vehicle.km,
        price: vehicle.valor,
        diferenciais: vehicle.diferenciais,
        unitKey: factoryWarrantyUnitKey(vehicle),
        observedAt,
      };
  if (
    !object(source) ||
    (preserved && !snapshotMatchesEnvelope(vehicle, source))
  )
    return null;
  return {
    id: text(source.id),
    marca: text(source.marca),
    modelo: text(source.modelo),
    motor: text(source.motor),
    cambio: text(source.cambio),
    year: number(source.year),
    anoFabricacao: number(source.anoFabricacao),
    km: number(source.km),
    price: number(source.price),
    unitKey: validUnitKey(source.unitKey),
    observedAt: timestamp(source.observedAt),
    diferenciais: (Array.isArray(source.diferenciais)
      ? source.diferenciais
      : []
    )
      .filter((item) => item?.tag === "garantia_fabrica")
      .map(() => ({ tag: "garantia_fabrica", descricao: "" })),
  };
}
