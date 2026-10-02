import { optimizeStockImage } from "@/lib/images";

export type StoreId = "Loja1" | "Loja2";

type StoreBanner = { imagem: string; titulo?: string; tipo?: string };
export type StorePhoto = { src: string; alt: string };

const ORIGIN = "https://www.netcarmultimarcas.com.br";

/** Galerias incluem fotos de celular: o redimensionamento precisa preservar EXIF. */
export function storePhotoSource(src: string, width: number): string {
  const optimized = optimizeStockImage(src, width);
  return optimized !== src &&
    /\/imagens\/banner\//.test(new URL(src, ORIGIN).pathname)
    ? `${optimized}&orient=1`
    : optimized;
}

export function storePhotoSrcSet(
  src: string,
  widths: number[],
): string | undefined {
  const variants = widths.map((width) => ({
    width,
    src: storePhotoSource(src, width),
  }));
  return new Set(variants.map((variant) => variant.src)).size > 1
    ? variants.map((variant) => `${variant.src} ${variant.width}w`).join(", ")
    : undefined;
}

/** A fachada local abre a galeria; as demais fotos vêm do cadastro da própria loja. */
export function buildStoreGallery(
  store: StoreId,
  banners: StoreBanner[] = [],
): StorePhoto[] {
  const number = store === "Loja1" ? 1 : 2;
  const cover = `/images/loja${number}.webp`;
  const photos = [{ src: cover, alt: `Fachada da Loja ${number}` }];
  const seen = new Set([new URL(cover, ORIGIN).pathname]);

  for (const banner of banners) {
    if (!banner.imagem || /fachada/i.test(banner.titulo ?? "")) continue;
    if (
      banner.tipo &&
      banner.tipo.replace(/\s/g, "").toLowerCase() !== store.toLowerCase()
    )
      continue;
    try {
      const url = new URL(banner.imagem.trim().replace(/\\/g, "/"), ORIGIN);
      // Não enviar fotos externas ao proxy nem tentar exibir HEIC/arquivos inválidos.
      if (
        url.origin !== ORIGIN ||
        !/\.(jpe?g|png|webp|avif)$/i.test(url.pathname)
      )
        continue;
      if (seen.has(url.pathname)) continue;
      seen.add(url.pathname);
      photos.push({
        src: url.href,
        alt: `Loja ${number} — foto ${photos.length + 1}`,
      });
    } catch {
      // Um cadastro inválido não deve impedir a exibição das outras fotos.
    }
  }
  return photos;
}
