import catalogData from "../data/vehicle-equipment-catalog.json";
import evidenceData from "../data/vehicle-equipment-evidence.json";
import confirmationData from "../data/vehicle-equipment-confirmations.json";
import { vehiclePhysicalIdentityKey } from "./vehiclePhysicalIdentity";

export interface EquipmentOptional {
  tag?: string | null;
  descricao?: string | null;
  nome?: string | null;
}

export interface EquipmentVehicle {
  id?: string | number;
  marca?: string;
  modelo?: string;
  name?: string;
  year?: string | number;
  anoFabricacao?: string | number;
  /** Only populate when actually supplied; a missing feed market stays unknown. */
  market?: string;
  /** The existing source identifier is hashed for matching, never returned. */
  placa?: string;
  /** Sanitized callers may carry the computed key instead of the identifier. */
  physicalIdentityKey?: string | null;
  cambio?: string;
  motor?: string;
  lugares?: string | number;
  opcionais?: ReadonlyArray<string | EquipmentOptional> | null;
}

export interface EquipmentDefinition {
  id: string;
  tag: string;
  sourceDescription: string;
  description: string;
  /** Higher values are shown first. Every supplier tag has an explicit weight. */
  priority: number;
  category: string;
  benefit?: string;
}

export interface EquipmentItem {
  id: string;
  tag: string;
  description: string;
  priority: number;
  category: string;
  benefit?: string;
  sourceTags: string[];
  source: "inventory" | "manufacturer-standard" | "unit-confirmation";
  evidenceIds?: string[];
}

export interface EquipmentSuppression {
  id: string;
  tag: string;
  description: string;
  reason:
    | "duplicate"
    | "more-specific"
    | "already-in-specs"
    | "conflicting-airbag-count"
    | "explicitly-absent"
    | "conflicting-presence"
    | "manufacturer-correction"
    | "manufacturer-blocked-by-absence"
    | "unit-confirmed-absence";
  replacedBy?: string;
  evidenceIds?: string[];
}

export interface EquipmentEvidence {
  id: string;
  approved: boolean;
  kind: string;
  equipmentStatus: string;
  market: string;
  reviewedAt: string;
  sourceUrl: string;
  sourceTitle: string;
  sourcePage: number;
  claim: string;
  match: {
    brand: string;
    model: string;
    modelYear: number;
    engine: string;
    transmission: string;
  };
  action: {
    type: "replace" | "add";
    fromTag?: string;
    fromEquipmentId?: string;
    toTag: string;
  };
}

export const equipmentEvidenceRegistry: readonly EquipmentEvidence[] =
  evidenceData.records as EquipmentEvidence[];

export interface UnitEquipmentConfirmation {
  /** The existing reviewed records remain legacy; every new review emits v2. */
  schemaVersion?: 2;
  id: string;
  approved: boolean;
  source: string;
  confirmedAt: string;
  claim: string;
  match: EquipmentEvidence["match"] & {
    vehicleId: string;
    manufactureYear?: number;
    market?: "BR";
    physicalIdentityKey?: string;
  };
  marketSource?: "responsible-confirmation";
  reviewedDefinitions?: ReviewedUnitEquipmentDefinition[];
  presentTags: string[];
  absentTags: string[];
}

/** A reviewed extension belongs to one confirmation, never the global catalog. */
export interface ReviewedUnitEquipmentDefinition extends EquipmentDefinition {
  reviewedAt: string;
  reviewNote: string;
  /** Exact synonyms reviewed together; no fuzzy or family-level matching. */
  aliases?: string[];
}

export const unitEquipmentConfirmations: readonly UnitEquipmentConfirmation[] =
  confirmationData.records as UnitEquipmentConfirmation[];

