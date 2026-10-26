import {
  resolveVehicleEquipment,
  normalizeEquipmentTag,
  cleanEquipmentDescription,
  type EquipmentItem,
  type EquipmentVehicle,
} from "../../../lib/vehicleEquipment";
import {
  selectVehicleEditorialTopics,
  type VehicleEditorialReview,
} from "./vehicleEditorialProfiles";
import { resolveVehicleEditorialCopy } from "./vehicleEditorialCopy";

export interface VehicleHighlight {
  id: string;
  category: string;
  title: string;
  description: string;
  sourceTags: string[];
  /** Canonical facts explained by this card, including every grouped item. */
  equipmentIds: string[];
  equipmentLabels: string[];
  metric?: { value: string; unit: string };
}

export interface VehicleHighlightsPresentation {
  highlights: VehicleHighlight[];
  explainedTags: Set<string>;
  remainingOptionals: string[];
  /** Curatorial coverage only; never rendered as equipment certification. */
  editorialReview: VehicleEditorialReview;
}

export const normalizeVehicleFeatureTag = normalizeEquipmentTag;
export const cleanOptionalDescription = cleanEquipmentDescription;

interface EquipmentGroup {
  id: string;
  category: string;
  title: string;
  description: string;
  items: EquipmentItem[];
}

const joinFacts = (facts: string[]): string =>
  facts.length < 2
    ? facts[0] || ""
    : `${facts.slice(0, -1).join(", ")} e ${facts.at(-1)}`;

const drivingTitles: Record<string, string> = {
  "adaptive-cruise-control": "ACC",
  "automatic-emergency-braking": "frenagem automática",
  "collision-warning": "alerta de colisão",
  "lane-assist": "assistência de faixa",
};

const drivingBenefits: Record<string, string> = {
  "adaptive-cruise-control":
    "ACC para ajustar a velocidade ao veículo à frente",
  "automatic-emergency-braking":
    "apoio à frenagem automática em risco detectado",
  "collision-warning": "alerta de risco de colisão frontal",
  "lane-assist": "auxílio para permanecer na faixa",
};

const capitalize = (value: string): string =>
  value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);

/** Groups describe complementary facts; their order still comes from the resolver. */
function complementaryGroups(items: EquipmentItem[]): EquipmentGroup[] {
  const find = (...ids: string[]) =>
    items.filter((item) => ids.includes(item.id));
  const groups: EquipmentGroup[] = [];
  const driving = find(
    "adaptive-cruise-control",
    "automatic-emergency-braking",
    "collision-warning",
    "lane-assist",
  );
  if (driving.length >= 2) {
    const conventionalCruise = find("cruise-control");
    groups.push({
      id: "driving-assistance",
      category: "Segurança",
      title: conventionalCruise.length
        ? "Piloto automático e assistências de segurança"
        : capitalize(joinFacts(driving.map((item) => drivingTitles[item.id]))),
      description: `${capitalize(
        joinFacts([
          ...(conventionalCruise.length
            ? ["piloto automático com velocidade definida pelo motorista"]
            : []),
          ...driving.map((item) => drivingBenefits[item.id]),
        ]),
      )}. Atuação dentro dos ${driving.some((item) => item.id === "adaptive-cruise-control") ? "limites do sistema" : "limites de cada sistema"}.`,
      items: items.filter((item) =>
        [...driving, ...conventionalCruise].includes(item),
      ),
    });
  }

  const cameras = find("rear-camera", "camera-360");
  const sensors = find("parking-sensors");
  if (cameras.length && sensors.length) {
    groups.push({
      id: "parking-aids",
      category: "Manobras",
      title: `${joinFacts(cameras.map((item) => item.description))} e sensor de estacionamento`,
      description: `${cameras.map((item) => item.benefit).join(" ")} O sensor avisa sobre obstáculos detectados durante as manobras.`,
      items: items.filter((item) => [...cameras, ...sensors].includes(item)),
    });
  }

  const climate = find("digital-climate", "dual-zone-climate");
  const leather = find("leather-seats");
  if (climate.length && leather.length) {
    groups.push({
      id: "cabin-comfort",
      category: "Conforto",
      title: `Bancos em couro e ar ${climate.some((item) => item.id === "dual-zone-climate") ? "dual zone" : "digital"}`,
      description: climate.some((item) => item.id === "dual-zone-climate")
        ? "A temperatura pode ser ajustada separadamente por zona, acomodando preferências diferentes na cabine."
        : "Você escolhe os ajustes da climatização em comandos digitais.",
      items: items.filter((item) => [...climate, ...leather].includes(item)),
    });
  }

  const access = find("keyless", "push-start");
  if (access.length === 2) {
    const charging = find("wireless-charging");
    groups.push({
      id: "everyday-convenience",
      category: "Conveniência",
      title: charging.length
        ? "Chave presencial, partida por botão e recarga por indução"
        : "Chave presencial e partida por botão",
      description: `Acesso e partida sem inserir a chave${charging.length ? ", além de recarga sem cabo para celulares compatíveis" : ""}.`,
      items: items.filter((item) => [...access, ...charging].includes(item)),
    });
  }

  const multimedia = find("multimedia", "mylink", "medianav");
  const integration = find(
    "wireless-carplay-android",
    "wireless-carplay",
    "wireless-android",
    "apple-carplay",
    "android-auto",
  );
  if (multimedia.length && integration.length) {
    groups.push({
      id: "phone-connectivity",
      category: "Conectividade",
      title: `${joinFacts(multimedia.map((item) => item.description))} com ${joinFacts(integration.map((item) => item.description))}`,
      description: integration.map((item) => item.benefit).join(" "),
      items: items.filter((item) =>
        [...multimedia, ...integration].includes(item),
      ),
    });
  }
  return groups;
}

