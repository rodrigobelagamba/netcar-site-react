export interface VehicleInstagramVideo {
  vehicleId: string;
  /** Nome curto, conferido, usado no convite para assistir. */
  displayModel?: string;
  permalink: string;
  /** Capa conferida do Reel, servida pelo próprio site (sem chamada à Meta). */
  coverImage?: string;
  /** Conferência manual da unidade e da publicação, não apenas do modelo. */
  verifiedAt: string;
}

/**
 * Publicações conferidas por unidade, nunca apenas pelo modelo.
 * Novos vínculos ainda são manuais; ver docs/vehicle-videos.md.
 * Fonte da expansão: feed público @netcar_rc, 05/09/2026 (Brasília),
 * com #netcar<ID>/URL exata e estoque ativo conferidos para cada entrada.
 */
export const vehicleInstagramVideos: readonly VehicleInstagramVideo[] = [
  {
    // HRV EX 2018: legenda do Reel contém #netcar19739.
    // @netcar_rc, publicado em 04/09/2026; reprodução conferida no Instagram.
    vehicleId: "19739",
    displayModel: "HR-V",
    permalink: "https://www.instagram.com/reel/Dc3r9k7in-R/",
    // Frame real aos 12s do Reel: interior. WebP local 640×1138, 55 kB.
    // Fonte: /reel/Dc3r9k7in-R/embed/, GraphVideo 3978842143346818961,
    // autor netcar_rc e #netcar19739 conferidos. Não é imagem ilustrativa.
    coverImage: "/images/vehicle-videos/19739-dc3r9k7in-r-interior-12s.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19884",
    displayModel: "Fastback",
    permalink: "https://www.instagram.com/reel/Dc1HOgyj5Y7/",
    coverImage: "/images/vehicle-videos/19884-dc1hogyj5y7-cover.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19953",
    displayModel: "Tiggo 5X",
    permalink: "https://www.instagram.com/reel/DcyQddbiakp/",
    coverImage: "/images/vehicle-videos/19953-dcyqddbiakp-cover.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19299",
    displayModel: "Kicks",
    permalink: "https://www.instagram.com/reel/DcrVs8fAnVu/",
    coverImage: "/images/vehicle-videos/19299-dcrvs8fanvu-cover.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19965",
    displayModel: "Onix",
    permalink: "https://www.instagram.com/reel/DcoB720kcXO/",
    coverImage: "/images/vehicle-videos/19965-dcob720kcxo-cover.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19868",
    displayModel: "Creta",
    permalink: "https://www.instagram.com/reel/Dcl-eieFueP/",
    coverImage: "/images/vehicle-videos/19868-dcl-eiefuep-cover.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19973",
    displayModel: "EcoSport",
    permalink: "https://www.instagram.com/reel/DcjxxliEtT1/",
    coverImage: "/images/vehicle-videos/19973-dcjxxliett1-cover.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19962",
    displayModel: "Captur",
    permalink: "https://www.instagram.com/reel/DcgU5OlgJLQ/",
    coverImage: "/images/vehicle-videos/19962-dcgu5olgjlq-cover.webp",
    verifiedAt: "2026-09-05",
  },
  {
    vehicleId: "19901",
    displayModel: "Tracker",
    permalink: "https://www.instagram.com/reel/DceCDR5Cjlo/",
    coverImage: "/images/vehicle-videos/19901-dcecdr5cjlo-cover.webp",
    verifiedAt: "2026-09-05",
  },
];

export function normalizeVehicleVideoCover(value?: string): string | undefined {
  return value && /^\/images\/vehicle-videos\/[A-Za-z0-9_-]+\.(?:webp|jpe?g|png)$(?![\s\S])/.test(value)
    ? value
    : undefined;
}

/** Só links de publicações do Instagram; nunca perfil, redirect ou mídia temporária. */
export function normalizeInstagramVideoUrl(value: string): string | undefined {
  try {
    const input = value.trim();
    // Validar antes de URL normalizar portas padrão, barras e segmentos '..'.
    if (
      !/^https:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[A-Za-z0-9_-]+\/?(?:[?#][^\s]*)?$/i.test(
        input,
      )
    ) {
      return undefined;
    }
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return undefined;
    }
    const match = url.pathname.match(/^\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) return undefined;
    return `https://www.instagram.com/${match[1]}/${match[2]}/`;
  } catch {
    return undefined;
  }
}

export function getVehicleInstagramVideo(
  vehicleId: string,
  videos: readonly VehicleInstagramVideo[] = vehicleInstagramVideos,
): VehicleInstagramVideo | undefined {
  const matches = videos.filter((video) => video.vehicleId === vehicleId);
  // Uma associação ambígua fica invisível até ser revisada.
  if (matches.length !== 1 || !matches[0].verifiedAt) return undefined;
  const permalink = normalizeInstagramVideoUrl(matches[0].permalink);
  return permalink ? { ...matches[0], permalink } : undefined;
}