export function isApprovedUnitEquipmentConfirmation(
  value: unknown,
): value is UnitEquipmentConfirmation {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<UnitEquipmentConfirmation>;
  if (
    (record.schemaVersion !== undefined && record.schemaVersion !== 2) ||
    record.approved !== true ||
    record.source !== "responsible-confirmation" ||
    typeof record.id !== "string" ||
    !/^[a-z0-9-]+$/.test(record.id) ||
    typeof record.claim !== "string" ||
    !record.claim.trim() ||
    typeof record.confirmedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.confirmedAt)
  )
    return false;
  const date = new Date(`${record.confirmedAt}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== record.confirmedAt
  )
    return false;
  const match = record.match;
  if (
    !match ||
    typeof match.vehicleId !== "string" ||
    !/^\d+$/.test(match.vehicleId) ||
    !Number.isInteger(match.modelYear) ||
    match.modelYear < 1900 ||
    match.modelYear > 2100 ||
    ![match.brand, match.model, match.engine, match.transmission].every(
      (field) => typeof field === "string" && field.trim().length > 0,
    )
  )
    return false;
  if (record.schemaVersion === 2) {
    if (
      !Number.isInteger(match.manufactureYear) ||
      Number(match.manufactureYear) < 1900 ||
      Number(match.manufactureYear) > 2100 ||
      match.market !== "BR" ||
      typeof match.physicalIdentityKey !== "string" ||
      !/^[a-f0-9]{64}$/.test(match.physicalIdentityKey) ||
      record.marketSource !== "responsible-confirmation"
    )
      return false;
  } else if (
    match.manufactureYear !== undefined ||
    match.market !== undefined ||
    match.physicalIdentityKey !== undefined ||
    record.marketSource !== undefined ||
    record.reviewedDefinitions !== undefined
  )
    return false;
  if (record.reviewedDefinitions !== undefined) {
    if (
      !Array.isArray(record.reviewedDefinitions) ||
      record.reviewedDefinitions.length > 50 ||
      !record.reviewedDefinitions.every(isReviewedUnitEquipmentDefinition)
    )
      return false;
    const ids = new Set<string>();
    const labels = new Set<string>();
    for (const definition of record.reviewedDefinitions) {
      if (ids.has(definition.id)) return false;
      ids.add(definition.id);
      const keys = new Set(unitDefinitionKeys(definition));
      if ([...keys].some((key) => labels.has(key))) return false;
      for (const key of keys) labels.add(key);
    }
  }
  const definitionForTag = (tag: string) =>
    definitionForUnitEquipmentTag(record as UnitEquipmentConfirmation, tag);
  if (
    ![record.presentTags, record.absentTags].every(
      (tags) =>
        Array.isArray(tags) &&
        tags.every((tag) => typeof tag === "string" && !!definitionForTag(tag)),
    )
  )
    return false;
  const present = record.presentTags!;
  const absent = record.absentTags!;
  const absentIds = new Set(absent.map((tag) => definitionForTag(tag)!.id));
  return (
    present.length + absent.length > 0 &&
    !present.some((tag) => absentIds.has(definitionForTag(tag)!.id)) &&
    // Unused definitions cannot quietly introduce aliases into inventory rows.
    (record.reviewedDefinitions || []).every((definition) =>
      [...present, ...absent].some(
        (tag) => definitionForTag(tag)?.id === definition.id,
      ),
    )
  );
}

// Deliberately narrow: each new manufacturer domain requires code review, not
// merely a URL containing a brand's name or an untrusted `official: true` flag.
const manufacturerHosts: Record<string, readonly string[]> = {
  volkswagen: ["www.vw.com.br", "vw.com.br"],
};

export function isApprovedEquipmentEvidence(
  value: unknown,
): value is EquipmentEvidence {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EquipmentEvidence>;
  if (
    record.approved !== true ||
    record.kind !== "manufacturer-standard" ||
    record.equipmentStatus !== "standard" ||
    record.market !== "BR"
  )
    return false;
  if (typeof record.id !== "string" || !/^[a-z0-9-]+$/.test(record.id))
    return false;
  if (
    typeof record.reviewedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt)
  )
    return false;
  const reviewDate = new Date(`${record.reviewedAt}T00:00:00Z`);
  if (
    !Number.isFinite(reviewDate.getTime()) ||
    reviewDate.toISOString().slice(0, 10) !== record.reviewedAt
  )
    return false;
  if (
    typeof record.sourceTitle !== "string" ||
    !record.sourceTitle.trim() ||
    typeof record.claim !== "string" ||
    !record.claim.trim() ||
    !Number.isInteger(record.sourcePage) ||
    Number(record.sourcePage) <= 0
  )
    return false;
  const match = record.match;
  if (
    !match ||
    typeof match !== "object" ||
    ![match.brand, match.model, match.engine, match.transmission].every(
      (field) =>
        typeof field === "string" &&
        field.trim().length > 0 &&
        !/[.*+?^${}()|[\]\\]/.test(field.replace(/\.(?=\d)/g, "")),
    )
  )
    return false;
  if (
    !Number.isInteger(match.modelYear) ||
    match.modelYear < 1900 ||
    match.modelYear > 2100
  )
    return false;
  try {
    const source = new URL(record.sourceUrl || "");
    if (
      source.protocol !== "https:" ||
      source.username ||
      source.password ||
      source.port ||
      !manufacturerHosts[normalizeEquipmentTag(match.brand)]?.includes(
        source.hostname,
      )
    )
      return false;
  } catch {
    return false;
  }
  const action = record.action;
  if (
    !action ||
    typeof action.toTag !== "string" ||
    !definitionForEquipmentTag(action.toTag)
  )
    return false;
  if (action.type === "add") return !action.fromTag && !action.fromEquipmentId;
  const fromDefinition =
    typeof action.fromTag === "string"
      ? equipmentByTag.get(normalizeEquipmentTag(action.fromTag))
      : undefined;
  const toDefinition = definitionForEquipmentTag(action.toTag);
  return (
    action.type === "replace" &&
    !!fromDefinition &&
    fromDefinition.id === action.fromEquipmentId &&
    fromDefinition.id !== toDefinition?.id
  );
}

function evidenceMatchesVehicle(
  record: Pick<EquipmentEvidence, "match">,
  vehicle: EquipmentVehicle,
): boolean {
  // No `name`, fabrication year, family regex or engine prefix fallback: missing
  // identity fields intentionally prevent any enrichment.
  return (
    normalizeEquipmentTag(vehicle.marca || "") ===
      normalizeEquipmentTag(record.match.brand) &&
    normalizeEquipmentTag(vehicle.modelo || "") ===
      normalizeEquipmentTag(record.match.model) &&
    Number(vehicle.year) === record.match.modelYear &&
    normalizeEquipmentTag(vehicle.motor || "") ===
      normalizeEquipmentTag(record.match.engine) &&
    normalizeEquipmentTag(vehicle.cambio || "") ===
      normalizeEquipmentTag(record.match.transmission)
  );
}

export function normalizeEquipmentTag(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function cleanEquipmentDescription(value: string): string {
  return value
    .replace(/^[\s.,;:*]+|[\s*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const equipmentCatalog: readonly EquipmentDefinition[] =
  catalogData.items;
export const equipmentByTag: ReadonlyMap<string, EquipmentDefinition> = new Map(
  equipmentCatalog.map((item) => [normalizeEquipmentTag(item.tag), item]),
);

const byDescription = new Map<string, EquipmentDefinition>();
for (const item of equipmentCatalog) {
  byDescription.set(normalizeEquipmentTag(item.sourceDescription), item);
  byDescription.set(normalizeEquipmentTag(item.description), item);
}

const aliases: Record<string, string[]> = {
  air_bag: ["Airbag", "Airbags"],
  air_bag_duplo: ["Airbag duplo"],
  air_bag_cortina: ["Airbags de cortina", "Airbag de cortina"],
  air_bag_lateral: ["Airbags laterais", "Airbag lateral"],
  ar_condicionado_digital: ["Ar digital"],
  ar_condicionado_dual_zone: [
    "Ar-condicionado digital dual zone",
    "Ar-condicionado de duas zonas",
  ],
  piloto_adaptativo: [
    "ACC",
    "Controle de cruzeiro adaptativo",
    "Piloto adaptativo",
    "Piloto automático adaptativo ACC",
  ],
  piloto_automatico: ["Controle de cruzeiro", "Cruise control"],
  franagem_emergencia: [
    "Frenagem autônoma de emergência",
    "Frenagem automática de emergência",
    "AEB",
  ],
  freios_abs: ["ABS com EBD", "ABS EBD", "Freios ABS e EBD"],
  freios_abs_com_ebd: ["ABS"],
  teto_panoramico: ["Teto solar panorâmico"],
  my_link: ["MyLink", "Central MyLink", "Multimídia MyLink"],
  media_nav: ["MediaNAV", "Central MediaNAV"],
  multimidia: ["Multimídia", "Sistema multimídia"],
  apple: ["CarPlay"],
  park_assist: ["Assistente de estacionamento Park Assist"],
  sete_lugares: ["Sete lugares"],
  som_radio: ["Conexão Bluetooth"],
};
for (const [tag, descriptions] of Object.entries(aliases)) {
  const definition = equipmentByTag.get(tag)!;
  for (const description of descriptions)
    byDescription.set(normalizeEquipmentTag(description), definition);
}

const additionalDefinitions: EquipmentDefinition[] = [
  {
    id: "blind-spot",
    tag: "alerta_ponto_cego",
    sourceDescription: "Alerta de ponto cego",
    description: "Alerta de ponto cego",
    priority: 910,
    category: "Segurança",
    benefit: "Avisa sobre veículos detectados na região de ponto cego.",
  },
  {
    id: "stability-control",
    tag: "controle_estabilidade",
    sourceDescription: "Controle de estabilidade",
    description: "Controle de estabilidade",
    priority: 850,
    category: "Segurança",
    benefit:
      "Auxilia a estabilidade do veículo em situações detectadas pelo sistema.",
  },
  {
    id: "camera-360",
    tag: "camera_360",
    sourceDescription: "Câmera 360°",
    description: "Câmera 360°",
    priority: 880,
    category: "Manobras",
    benefit: "Exibe imagens ao redor do veículo para auxiliar nas manobras.",
  },
  {
    id: "wireless-carplay",
    tag: "apple_carplay_sem_fio",
    sourceDescription: "Apple CarPlay sem fio",
    description: "Apple CarPlay sem fio",
    priority: 615,
    category: "Conectividade",
    benefit: "Integra um iPhone compatível à central por CarPlay sem cabo.",
  },
  {
    id: "wireless-android",
    tag: "android_auto_sem_fio",
    sourceDescription: "Android Auto sem fio",
    description: "Android Auto sem fio",
    priority: 615,
    category: "Conectividade",
    benefit:
      "Integra um celular compatível à central por Android Auto sem cabo.",
  },
];
const additionalByTag = new Map(
  additionalDefinitions.map((item) => [item.tag, item]),
);
for (const item of additionalDefinitions)
  byDescription.set(normalizeEquipmentTag(item.description), item);
for (const [description, id] of [
  ["Monitor de ponto cego", "blind-spot"],
  ["Monitoramento de ponto cego", "blind-spot"],
  ["ESP", "stability-control"],
  ["ESC", "stability-control"],
  ["Visão 360 graus", "camera-360"],
  ["Câmera 360 graus", "camera-360"],
  ["CarPlay sem fio", "wireless-carplay"],
]) {
  byDescription.set(
    normalizeEquipmentTag(description),
    additionalDefinitions.find((item) => item.id === id)!,
  );
}

function airbagDefinition(value: string): EquipmentDefinition | undefined {
  const normalized = normalizeEquipmentTag(value).replace(/_/g, " ");
  const match = normalized.match(
    /^(?:(\d{1,2}|dois|quatro|seis|sete|oito|dez) air ?bags?|air ?bags? (\d{1,2}))$/,
  );
  if (!match) return undefined;
  const words: Record<string, number> = {
    dois: 2,
    quatro: 4,
    seis: 6,
    sete: 7,
    oito: 8,
    dez: 10,
  };
  const count = words[match[1]] || Number(match[1] || match[2]);
  if (count < 2 || count > 12) return undefined;
  return {
    id: `airbags-${count}`,
    tag: `airbags_${count}`,
    sourceDescription: value,
    description: `${count} airbags`,
    priority: count >= 6 ? 1_000 : 805,
    category: "Segurança",
    benefit: `${count} bolsas de proteção informadas para este veículo.`,
  };
}

function definitionForDescription(
  description: string,
): EquipmentDefinition | undefined {
  return (
    byDescription.get(normalizeEquipmentTag(description)) ||
    airbagDefinition(description)
  );
}

export function definitionForEquipmentTag(
  tag: string,
): EquipmentDefinition | undefined {
  return (
    equipmentByTag.get(normalizeEquipmentTag(tag)) ||
    additionalByTag.get(normalizeEquipmentTag(tag)) ||
    definitionForDescription(tag)
  );
}

function unitDefinitionKeys(
  definition: ReviewedUnitEquipmentDefinition,
): string[] {
  return [
    definition.tag,
    definition.sourceDescription,
    definition.description,
    ...(definition.aliases || []),
  ].map(normalizeEquipmentTag);
}

export function isReviewedUnitEquipmentDefinition(
  value: unknown,
): value is ReviewedUnitEquipmentDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const definition = value as Partial<ReviewedUnitEquipmentDefinition>;
  const allowed = [
    "id",
    "tag",
    "sourceDescription",
    "description",
    "priority",
    "category",
    "benefit",
    "reviewedAt",
    "reviewNote",
    "aliases",
  ];
  const text = (input: unknown, max: number) =>
    typeof input === "string" &&
    input.trim().length > 0 &&
    input.length <= max &&
    ![...input].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    );
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    !text(definition.id, 100) ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id!) ||
    !text(definition.tag, 100) ||
    !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(definition.tag!) ||
    !text(definition.sourceDescription, 300) ||
    !text(definition.description, 300) ||
    !text(definition.reviewNote, 2000) ||
    !Number.isInteger(definition.priority) ||
    Number(definition.priority) < 0 ||
    Number(definition.priority) > 1000 ||
    ![...equipmentCatalog, ...additionalDefinitions].some(
      (item) => item.category === definition.category,
    ) ||
    (definition.benefit !== undefined && !text(definition.benefit, 500)) ||
    typeof definition.reviewedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(definition.reviewedAt)
  )
    return false;
  const date = new Date(`${definition.reviewedAt}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== definition.reviewedAt
  )
    return false;
  if (
    definition.aliases !== undefined &&
    (!Array.isArray(definition.aliases) ||
      definition.aliases.length > 20 ||
      !definition.aliases.every((alias) => text(alias, 300)))
  )
    return false;
  // Existing identities and exact known synonyms must retain their semantics.
  if (
    /^(?:other-|airbags?-)/.test(definition.id!) ||
    [...equipmentCatalog, ...additionalDefinitions].some(
      (item) => item.id === definition.id,
    ) ||
    unitDefinitionKeys(definition as ReviewedUnitEquipmentDefinition).some(
      (key) =>
        !key ||
        !!definitionForEquipmentTag(key) ||
        /^(?:sem_(?!fio(?:_|$))|nao_|ausencia_de_)/.test(key),
    )
  )
    return false;
  return true;
}

