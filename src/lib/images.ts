/**
 * Otimização de imagens do estoque via /img.php (resize + WebP no servidor).
 * As capas originais chegam a 3600px/5MB — o hero exibe no máx ~1600px.
 * img.php nunca faz upscale, então a nitidez do original é preservada.
 */
const STOCK_IMAGE_PATH = /\/(imagens|images)\//;
const RASTER_EXT = /\.(png|jpe?g)$/i;

export function optimizeStockImage(url: string | null | undefined, width = 1600): string {
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