/** Research may choose any factual candidate, not only the four fallback cards. */
export function getVehicleEditorialTopicIds(
  vehicle: EquipmentVehicle,
): string[] {
  const items = resolveVehicleEquipment(vehicle).items;
  const groups = complementaryGroups(items);
  return [
    ...new Set(
      items
        .filter((item) => item.benefit)
        .map(
          (item) =>
            groups.find((group) => group.items.includes(item))?.id || item.id,
        ),
    ),
  ];
}

/** Promote verified seating capacity without inferring it from model names. */
export function getVehicleHeroEquipmentLabels(
  vehicle: EquipmentVehicle,
): string[] {
  return resolveVehicleEquipment(vehicle)
    .items.filter((item) => item.id === "seven-seats")
    .map((item) => item.description);
}

/**
 * Cards and list share inventory evidence, ranking and redundancy rules.
 * Marketing copy and similar vehicles are not equipment/specification sources.
 */
export function buildVehicleHighlights(
  vehicle: EquipmentVehicle,
): VehicleHighlightsPresentation {
  const equipment = resolveVehicleEquipment(vehicle);
  const groups = complementaryGroups(equipment.items);
  const editorial = selectVehicleEditorialTopics(
    vehicle,
    equipment.items
      .filter((item) => item.benefit)
      .map(
        (item) =>
          groups.find((group) => group.items.includes(item))?.id || item.id,
      ),
  );
  const highlights: VehicleHighlight[] = [];
  const selectedIds = new Set<string>();
  // Visit the canonical order once. A group occupies the position of its first
  // fact; independent differentiators such as seven seats keep their priority.
  for (const item of equipment.items) {
    if (selectedIds.has(item.id) || !item.benefit) continue;
    const group = groups.find((entry) => entry.items.includes(item));
    // A profile is a set of editorial topics, not a second priority table.
    // Missing topics are omitted; their facts stay in the complete list.
    if (editorial.topics && !editorial.topics.has(group?.id || item.id))
      continue;
    const explained = group?.items || [item];
    const copy = resolveVehicleEditorialCopy(
      vehicle,
      group?.id || item.id,
      explained.map((entry) => entry.id),
    );
    highlights.push({
      id: group?.id || item.id,
      category: group?.category || item.category,
      title: copy?.title || group?.title || item.description,
      description: copy?.description || group?.description || item.benefit,
      sourceTags: [...new Set(explained.flatMap((entry) => entry.sourceTags))],
      equipmentIds: explained.map((entry) => entry.id),
      equipmentLabels: explained.map((entry) => entry.description),
    });
    explained.forEach((entry) => selectedIds.add(entry.id));
    if (highlights.length === 4) break;
  }
  return {
    highlights,
    editorialReview: editorial.review,
    explainedTags: new Set(highlights.flatMap((item) => item.sourceTags)),
    remainingOptionals: equipment.items
      .filter((item) => !selectedIds.has(item.id))
      .map((item) => item.description),
  };
}
