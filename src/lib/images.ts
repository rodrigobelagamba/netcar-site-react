/**
 * Otimização de imagens do estoque via /img.php (resize + WebP no servidor).
 * As capas originais chegam a 3600px/5MB — o hero exibe no máx ~1600px.
 * img.php nunca faz upscale, então a nitidez do original é preservada.
 */
const STOCK_IMAGE_PATH = /\/(imagens|images)\//;
const RASTER_EXT = /\.(png|jpe?g|webp)$/i;
const AVIF_EXT = /\.avif$/i;

/** react-pdf não decodifica AVIF — troca por .jpg irmão no estoque. Logos PNG ficam intactos. */
export function toPdfSafeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url, "https://www.netcarmultimarcas.com.br");
    if (STOCK_IMAGE_PATH.test(u.pathname) && AVIF_EXT.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\.avif$/i, ".jpg");
      return u.href;
    }
    return url;
  } catch {
    return url;
  }
}

export function optimizeStockImage(
  url: string | null | undefined,
  width = 1600,
): string {
  if (!url) return "";
  try {
    const u = new URL(url, "https://www.netcarmultimarcas.com.br");
    if (!STOCK_IMAGE_PATH.test(u.pathname) || !RASTER_EXT.test(u.pathname)) {
      return url;
    }
    return `${u.origin}/img.php?src=${encodeURIComponent(u.pathname)}&w=${width}`;
  } catch {
    return url;
  }
}

/** Cria variantes responsivas apenas quando o proxy realmente altera a URL. */
export function stockImageSrcSet(
  url: string | null | undefined,
  widths: number[] = [480, 768, 1280, 1920],
): string | undefined {
  if (!url) return undefined;
  const variants = widths.map((width) => ({
    width,
    url: optimizeStockImage(url, width),
  }));
  if (new Set(variants.map((variant) => variant.url)).size <= 1) {
    return undefined;
  }
  return variants
    .map((variant) => `${variant.url} ${variant.width}w`)
    .join(", ");
}

/** Detail-only, prebuilt AVIF variants; the endpoint falls back to the same WebP. */
export function stockDetailAvifSrcSet(
  url: string | null | undefined,
  widths: number[],
): string | undefined {
  if (!url) return undefined;
  try {
    const source = new URL(url, "https://www.netcarmultimarcas.com.br");
    if (!["netcarmultimarcas.com.br", "www.netcarmultimarcas.com.br"].includes(source.hostname)
      || source.username || source.password || source.port) return undefined;
  } catch {
    return undefined;
  }
  const variants = widths.map((width) => {
    const optimized = optimizeStockImage(url, width);
    if (optimized === url) return undefined;
    const variant = new URL(optimized);
    variant.pathname = "/vehicle-photo.php";
    variant.searchParams.set("v", "1");
    return `${variant.pathname}${variant.search} ${width}w`;
  });
  return variants.every(Boolean) ? variants.join(", ") : undefined;
}

/**
 * A API da galeria entrega AVIFs originais de até ~1 MB por foto. O servidor
 * também mantém um JPG irmão em /big/, que pode passar pelo img.php e virar um
 * WebP pequeno. Usar esse irmão somente na grade preserva o AVIF original no
 * lightbox e evita baixar vários megabytes durante a abertura da página.
 */
export function stockGalleryPreviewSource(
  url: string | null | undefined,
): string {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.netcarmultimarcas.com.br");
    if (
      AVIF_EXT.test(parsed.pathname) &&
      parsed.pathname.includes("/imagens/veiculos_automacar/") &&
      !parsed.pathname.includes("/imagens/veiculos_automacar/big/")
    ) {
      parsed.pathname = parsed.pathname
        .replace(
          "/imagens/veiculos_automacar/",
          "/imagens/veiculos_automacar/big/",
        )
        .replace(/\.avif$/i, ".jpg");
      return parsed.href;
    }
    return url;
  } catch {
    return url;
  }
}
