const PUBLIC_ORIGIN = "https://www.netcarmultimarcas.com.br";

export interface HeroGallerySlide {
  image: string;
  caption: string;
  isCover: boolean;
  /** Index in the original gallery; a distinct cover has no gallery index. */
  canonicalIndex: number | null;
}

function exactImageKey(image: string): string {
  try {
    const url = new URL(image, PUBLIC_ORIGIN);
    url.hash = "";
    return url.href;
  } catch {
    return image;
  }
}

/** Only known cover renditions in the same stock directory can be equivalent. */
function coverRenditionKey(image: string): string | null {
  try {
    const url = new URL(image, PUBLIC_ORIGIN);
    if (url.origin !== PUBLIC_ORIGIN) return null;
    const path = decodeURIComponent(url.pathname).replace(
      /^\/imagens\/veiculos_automacar\/(?:big|small)\//,
      "/imagens/veiculos_automacar/",
    );
    if (
      !/^\/imagens\/veiculos_automacar\/[^/]+CAPA(?:_small)?\.(?:png|avif|jpe?g|webp)$/i.test(
        path,
      )
    ) {
      return null;
    }
    return `${url.origin}${path.replace(/(?:_small)?\.(?:png|avif|jpe?g|webp)$/i, "")}${url.search}`;
  } catch {
    return null;
  }
}

/** Cover first, then the existing gallery order, without a second cover rendition. */
export function buildVehicleHeroGallery(
  cover: string,
  gallery: readonly string[],
  captions: readonly string[],
  coverCaption: string,
): HeroGallerySlide[] {
  const coverKey = cover ? exactImageKey(cover) : null;
  const renditionKey = cover ? coverRenditionKey(cover) : null;
  const matchesCover = (image: string) =>
    coverKey !== null &&
    (exactImageKey(image) === coverKey ||
      (renditionKey !== null && coverRenditionKey(image) === renditionKey));
  const coverIndex = cover ? gallery.findIndex(matchesCover) : -1;
  const slides: HeroGallerySlide[] = cover
    ? [
        {
          image: cover,
          caption: (coverIndex >= 0 && captions[coverIndex]) || coverCaption,
          isCover: true,
          canonicalIndex: coverIndex >= 0 ? coverIndex : null,
        },
      ]
    : [];
  const seen = new Set<string>(coverKey === null ? [] : [coverKey]);
  gallery.forEach((image, canonicalIndex) => {
    if (!image || matchesCover(image)) return;
    const key = exactImageKey(image);
    if (seen.has(key)) return;
    seen.add(key);
    slides.push({
      image,
      caption: captions[canonicalIndex] || "",
      isCover: false,
      canonicalIndex,
    });
  });
  return slides;
}
