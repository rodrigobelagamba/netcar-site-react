import {
  resolveVehicleEquipment,
  type EquipmentVehicle,
} from "../../../lib/vehicleEquipment";

type ReviewedCaption = {
  visual: string;
  equipmentId?: string;
  withEquipment?: string;
};

// Captions describe the reviewed photos of this unit, never a model-family guess.
const HRV_19898_CAPTIONS: Record<string, ReviewedCaption> = {
  CAPA: { visual: "Vista dianteira do HR-V" },
  "6": { visual: "Desenho da frente" },
  "7": { visual: "Vista dianteira e lateral" },
  "9": { visual: "Traseira em três quartos" },
  "10": { visual: "Vista traseira" },
  "8": { visual: "Outro ângulo da traseira" },
  "11": {
    visual: "Bancos e acabamento interno",
    equipmentId: "leather-seats",
    withEquipment: "Conforto dos bancos em couro",
  },
  "1": { visual: "Espaço dianteiro" },
  "12": { visual: "Volante e comandos" },
  "2": {
    visual: "Seletor de câmbio e console",
    equipmentId: "cvt-transmission",
    withEquipment: "Câmbio CVT, sem trocas manuais",
  },
  "3": { visual: "Painel e interior" },
  "4": {
    visual: "Multimídia e climatização",
    equipmentId: "digital-climate",
    withEquipment: "Multimídia e ar digital",
  },
  "5": {
    visual: "Comandos de partida e volante",
    equipmentId: "push-start",
    withEquipment: "Partida por botão",
  },
};

// Reviewed individually in the public gallery on 2026-10-26. The last detail
// photos differ from the Touring sequence: 3 is the screen, 4 is push-start.
const HRV_19854_CAPTIONS: Record<string, ReviewedCaption> = {
  CAPA: { visual: "Vista dianteira do HR-V Advance" },
  "6": { visual: "Grade e faróis dianteiros" },
  "7": { visual: "Vista dianteira e lateral" },
  "9": { visual: "Vista traseira e lateral" },
  "10": {
    visual: "Traseira e para-choque",
    equipmentId: "rear-camera",
    withEquipment: "Câmera de ré nas manobras",
  },
  "8": { visual: "Outro ângulo da traseira" },
  "11": {
    visual: "Bancos e acabamento claro",
    equipmentId: "leather-seats",
    withEquipment: "Bancos em couro claro",
  },
  "1": { visual: "Painel e console central" },
  "12": {
    visual: "Volante e instrumentos",
    equipmentId: "steering-controls",
    withEquipment: "Comandos no volante",
  },
  "2": {
    visual: "Seletor de câmbio e console",
    equipmentId: "cvt-transmission",
    withEquipment: "Câmbio CVT ao alcance",
  },
  "3": {
    visual: "Tela e climatização",
    equipmentId: "wireless-carplay-android",
    withEquipment: "Android Auto e Apple CarPlay",
  },
  "4": {
    visual: "Comandos junto ao volante",
    equipmentId: "push-start",
    withEquipment: "Partida por botão",
  },
  "5": { visual: "Cabine vista pela porta" },
};

const reviewedPhotoSets = [
  {
    vehicleId: "19898",
    model: /^HR[ -]?V TOURING TURBO$/i,
    filename: /^25072026HRV TOURING JCI5J59(CAPA|\d+)(?:_small)?\.(?:avif|jpg|jpeg|png|webp)$/i,
    captions: HRV_19898_CAPTIONS,
  },
  {
    vehicleId: "19854",
    model: /^HR[ -]?V ADVANCE TURBO$/i,
    filename: /^15062026HRV JCN8I74(CAPA|\d+)(?:_small)?\.(?:avif|jpg|jpeg|png|webp)$/i,
    captions: HRV_19854_CAPTIONS,
  },
];

function reviewedImageKey(image: string, filename: RegExp): string | undefined {
  try {
    const path = decodeURIComponent(image.split(/[?#]/, 1)[0]);
    return path
      .split("/")
      .pop()
      ?.match(filename)?.[1]
      .toUpperCase();
  } catch {
    return undefined;
  }
}

export function buildVehiclePhotoCaptions(
  vehicle: EquipmentVehicle | undefined,
  images: readonly string[],
): string[] {
  const reviewedPhotos = reviewedPhotoSets.find((review) =>
    String(vehicle?.id) === review.vehicleId &&
    String(vehicle?.marca).toUpperCase() === "HONDA" &&
    review.model.test(vehicle?.modelo || vehicle?.name || "") &&
    String(vehicle?.year) === "2024",
  );
  if (!reviewedPhotos) {
    return images.map(() => "");
  }
  const equipmentIds = new Set(
    vehicle ? resolveVehicleEquipment(vehicle).items.map((item) => item.id) : [],
  );

  return images.map((image) => {
    const key = reviewedImageKey(image, reviewedPhotos.filename);
    const caption = key ? reviewedPhotos.captions[key] : undefined;
    if (!caption) return "";
    if (
      caption.equipmentId &&
      caption.withEquipment &&
      equipmentIds.has(caption.equipmentId)
    ) {
      return caption.withEquipment;
    }
    return caption.visual;
  });
}