/** Call only after validating the containing record (or the supplied definition). */
export function definitionForUnitEquipmentTag(
  record: Pick<UnitEquipmentConfirmation, "reviewedDefinitions">,
  tag: string,
): EquipmentDefinition | undefined {
  return (
    definitionForEquipmentTag(tag) ||
    record.reviewedDefinitions?.find((definition) =>
      unitDefinitionKeys(definition).includes(normalizeEquipmentTag(tag)),
    )
  );
}

function resolveOptional(
  optional: string | EquipmentOptional,
  unitDefinitions: ReadonlyMap<string, EquipmentDefinition> = new Map(),
): EquipmentItem | undefined {
  const rawTag = typeof optional === "string" ? optional : optional.tag || "";
  const explicitDescription =
    typeof optional === "string"
      ? ""
      : cleanEquipmentDescription(optional.descricao || optional.nome || "");
  const normalizedTag = normalizeEquipmentTag(rawTag);
  // A description is stronger evidence than an opaque/legacy tag. In particular,
  // freios_abs_com_ebd actually means ABS in the supplier's current taxonomy.
  const definition = explicitDescription
    ? definitionForDescription(explicitDescription) ||
      unitDefinitions.get(normalizeEquipmentTag(explicitDescription))
    : equipmentByTag.get(normalizedTag) ||
      additionalByTag.get(normalizedTag) ||
      definitionForDescription(rawTag) ||
      unitDefinitions.get(normalizedTag);
  const description =
    definition?.description ||
    explicitDescription ||
    cleanEquipmentDescription(rawTag);
  if (!description) return undefined;
  return {
    id: definition?.id || `other-${normalizeEquipmentTag(description)}`,
    tag: normalizeEquipmentTag(definition?.tag || rawTag || description),
    description,
    priority: definition?.priority ?? 20,
    category: definition?.category || "Outros",
    ...(definition?.benefit ? { benefit: definition.benefit } : {}),
    sourceTags: [normalizedTag || normalizeEquipmentTag(description)],
    source: "inventory",
  };
}

