import type { Vehicle } from "@/catalog/endpoints/vehicles";

export interface VehicleHighlight {
  id: string;
  category: string;
  title: string;
  description: string;
  sourceTags: string[];
  metric?: {
    value: string;
    unit: string;
  };
}

export interface VehicleHighlightsPresentation {
  highlights: VehicleHighlight[];
  explainedTags: Set<string>;
}

type HighlightVehicle = Pick<
  Vehicle,
  "id" | "modelo" | "year" | "km" | "opcionais" | "diferenciais"
>;

interface HighlightCandidate extends VehicleHighlight {
  priority: number;
  conflictGroup?: string;
}

const MAX_REGULAR_HIGHLIGHTS = 4;

// O anúncio do Fastback usado no piloto está vazio na API. Mantemos somente o
// dado de capacidade que já foi conferido para esse veículo específico.
const VERIFIED_TRUNK_CAPACITY_BY_VEHICLE_ID: Record<string, number> = {
  "19884": 600,
};

interface TrunkCapacityAssociation {
  modelPattern: RegExp;
  yearMin: number;
  yearMax: number;
  capacity: number;
}

// Capacidades já presentes em anúncios do estoque são reaproveitadas apenas
// entre carros da mesma família e geração. O recorte por ano evita, por
// exemplo, aplicar os 437 L da HR-V antiga às versões da geração atual.
const VERIFIED_TRUNK_CAPACITY_ASSOCIATIONS: TrunkCapacityAssociation[] = [
  { modelPattern: /\bargo\b/, yearMin: 2018, yearMax: 2025, capacity: 300 },
  { modelPattern: /\bix35\b/, yearMin: 2011, yearMax: 2022, capacity: 591 },
  { modelPattern: /\bcronos\b/, yearMin: 2018, yearMax: 2025, capacity: 525 },
  { modelPattern: /\bcreta\b/, yearMin: 2017, yearMax: 2021, capacity: 431 },
  { modelPattern: /\bhrv\b/, yearMin: 2016, yearMax: 2021, capacity: 437 },
  { modelPattern: /\btracker\b/, yearMin: 2021, yearMax: 2025, capacity: 393 },
  { modelPattern: /\bt cross\b/, yearMin: 2020, yearMax: 2025, capacity: 373 },
  { modelPattern: /\bnivus\b/, yearMin: 2021, yearMax: 2025, capacity: 415 },
  {
    modelPattern: /\bcompass\b.*\bt270\b/,
    yearMin: 2022,
    yearMax: 2025,
    capacity: 410,
  },
  {
    modelPattern: /\bfastback\b/,
    yearMin: 2023,
    yearMax: 2025,
    capacity: 600,
  },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeVehicleFeatureTag(value: string): string {
  return normalizeText(value).replace(/\s+/g, "_");
}

export function cleanOptionalDescription(value: string): string {
  return value
    .replace(/^[\s.,;:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeAnuncio(value?: string | null): string {
  if (!value) return "";

  const compact = value.replace(/\s+/g, "");
  const looksEncoded =
    compact.length > 50 &&
    !value.includes("[") &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(compact);

  if (!looksEncoded) return value;

  try {
    const binary = atob(compact);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}

function extractTrunkCapacity(
  anuncio: string | null | undefined,
  vehicle: HighlightVehicle,
): number | null {
  const decoded = decodeAnuncio(anuncio).replace(/\*+/g, "");
  const patterns = [
    /(?:capacidade\s+(?:do|de)\s+)?porta[-\s]?malas[^0-9]{0,90}(\d{2,4})\s*(?:l|litros)\b/i,
    /bagageiro[^0-9]{0,90}(\d{2,4})\s*(?:l|litros)\b/i,
    /(\d{2,4})\s*(?:l|litros)\b[^.\n]{0,90}(?:porta[-\s]?malas|bagageiro)/i,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    const capacity = match ? Number(match[1]) : 0;
    if (capacity >= 100 && capacity <= 1_500) return capacity;
  }

  const exactCapacity =
    VERIFIED_TRUNK_CAPACITY_BY_VEHICLE_ID[String(vehicle.id)];
  if (exactCapacity) return exactCapacity;

  const model = normalizeText(vehicle.modelo || "");
  const year = Number(vehicle.year || 0);
  const association = VERIFIED_TRUNK_CAPACITY_ASSOCIATIONS.find(
    (rule) =>
      rule.modelPattern.test(model) &&
      year >= rule.yearMin &&
      year <= rule.yearMax,
  );
  return association?.capacity || null;
}

function createCandidate(
  candidate: Omit<HighlightCandidate, "sourceTags"> & {
    sourceTags: string[];
  },
): HighlightCandidate {
  return candidate;
}

export function buildVehicleHighlights(
  vehicle: HighlightVehicle,
  anuncio?: string | null,
): VehicleHighlightsPresentation {
  const optionals = (vehicle.opcionais || []).map((optional) => ({
    tag: normalizeVehicleFeatureTag(optional.tag),
    description: normalizeText(optional.descricao),
  }));
  const availableTags = new Set(optionals.map((optional) => optional.tag));
  const differentialTags = new Set(
    (vehicle.diferenciais || []).map((differential) =>
      normalizeVehicleFeatureTag(differential.tag),
    ),
  );

  const hasTag = (...tags: string[]) =>
    tags.some((tag) => availableTags.has(tag));
  const matchedTags = (...tags: string[]) =>
    tags.filter((tag) => availableTags.has(tag));
  const hasDescription = (...terms: string[]) =>
    optionals.some((optional) =>
      terms.some((term) => optional.description.includes(normalizeText(term))),
    );
  const hasDifferential = (...tags: string[]) =>
    tags.some((tag) => differentialTags.has(tag));
  const mileage = Number(vehicle.km);
  const hasVerifiedLowMileage =
    Number.isFinite(mileage) && mileage > 0 && mileage < 25_000;

  const candidates: HighlightCandidate[] = [];
  const add = (
    condition: boolean,
    candidate: Omit<HighlightCandidate, "sourceTags"> & {
      sourceTags: string[];
    },
  ) => {
    if (condition) candidates.push(createCandidate(candidate));
  };

  add(hasTag("sete_lugares"), {
    id: "seven-seats",
    priority: 5,
    category: "Versatilidade",
    title: "Sete lugares",
    description:
      "Mais flexibilidade para levar família e passageiros quando necessário.",
    sourceTags: matchedTags("sete_lugares"),
  });

  add(hasTag("teto_panoramico"), {
    id: "panoramic-roof",
    priority: 10,
    category: "Experiência a bordo",
    title: "Teto panorâmico",
    description:
      "Amplia a sensação de espaço e deixa a cabine mais clara e agradável.",
    sourceTags: matchedTags("teto_panoramico", "teto_solar"),
  });

  add(hasTag("piloto_adaptativo"), {
    id: "adaptive-cruise",
    priority: 12,
    category: "Condução assistida",
    title: "Piloto automático adaptativo",
    description:
      "Ajusta a velocidade para ajudar a manter distância do veículo à frente.",
    sourceTags: matchedTags("piloto_adaptativo", "piloto_automatico"),
  });

  add(hasTag("park_assist"), {
    id: "park-assist",
    priority: 14,
    category: "Praticidade",
    title: "Park Assist",
    description:
      "Auxilia nas manobras de estacionamento e reduz o esforço em vagas apertadas.",
    sourceTags: matchedTags("park_assist"),
  });

  add(hasTag("tracao_awd"), {
    id: "awd",
    priority: 16,
    category: "Tração",
    title: "Tração AWD",
    description:
      "Distribui a força entre as rodas para ampliar aderência e controle.",
    sourceTags: matchedTags("tracao_awd"),
  });

  add(hasTag("franagem_emergencia"), {
    id: "emergency-braking",
    priority: 18,
    category: "Segurança ativa",
    title: "Frenagem automática de emergência",
    description:
      "Pode intervir diante de um risco de colisão e reforça a proteção no uso diário.",
    sourceTags: matchedTags("franagem_emergencia", "alerta_colisao"),
  });

  add(hasTag("assistencia_faixa"), {
    id: "lane-assist",
    priority: 20,
    category: "Segurança ativa",
    title: "Assistência de permanência em faixa",
    description:
      "Auxilia o motorista a manter o carro na faixa, especialmente em viagens.",
    sourceTags: matchedTags("assistencia_faixa"),
  });

  add(hasTag("sem_fio"), {
    id: "wireless-connectivity",
    priority: 22,
    conflictGroup: "infotainment",
    category: "Conectividade",
    title: "CarPlay e Android Auto sem fio",
    description:
      "Acessa mapas, música e chamadas na central sem precisar conectar cabo.",
    sourceTags: matchedTags("sem_fio", "apple", "android"),
  });

  add(hasTag("porta_malas_eletrico", "porta_automatica", "porta_mala"), {
    id: "powered-trunk",
    priority: 24,
    category: "Praticidade",
    title: "Porta-malas com abertura elétrica",
    description:
      "Facilita o acesso ao bagageiro quando as mãos estão ocupadas.",
    sourceTags: matchedTags(
      "porta_malas_eletrico",
      "porta_automatica",
      "porta_mala",
    ),
  });

  add(hasTag("teto_solar") && !hasTag("teto_panoramico"), {
    id: "sunroof",
    priority: 26,
    category: "Experiência a bordo",
    title: "Teto solar",
    description:
      "Traz mais luz e ventilação para a cabine e valoriza a experiência a bordo.",
    sourceTags: matchedTags("teto_solar"),
  });

  add(hasTag("carregador_inducao"), {
    id: "wireless-charger",
    priority: 28,
    category: "Conectividade",
    title: "Carregador de celular por indução",
    description:
      "Mantém o smartphone carregado no dia a dia sem depender de cabos.",
    sourceTags: matchedTags("carregador_inducao"),
  });

  add(hasTag("banco_com_aquecimento"), {
    id: "heated-seats",
    priority: 30,
    category: "Conforto",
    title: "Bancos com aquecimento",
    description:
      "Mais conforto térmico para motorista e passageiro em dias frios.",
    sourceTags: matchedTags("banco_com_aquecimento"),
  });

  add(hasTag("ar_condicionado_dual_zone"), {
    id: "dual-zone",
    priority: 32,
    category: "Conforto",
    title: "Ar digital Dual Zone",
    description:
      "Motorista e passageiro podem ajustar temperaturas diferentes.",
    sourceTags: matchedTags(
      "ar_condicionado_dual_zone",
      "ar_condicionado_digital",
    ),
  });

  add(hasTag("air_bag_lateral", "air_bag_cortina"), {
    id: "additional-airbags",
    priority: 34,
    category: "Proteção",
    title:
      hasTag("air_bag_lateral") && hasTag("air_bag_cortina")
        ? "Airbags laterais e de cortina"
        : hasTag("air_bag_cortina")
          ? "Airbags de cortina"
          : "Airbags laterais",
    description:
      "Proteção adicional para os ocupantes além dos airbags frontais.",
    sourceTags: matchedTags("air_bag_lateral", "air_bag_cortina"),
  });

  add(
    hasTag("apple", "android") ||
      hasDescription("Apple CarPlay", "Android Auto"),
    {
      id: "phone-integration",
      priority: 36,
      conflictGroup: "infotainment",
      category: "Conectividade",
      title:
        hasTag("apple") && hasTag("android")
          ? "Apple CarPlay + Android Auto"
          : hasTag("apple")
            ? "Apple CarPlay"
            : "Android Auto",
      description:
        "Mapas, música e chamadas ficam acessíveis pela central multimídia.",
      sourceTags: matchedTags("apple", "android"),
    },
  );

  add(hasTag("camera_de_re") && hasTag("sensor_de_estacionamento"), {
    id: "parking-aids",
    priority: 38,
    category: "Manobras",
    title: "Câmera de ré + sensor de estacionamento",
    description:
      "Combinação que amplia a visão e ajuda a perceber obstáculos nas manobras.",
    sourceTags: matchedTags("camera_de_re", "sensor_de_estacionamento"),
  });

  add(hasTag("bancos_de_couro"), {
    id: "leather-seats",
    priority: 40,
    category: "Acabamento",
    title: "Bancos em couro",
    description:
      "Acabamento de toque agradável e mais prático de limpar no uso diário.",
    sourceTags: matchedTags("bancos_de_couro"),
  });

  add(hasTag("chave_inteligente") && hasTag("botao"), {
    id: "keyless-start",
    priority: 42,
    category: "Praticidade",
    title: "Chave presencial + partida por botão",
    description:
      "Permite acessar e ligar o carro com a chave guardada no bolso ou na bolsa.",
    sourceTags: matchedTags("chave_inteligente", "botao"),
  });

  add(hasTag("motor_turbo"), {
    id: "turbo-engine",
    priority: 44,
    category: "Desempenho",
    title: "Motor turbo",
    description:
      "Entrega respostas mais rápidas nas retomadas e boa força em baixa rotação.",
    sourceTags: matchedTags("motor_turbo"),
  });

  add(hasTag("paddle_shift"), {
    id: "paddle-shift",
    priority: 46,
    category: "Condução",
    title: "Trocas de marcha no volante",
    description:
      "As aletas permitem comandar as marchas sem tirar as mãos do volante.",
    sourceTags: matchedTags("paddle_shift"),
  });

  add(hasTag("camera_de_re") && !hasTag("sensor_de_estacionamento"), {
    id: "reverse-camera",
    priority: 48,
    category: "Manobras",
    title: "Câmera de ré",
    description:
      "Amplia a visão da traseira e ajuda nas manobras em vagas apertadas.",
    sourceTags: matchedTags("camera_de_re"),
  });

  add(hasTag("multimidia", "my_link"), {
    id: "multimedia",
    priority: 50,
    conflictGroup: "infotainment",
    category: "Conectividade",
    title: hasTag("my_link") ? "Central MyLink" : "Central multimídia",
    description:
      "Reúne entretenimento e funções do carro em uma tela de acesso simples.",
    sourceTags: matchedTags("multimidia", "my_link"),
  });

  add(hasTag("isofix"), {
    id: "isofix",
    priority: 52,
    category: "Família",
    title: "Fixação ISOFIX",
    description:
      "Facilita a instalação correta de cadeirinhas infantis compatíveis.",
    sourceTags: matchedTags("isofix"),
  });

  add(hasTag("controle_de_tracao"), {
    id: "traction-control",
    priority: 54,
    category: "Segurança",
    title: "Controle de tração",
    description:
      "Ajuda a reduzir a perda de aderência em acelerações e pisos escorregadios.",
    sourceTags: matchedTags("controle_de_tracao"),
  });

  add(hasTag("freios_abs", "freios_abs_com_ebd"), {
    id: "abs-brakes",
    priority: 56,
    category: "Segurança",
    title: "Freios ABS",
    description:
      "Ajuda a manter o controle direcional do carro em frenagens intensas.",
    sourceTags: matchedTags("freios_abs", "freios_abs_com_ebd"),
  });

  add(hasDifferential("unico_dono"), {
    id: "single-owner",
    priority: 58,
    category: "Histórico",
    title: "Único dono",
    description:
      "Um histórico de propriedade mais simples de acompanhar e verificar.",
    sourceTags: [],
  });

  add(hasVerifiedLowMileage, {
    id: "low-mileage",
    priority: 60,
    category: "Uso",
    title: "Baixa quilometragem",
    description:
      "Rodagem abaixo do esperado para o perfil deste veículo no estoque.",
    sourceTags: [],
  });

  add(hasDifferential("pneus_novos"), {
    id: "new-tires",
    priority: 62,
    category: "Conservação",
    title: "Pneus novos",
    description:
      "Um item importante de segurança e manutenção já renovado neste carro.",
    sourceTags: [],
  });

  add(hasTag("direcao_eletrica"), {
    id: "electric-steering",
    priority: 64,
    category: "Conforto ao dirigir",
    title: "Direção elétrica",
    description:
      "Deixa o volante leve nas manobras sem perder precisão em movimento.",
    sourceTags: matchedTags("direcao_eletrica"),
  });

  add(hasTag("som_radio"), {
    id: "bluetooth",
    priority: 66,
    category: "Conectividade",
    title: "Bluetooth",
    description:
      "Permite ouvir áudio e atender chamadas usando o sistema do carro.",
    sourceTags: matchedTags("som_radio"),
  });

  const selected: VehicleHighlight[] = [];
  const consumedTags = new Set<string>();
  const consumedGroups = new Set<string>();
  for (const {
    priority: _priority,
    conflictGroup,
    ...candidate
  } of candidates.sort((left, right) => left.priority - right.priority)) {
    if (conflictGroup && consumedGroups.has(conflictGroup)) continue;
    if (
      candidate.sourceTags.length > 0 &&
      candidate.sourceTags.some((tag) => consumedTags.has(tag))
    ) {
      continue;
    }
    selected.push(candidate);
    if (conflictGroup) consumedGroups.add(conflictGroup);
    candidate.sourceTags.forEach((tag) => consumedTags.add(tag));
    if (selected.length === MAX_REGULAR_HIGHLIGHTS) break;
  }

  const trunkCapacity = extractTrunkCapacity(anuncio, vehicle);
  const highlights: VehicleHighlight[] = trunkCapacity
    ? [
        {
          id: "trunk-capacity",
          category: "Porta-malas",
          title: "Espaço para bagagens no dia a dia",
          description:
            "Volume útil para bagagens, compras e a rotina da família.",
          sourceTags: [],
          metric: { value: String(trunkCapacity), unit: "L" },
        },
        ...selected,
      ]
    : selected;

  return {
    highlights,
    explainedTags: new Set(
      selected.flatMap((highlight) => highlight.sourceTags),
    ),
  };
}
