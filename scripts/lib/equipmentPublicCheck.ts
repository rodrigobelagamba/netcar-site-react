import { createHash } from "node:crypto";
import { buildVehicleDescription } from "../../src/modules/detalhes/lib/vehicleDescription";
import { buildVehicleHighlights } from "../../src/modules/detalhes/lib/vehicleHighlights";
import {
  definitionForEquipmentTag,
  normalizeEquipmentTag,
  resolveVehicleEquipment,
  type EquipmentVehicle,
} from "../../src/lib/vehicleEquipment";
import { discoveryVehicleFingerprint } from "./equipmentDiscovery";
import type { ReviewSnapshot, ReviewStockVehicle } from "./equipmentReview";

export const PUBLIC_CHECK_TIMEZONE = "America/Sao_Paulo";
export const PUBLIC_CHECK_MAX_MS = 20 * 60 * 1000;
export const PUBLIC_CHECK_MAX_BYTES = 10 * 1024 * 1024;
export const PUBLIC_CHECK_ORIGIN = "https://www.netcarmultimarcas.com.br";
export interface PublicCheckState {
  schemaVersion: 1;
  lastAttempt: string | null;
  lastSuccess: string | null;
  period: string | null;
  status: "running" | "succeeded" | "failed";
  error: string | null;
  nextRun: string;
}
export interface PublicEquipmentObservation {
  observedAt: string;
  descriptionText: string;
  equipmentNames: string[];
  highlights: Array<{ name: string; category: string; benefit: string }>;
  servedAssets: string[];
}
export interface PublicEquipmentBrowser {
  observe(vehicleId: string): Promise<PublicEquipmentObservation>;
  close(): Promise<void>;
}
export interface PublicCheckVehicle {
  vehicleId: string;
  publicUrl: string;
  model: string;
  status: "passed" | "divergent" | "inconclusive";
  differences: string[];
  observedAt?: string;
  stockFingerprint?: string;
  expectedSha256?: string;
  observedSha256?: string;
  servedAssets?: string[];
}
export interface PublicCheckReport {
  schemaVersion: 1;
  generatedAt: string;
  counts: {
    vehicles: number;
    passed: number;
    divergent: number;
    inconclusive: number;
  };
  vehicles: PublicCheckVehicle[];
}
export const normalizePublicText = (text: string) =>
  text.normalize("NFC").replace(/\s+/gu, " ").trim();
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** A period begins on Monday at 09:00 in São Paulo, including restart catch-up. */
export function publicCheckPeriod(now: Date): {
  period: string;
  nextRun: string;
} {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Data da conferência inválida.");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PUBLIC_CHECK_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const localDate = new Date(
    `${parts.year}-${parts.month}-${parts.day}T00:00:00Z`,
  );
  let days = (localDate.getUTCDay() + 6) % 7;
  if (days === 0 && Number(parts.hour) < 9) days = 7;
  localDate.setUTCDate(localDate.getUTCDate() - days);
  const period = localDate.toISOString().slice(0, 10);
  localDate.setUTCDate(localDate.getUTCDate() + 7);
  // Convert the next local 09:00 using the named zone, without assuming its UTC offset.
  const target = new Date(`${localDate.toISOString().slice(0, 10)}T09:00:00Z`);
  let instant = target.getTime();
  for (let i = 0; i < 3; i++) {
    const zoned = new Intl.DateTimeFormat("sv-SE", {
      timeZone: PUBLIC_CHECK_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(new Date(instant));
    instant += target.getTime() - Date.parse(`${zoned.replace(" ", "T")}Z`);
  }
  return { period, nextRun: new Date(instant).toISOString() };
}

export function publicCheckDue(
  state: PublicCheckState | null,
  now: Date,
  force = false,
): boolean {
  return force || state?.period !== publicCheckPeriod(now).period;
}

export function toDescriptionVehicle(
  vehicle: ReviewStockVehicle,
  fuel: string,
): EquipmentVehicle & { combustivel: string } {
  return {
    id: vehicle.id,
    marca: vehicle.brand,
    modelo: vehicle.model,
    year: vehicle.modelYear ?? "",
    anoFabricacao: vehicle.manufactureYear ?? undefined,
    motor: vehicle.engine,
    cambio: vehicle.transmission,
    combustivel: fuel,
    lugares: vehicle.seats,
    market: vehicle.market ?? undefined,
    physicalIdentityKey: vehicle.physicalIdentityKey,
    opcionais: vehicle.options,
  };
}

export function publicVehicleFingerprint(
  vehicle: ReviewStockVehicle,
  fuel: string,
): string {
  return hash([
    discoveryVehicleFingerprint(vehicle),
    vehicle.market,
    vehicle.seats,
    normalizePublicText(fuel),
    vehicle.xml?.identity ?? null,
    Object.entries(vehicle.xml?.flags ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  ]);
}

export function expectedPublicEquipment(
  vehicle: ReviewStockVehicle,
  fuel: string,
) {
  const input = toDescriptionVehicle(vehicle, fuel);
  const description = buildVehicleDescription(input);
  if (!description)
    throw new Error("Cadastro sem descrição determinística verificável.");
  const fragments: string[] = [String(description.apresentacao ?? "")];
  for (const section of description.accordions) {
    fragments.push(section.title);
    const content = section.content;
    if (!content || typeof content !== "object" || !("itens" in content))
      throw new Error(
        "Formato da descrição mudou; revisão do auditor necessária.",
      );
    if (content.introducao) fragments.push(String(content.introducao));
    for (const item of content.itens)
      fragments.push(item.label ?? "", String(item.texto));
  }
  return {
    descriptionText: normalizePublicText(fragments.join(" ")),
    equipmentNames: resolveVehicleEquipment(input).items.map(
      (item) => item.description,
    ),
    highlights: buildVehicleHighlights(input).highlights.map((item) => ({
      name: item.title,
      category: item.category,
      benefit: item.description,
    })),
  };
}

/** Supplier differentiators are intentionally not mistaken for equipment. */
export function xmlApiDifferences(vehicle: ReviewStockVehicle): string[] {
  if (!vehicle.xml) return ["Projeção XML ausente; origem não conferida."];
  const differences: string[] = [];
  const flags = new Map(
    Object.entries(vehicle.xml.flags).map(([tag, value]) => [
      normalizeEquipmentTag(tag),
      value,
    ]),
  );
  const options = new Set(
    vehicle.options.map((item) => normalizeEquipmentTag(item.tag)),
  );
  for (const option of vehicle.options) {
    if (flags.get(normalizeEquipmentTag(option.tag)) !== true)
      differences.push(
        `Opcional API sem marcação positiva no XML: ${safePublicLabel(option.descricao || option.tag)}.`,
      );
  }
  for (const [tag, value] of Object.entries(vehicle.xml.flags)) {
    if (
      value &&
      definitionForEquipmentTag(tag) &&
      !options.has(normalizeEquipmentTag(tag))
    )
      differences.push(
        `Equipamento XML ausente dos opcionais API: ${safePublicLabel(definitionForEquipmentTag(tag)!.description)}.`,
      );
  }
  const identity = {
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    manufactureYear: vehicle.manufactureYear,
    modelYear: vehicle.modelYear,
    engine: vehicle.engine,
    transmission: vehicle.transmission,
  };
  const labels: Record<string, string> = {
    id: "código",
    brand: "marca",
    model: "modelo",
    manufactureYear: "ano de fabricação",
    modelYear: "ano-modelo",
    engine: "motor",
    transmission: "câmbio",
  };
  for (const [field, value] of Object.entries(identity)) {
    // The public API appends this explicit XML-backed engine qualifier to model
    // names. Accept only that exact suffix; never infer turbo from the model.
    if (
      field === "model" &&
      flags.get("motor_turbo") === true &&
      normalizeEquipmentTag(String(value ?? "")) ===
        normalizeEquipmentTag(`${vehicle.xml.identity.model ?? ""} TURBO`)
    )
      continue;
    if (
      normalizeEquipmentTag(String(value ?? "")) !==
      normalizeEquipmentTag(String(vehicle.xml.identity[field] ?? ""))
    )
      differences.push(`Campo ${labels[field]} diverge entre XML e API.`);
  }
  return differences;
}

export function safePublicLabel(value: string): string {
  return normalizePublicText(value)
    .slice(0, 400)
    .replace(/\b[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}\b/gi, "[identificador removido]")
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[identificador removido]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[contato removido]")
    .replace(
      /(?:\+?55\s*)?\(?\d{2}\)?[\s.-]*\d{4,5}[\s.-]*\d{4}\b/g,
      "[contato removido]",
    );
}

function contentOnly(value: string) {
  return normalizePublicText(value)
    .replace(/^Descrição do veículo\s+/, "")
    .replace(/\s+Ler menos$/, "");
}
function names(values: string[]) {
  return values.map(normalizePublicText).sort();
}
function validObservation(observation: PublicEquipmentObservation) {
  return (
    observation &&
    Number.isFinite(Date.parse(observation.observedAt)) &&
    typeof observation.descriptionText === "string" &&
    observation.descriptionText.length <= 200000 &&
    Array.isArray(observation.equipmentNames) &&
    observation.equipmentNames.length <= 500 &&
    observation.equipmentNames.every(
      (v) => typeof v === "string" && v.length > 0 && v.length <= 400,
    ) &&
    Array.isArray(observation.highlights) &&
    observation.highlights.length <= 4 &&
    observation.highlights.every((v) =>
      [v?.name, v?.category, v?.benefit].every(
        (s) => typeof s === "string" && s.length > 0 && s.length <= 1000,
      ),
    ) &&
    Array.isArray(observation.servedAssets) &&
    observation.servedAssets.length <= 200
  );
}

export function comparePublicEquipment(
  vehicle: ReviewStockVehicle,
  fuel: string,
  observation: PublicEquipmentObservation,
): PublicCheckVehicle {
  if (!validObservation(observation))
    throw new Error("Observação pública incompleta ou inválida.");
  const expected = expectedPublicEquipment(vehicle, fuel);
  const differences = xmlApiDifferences(vehicle);
  const expectedNames = names(expected.equipmentNames);
  const observedNames = names(observation.equipmentNames);
  if (JSON.stringify(expectedNames) !== JSON.stringify(observedNames)) {
    const missing = expectedNames.filter(
      (name, index, all) =>
        all.slice(0, index + 1).filter((v) => v === name).length >
        observedNames.filter((v) => v === name).length,
    );
    const extra = observedNames.filter(
      (name, index, all) =>
        all.slice(0, index + 1).filter((v) => v === name).length >
        expectedNames.filter((v) => v === name).length,
    );
    for (const label of missing)
      differences.push(
        `Equipamento esperado ausente na página: ${safePublicLabel(label)}.`,
      );
    for (const label of extra)
      differences.push(
        `Equipamento adicional ou repetido na página: ${safePublicLabel(label)}.`,
      );
  }
  const highlights = (items: typeof expected.highlights) =>
    items.map((item) => ({
      name: normalizePublicText(item.name),
      category: normalizePublicText(item.category).toLocaleLowerCase("pt-BR"),
      benefit: normalizePublicText(item.benefit),
    }));
  if (
    JSON.stringify(highlights(expected.highlights)) !==
    JSON.stringify(highlights(observation.highlights))
  )
    differences.push(
      "Nome, categoria, benefício ou ordem dos destaques difere do resolver revisado.",
    );
  if (expected.descriptionText !== contentOnly(observation.descriptionText))
    differences.push(
      "Descrição pública difere dos campos do cadastro e dos equipamentos revisados.",
    );
  const safeAssets = observation.servedAssets
    .filter((asset) => {
      if (typeof asset !== "string") return false;
      try {
        const url = new URL(asset, PUBLIC_CHECK_ORIGIN);
        return (
          url.origin === PUBLIC_CHECK_ORIGIN &&
          /^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(url.pathname) &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    })
    .map((asset) => new URL(asset, PUBLIC_CHECK_ORIGIN).pathname);
  return {
    vehicleId: vehicle.id,
    publicUrl: `${PUBLIC_CHECK_ORIGIN}/veiculo/${vehicle.id}`,
    model: safePublicLabel(vehicle.model),
    status: differences.length ? "divergent" : "passed",
    differences,
    observedAt: observation.observedAt,
    stockFingerprint: publicVehicleFingerprint(vehicle, fuel),
    expectedSha256: hash(expected),
    observedSha256: hash({
      names: observedNames,
      description: contentOnly(observation.descriptionText),
      highlights: highlights(observation.highlights),
    }),
    servedAssets: [...new Set(safeAssets)].sort(),
  };
}

export function changedPublicVehicleIds(
  before: ReviewSnapshot,
  beforeFuels: Record<string, string>,
  after: ReviewSnapshot,
  afterFuels: Record<string, string>,
): Set<string> {
  const prior = new Map(before.vehicles.map((v) => [v.id, v]));
  const current = new Map(after.vehicles.map((v) => [v.id, v]));
  return new Set(
    [...new Set([...prior.keys(), ...current.keys()])].filter((id) => {
      const a = prior.get(id);
      const b = current.get(id);
      return (
        !a ||
        !b ||
        publicVehicleFingerprint(a, beforeFuels[id] ?? "") !==
          publicVehicleFingerprint(b, afterFuels[id] ?? "")
      );
    }),
  );
}

export function buildPublicCheckReport(
  vehicles: PublicCheckVehicle[],
  generatedAt: string,
): PublicCheckReport {
  if (
    vehicles.length > 500 ||
    new Set(vehicles.map((v) => v.vehicleId)).size !== vehicles.length
  )
    throw new Error("Limite ou duplicação na conferência pública.");
  return {
    schemaVersion: 1,
    generatedAt,
    counts: {
      vehicles: vehicles.length,
      passed: vehicles.filter((v) => v.status === "passed").length,
      divergent: vehicles.filter((v) => v.status === "divergent").length,
      inconclusive: vehicles.filter((v) => v.status === "inconclusive").length,
    },
    vehicles,
  };
}