function addSources(target: EquipmentItem, source: EquipmentItem): void {
  target.sourceTags = [
    ...new Set([...target.sourceTags, ...source.sourceTags]),
  ];
}

/** Resolve inventory equipment, reviewed manufacturer evidence and exact-unit confirmations.
 * Only exact identity matches can use approved, sourced records; marketing text,
 * a broad model/year match or the presence of other equipment never adds items. */
export function resolveVehicleEquipment(
  vehicle: EquipmentVehicle,
  evidenceRecords: readonly unknown[] = equipmentEvidenceRegistry,
  unitConfirmations: readonly unknown[] = unitEquipmentConfirmations,
): {
  items: EquipmentItem[];
  suppressed: EquipmentSuppression[];
} {
  const suppliedPhysicalKey =
    typeof vehicle.physicalIdentityKey === "string" &&
    /^[a-f0-9]{64}$/.test(vehicle.physicalIdentityKey)
      ? vehicle.physicalIdentityKey
      : null;
  const sourcePhysicalKey =
    vehicle.placa !== undefined && vehicle.placa !== null
      ? vehiclePhysicalIdentityKey(vehicle.id, vehicle.placa)
      : suppliedPhysicalKey;
  // A present-but-invalid identifier or a contradictory supplied key cannot use
  // a sanitized fallback to resurrect an earlier unit's confirmation.
  const physicalKey =
    vehicle.physicalIdentityKey != null &&
    vehicle.physicalIdentityKey !== sourcePhysicalKey
      ? null
      : sourcePhysicalKey;
  const matchingConfirmations = unitConfirmations.filter(
    (record): record is UnitEquipmentConfirmation =>
      isApprovedUnitEquipmentConfirmation(record) &&
      String(vehicle.id ?? "") === record.match.vehicleId &&
      evidenceMatchesVehicle(record, vehicle) &&
      (record.schemaVersion !== 2 ||
        (physicalKey !== null &&
          physicalKey === record.match.physicalIdentityKey &&
          Number(vehicle.anoFabricacao) === record.match.manufactureYear &&
          // The responsible person's explicit attestation supplies the market
          // when the feed does not. Never replace a contradictory supplied market.
          (!vehicle.market?.trim() ||
            normalizeEquipmentTag(vehicle.market) === "br"))),
  );
  // A concurrent/manual duplicate must be consolidated before new presences
  // apply. Keep prior legacy corrections and all explicit absences effective.
  const duplicateReview =
    matchingConfirmations.length > 1 &&
    matchingConfirmations.some((record) => record.schemaVersion === 2);
  const confirmations = duplicateReview
    ? matchingConfirmations.filter((record) => record.schemaVersion !== 2)
    : matchingConfirmations;
  const unitDefinitions = new Map<string, EquipmentDefinition>();
  for (const record of confirmations) {
    for (const definition of record.reviewedDefinitions || []) {
      for (const key of unitDefinitionKeys(definition))
        unitDefinitions.set(key, definition);
    }
  }
  const scopedDefinition = (tag: string) =>
    definitionForEquipmentTag(tag) ||
    unitDefinitions.get(normalizeEquipmentTag(tag));
  const items = new Map<string, EquipmentItem>();
  const suppressed: EquipmentSuppression[] = [];
  const absentTags = new Set<string>();
  const absentIds = new Set<string>();
  const candidates: EquipmentItem[] = [];
  const suppress = (
    item: EquipmentItem,
    reason: EquipmentSuppression["reason"],
    replacedBy?: string,
  ) => {
    suppressed.push({
      id: item.id,
      tag: item.tag,
      description: item.description,
      reason,
      ...(replacedBy ? { replacedBy } : {}),
    });
  };
  for (const optional of vehicle.opcionais || []) {
    const item = resolveOptional(optional, unitDefinitions);
    if (!item) continue;
    const absence = normalizeEquipmentTag(item.description).match(
      /^(?:sem_(?!fio(?:_|$))|nao_(?:possui|tem|disponivel)_?|ausencia_de_)(.*)$/,
    );
    if (absence) {
      // Collect every explicit negative before evaluating any affirmative row.
      // Both the supplier tag and the described identity are blocked, so aliases
      // or a different input order cannot resurrect contradictory equipment.
      for (const tag of [item.tag, ...item.sourceTags, absence[1]]) {
        if (!tag) continue;
        absentTags.add(normalizeEquipmentTag(tag));
        const definition = scopedDefinition(tag);
        if (definition) {
          absentIds.add(definition.id);
          absentTags.add(normalizeEquipmentTag(definition.tag));
        }
      }
      if (absence[1]) absentIds.add(`other-${absence[1]}`);
      suppress(item, "explicitly-absent");
      continue;
    }
    candidates.push(item);
  }
  for (const item of candidates) {
    if (
      absentIds.has(item.id) ||
      absentTags.has(item.tag) ||
      item.sourceTags.some((tag) => absentTags.has(tag))
    ) {
      suppress(item, "conflicting-presence");
      continue;
    }
    const existing = items.get(item.id);
    if (existing) {
      addSources(existing, item);
      suppress(item, "duplicate", existing.id);
    } else items.set(item.id, item);
  }

  for (const record of evidenceRecords) {
    if (
      !isApprovedEquipmentEvidence(record) ||
      !evidenceMatchesVehicle(record, vehicle)
    )
      continue;
    const definition = definitionForEquipmentTag(record.action.toTag)!;
    if (
      absentIds.has(definition.id) ||
      absentTags.has(normalizeEquipmentTag(definition.tag)) ||
      (record.action.fromTag &&
        absentTags.has(normalizeEquipmentTag(record.action.fromTag))) ||
      (record.action.fromEquipmentId &&
        absentIds.has(record.action.fromEquipmentId))
    ) {
      suppressed.push({
        id: definition.id,
        tag: normalizeEquipmentTag(definition.tag),
        description: definition.description,
        reason: "manufacturer-blocked-by-absence",
        evidenceIds: [record.id],
      });
      continue;
    }
    const original = record.action.fromEquipmentId
      ? items.get(record.action.fromEquipmentId)
      : undefined;
    if (
      record.action.type === "replace" &&
      (!original ||
        !original.sourceTags.includes(
          normalizeEquipmentTag(record.action.fromTag!),
        ))
    )
      continue;
    if (record.action.type === "add" && items.has(definition.id)) continue;
    const corrected: EquipmentItem = {
      id: definition.id,
      tag: normalizeEquipmentTag(definition.tag),
      description: definition.description,
      category: definition.category,
      priority: definition.priority,
      ...(definition.benefit ? { benefit: definition.benefit } : {}),
      source: "manufacturer-standard",
      evidenceIds: [record.id],
      sourceTags: original ? [...original.sourceTags] : [],
    };
    const existing = items.get(corrected.id);
    if (existing) {
      addSources(corrected, existing);
      corrected.evidenceIds = [
        ...new Set([...(existing.evidenceIds || []), record.id]),
      ];
    }
    items.set(corrected.id, corrected);
    if (original) {
      items.delete(original.id);
      suppressed.push({
        id: original.id,
        tag: original.tag,
        description: original.description,
        reason: "manufacturer-correction",
        replacedBy: corrected.id,
        evidenceIds: [record.id],
      });
    }
  }

  // A responsible person's confirmation applies only to this exact stock unit,
  // never to all cars of a trim. It outranks stale inventory/manufacturer data.
  const unitAbsentIds = new Map<string, string[]>();
  for (const record of matchingConfirmations) {
    for (const tag of record.absentTags) {
      const definition = definitionForUnitEquipmentTag(record, tag)!;
      const ids = [definition.id];
      if (duplicateReview) {
        const custom = record.reviewedDefinitions?.find(
          (entry) => entry.id === definition.id,
        );
        if (custom)
          ids.push(...unitDefinitionKeys(custom).map((key) => `other-${key}`));
      }
      for (const id of ids)
        unitAbsentIds.set(id, [...(unitAbsentIds.get(id) || []), record.id]);
    }
  }
  for (const [id, evidenceIds] of unitAbsentIds) {
    const item = items.get(id);
    if (!item) continue;
    items.delete(id);
    suppressed.push({
      id,
      tag: item.tag,
      description: item.description,
      reason: "unit-confirmed-absence",
      evidenceIds,
    });
  }
  for (const record of confirmations) {
    for (const tag of record.presentTags) {
      const definition = definitionForUnitEquipmentTag(record, tag)!;
      // If active confirmations ever conflict, do not advertise the item.
      if (unitAbsentIds.has(definition.id)) continue;
      const existing = items.get(definition.id);
      items.set(definition.id, {
        id: definition.id,
        tag: normalizeEquipmentTag(definition.tag),
        description: definition.description,
        category: definition.category,
        priority: definition.priority,
        ...(definition.benefit ? { benefit: definition.benefit } : {}),
        source: "unit-confirmation",
        evidenceIds: [
          ...new Set([...(existing?.evidenceIds || []), record.id]),
        ],
        sourceTags: existing ? [...existing.sourceTags] : [],
      });
    }
  }

  const replace = (dominantId: string, subordinateIds: string[]) => {
    const dominant = items.get(dominantId);
    if (!dominant) return;
    for (const id of subordinateIds) {
      const subordinate = items.get(id);
      if (!subordinate) continue;
      addSources(dominant, subordinate);
      suppress(subordinate, "more-specific", dominantId);
      items.delete(id);
    }
  };

  const counts = [...items.values()].filter(
    (item) => /^airbags-\d+$/.test(item.id) && Number(item.id.slice(8)) > 2,
  );
  if (counts.length > 1) {
    const sources = [...new Set(counts.flatMap((item) => item.sourceTags))];
    const conflict: EquipmentItem = {
      id: "airbags-unconfirmed-count",
      tag: "airbags",
      description: "Airbags (quantidade a confirmar)",
      priority: 700,
      category: "Segurança",
      sourceTags: sources,
      source: "inventory",
    };
    for (const item of counts) {
      suppress(item, "conflicting-airbag-count", conflict.id);
      items.delete(item.id);
    }
    items.set(conflict.id, conflict);
    replace(conflict.id, ["airbags", "airbags-2"]);
  } else if (counts[0]) {
    const count = Number(counts[0].id.slice(8));
    replace(counts[0].id, [
      "airbags",
      "airbags-2",
      ...(count >= 6 ? ["side-airbags", "curtain-airbags"] : []),
    ]);
  } else {
    const protectionParts = [
      { id: "airbags-2", label: "frontais" },
      { id: "side-airbags", label: "laterais" },
      { id: "curtain-airbags", label: "de cortina" },
    ].filter((part) => items.has(part.id));
    if (protectionParts.length > 1) {
      const labels = protectionParts.map((part) => part.label);
      const description = `Airbags ${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
      const priority = Math.max(
        ...protectionParts.map((part) => items.get(part.id)!.priority),
      );
      items.set("airbag-protection", {
        id: "airbag-protection",
        tag: "airbag_protection",
        description,
        priority,
        category: "Segurança",
        benefit: "Proteção por airbags nas posições indicadas.",
        sourceTags: [],
        source: "inventory",
      });
      replace("airbag-protection", [
        "airbags",
        ...protectionParts.map((part) => part.id),
      ]);
    } else replace("airbags-2", ["airbags"]);
  }

  replace("dual-zone-climate", ["digital-climate", "air-conditioning"]);
  replace("digital-climate", ["air-conditioning"]);
  replace("adaptive-cruise-control", ["cruise-control"]);
  replace("panoramic-roof", ["sunroof"]);
  replace("abs-ebd", ["abs"]);
  replace("mylink", ["multimedia"]);
  replace("medianav", ["multimedia"]);
  replace("wireless-carplay-android", [
    "wireless-carplay",
    "wireless-android",
    "apple-carplay",
    "android-auto",
  ]);
  replace("wireless-carplay", ["apple-carplay"]);
  replace("wireless-android", ["android-auto"]);
  replace("camera-360", ["rear-camera"]);
  replace("electric-tailgate", ["automatic-tailgate"]);

  const transmission = normalizeEquipmentTag(vehicle.cambio || "").replace(
    /_/g,
    " ",
  );
  const automaticAlreadyShown =
    /\b(?:automatic[oa]|cvt|dsg)\b/.test(transmission) &&
    !/\b(?:nao|sem|manual)\b/.test(transmission);
  const engineLabel = normalizeEquipmentTag(
    [vehicle.motor, vehicle.modelo, vehicle.name].filter(Boolean).join(" "),
  ).replace(/_/g, " ");
  const turboAlreadyShown =
    /\bturbo\b/.test(engineLabel) && !/\bsem turbo\b/.test(engineLabel);
  for (const [id, hide] of [
    ["automatic-transmission", automaticAlreadyShown],
    ["turbo", turboAlreadyShown],
  ] as const) {
    const item = items.get(id);
    if (!item || !hide) continue;
    suppress(item, "already-in-specs");
    items.delete(id);
  }

  return {
    items: [...items.values()].sort(
      (a, b) =>
        b.priority - a.priority ||
        a.description.localeCompare(b.description, "pt-BR") ||
        a.id.localeCompare(b.id),
    ),
    suppressed,
  };
}
