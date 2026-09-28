import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveVehicleEquipment,
  unitEquipmentConfirmations,
  isApprovedUnitEquipmentConfirmation,
} from "../src/lib/vehicleEquipment";
import { mapVehicleOptional } from "../src/catalog/lib/mapVehicleOptional";
import { readSeoBuildStockSnapshot } from "./lib/seo-stock-cache.js";

export const EQUIPMENT_SEO_SCHEMA = 2;
type RawVehicle = Record<string, unknown>;
export interface EquipmentSeoManifest {
  schemaVersion: number;
  generatedAt: string;
  /** Present even without a complete stock snapshot: raw API fallback must not
   * restore equipment that was explicitly denied for a reviewed unit. */
  confirmedVehicleIds: string[];
  vehicles: Record<string, { fingerprint: string; descriptions: string[] }>;
}

function scalar(value: unknown): string | null {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "boolean")
    return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** ASCII-only JSON preimage: identical PHP/JS serialization even for accents,
 * emoji, slashes, U+2028/U+2029 and composed/decomposed Unicode. The original
 * optional order is intentional: any uncertain input difference is a miss. */
export function equipmentFingerprint(vehicle: RawVehicle): string | null {
  if (!Array.isArray(vehicle.opcionais)) return null;
  const values = [
    vehicle.id,
    vehicle.marca,
    vehicle.modelo,
    vehicle.ano,
    vehicle.ano_fabricacao,
    vehicle.motor,
    vehicle.cambio,
    vehicle.lugares,
  ].map(scalar);
  if (values.some((value) => value === null)) return null;
  const encode = (value: string) =>
    Buffer.from(value, "utf8").toString("base64");
  const options: string[][] = [];
  for (const optional of vehicle.opcionais) {
    if (typeof optional === "string") options.push(["s", encode(optional)]);
    else if (
      optional &&
      typeof optional === "object" &&
      !Array.isArray(optional)
    ) {
      const record = optional as Record<string, unknown>;
      const fields = [record.tag, record.descricao, record.nome].map(scalar);
      if (fields.some((value) => value === null)) return null;
      options.push(["o", ...fields.map((value) => encode(value!))]);
    } else return null;
  }
  return createHash("sha256")
    .update(
      JSON.stringify([
        "netcar-equipment-v1",
        ...values.map((value) => encode(value!)),
        options,
      ]),
    )
    .digest("hex");
}

export function createEquipmentManifest(
  vehicles: RawVehicle[],
  generatedAt = new Date().toISOString(),
): EquipmentSeoManifest {
  const manifest: EquipmentSeoManifest = {
    schemaVersion: EQUIPMENT_SEO_SCHEMA,
    generatedAt,
    confirmedVehicleIds: [
      ...new Set(
        unitEquipmentConfirmations
          .filter(isApprovedUnitEquipmentConfirmation)
          .map((record) => String(record.match.vehicleId)),
      ),
    ].sort(),
    vehicles: {},
  };
  for (const vehicle of vehicles) {
    if (vehicle.equipmentSourceComplete !== true) continue;
    const id = scalar(vehicle.id);
    const fingerprint = equipmentFingerprint(vehicle);
    if (!id || !/^\d+$/.test(id) || !fingerprint) continue;
    const text = (value: unknown) => scalar(value) || "";
    const resolved = resolveVehicleEquipment({
      id,
      marca: text(vehicle.marca),
      modelo: text(vehicle.modelo),
      name: `${text(vehicle.marca)} ${text(vehicle.modelo)}`,
      year: text(vehicle.ano),
      anoFabricacao: text(vehicle.ano_fabricacao),
      motor: text(vehicle.motor),
      cambio: text(vehicle.cambio),
      lugares: text(vehicle.lugares),
      opcionais: (
        vehicle.opcionais as Array<string | Record<string, unknown>>
      ).map((optional) =>
        mapVehicleOptional(
          typeof optional === "string"
            ? optional
            : {
                tag: text(optional.tag),
                descricao: text(optional.descricao),
                nome: text(optional.nome),
              },
        ),
      ),
    });
    manifest.vehicles[id] = {
      fingerprint,
      descriptions: resolved.items.map((item) => item.description),
    };
  }
  return manifest;
}

export function generateEquipmentSeo(rootDir: string): EquipmentSeoManifest {
  // No second API request: reuse exactly the stock frozen by generate-landings.
  const snapshot = readSeoBuildStockSnapshot(rootDir, { includeSold: true });
  const manifest = createEquipmentManifest(snapshot?.vehicles || []);
  const output = resolve(rootDir, "public/seo/vehicle-equipment.json");
  mkdirSync(dirname(output), { recursive: true });
  // Always replace the previous manifest, including when input is incomplete.
  writeFileSync(output, `${JSON.stringify(manifest)}\n`, "utf8");
  const count = Object.keys(manifest.vehicles).length;
  if (!count)
    console.warn(
      "Opcionais SEO: fonte completa ausente; unidades com confirmação revisada ficarão sem lista SEO até o próximo build completo.",
    );
  else
    console.log(
      `Opcionais SEO: ${count} veículos resolvidos com a mesma regra do frontend.`,
    );
  return manifest;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  generateEquipmentSeo(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}
