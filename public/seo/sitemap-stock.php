<?php
require_once __DIR__ . '/landing-stock.php';

/** Preserve the generated editorial URLs, never the generated availability. */
function netcar_live_sitemap($source, $stock)
{
    if (!is_string($source) || !preg_match('#<urlset\b[^>]*xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"[^>]*>#', $source)
        || !preg_match('#</urlset>\s*$#', $source)) return null;
    preg_match_all('#<url>\s*(.*?)\s*</url>#s', $source, $matches);
    if (!$matches[0]) return null;
    $entries = array();
    $seen = array();
    foreach ($matches[0] as $entry) {
        if (!preg_match('#<loc>([^<]+)</loc>#', $entry, $loc)) return null;
        $url = html_entity_decode($loc[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
        if (strpos($url, SEO_SITE_URL . '/') !== 0) return null;
        if (strpos($url, SEO_SITE_URL . '/veiculo/') === 0) continue;
        if (isset($seen[$url])) continue;
        $seen[$url] = true;
        $entries[] = $entry;
    }
    foreach (netcar_landing_selection($stock, array()) as $vehicle) {
        $url = SEO_SITE_URL . '/veiculo/' . netcar_landing_vehicle_slug($vehicle);
        if (isset($seen[$url])) continue;
        $seen[$url] = true;
        // Feed does not expose a trustworthy modification timestamp. Omitting
        // lastmod is preferable to claiming every request changed every car.
        $entries[] = '<url><loc>' . htmlspecialchars($url, ENT_QUOTES | ENT_XML1, 'UTF-8') . '</loc><changefreq>daily</changefreq><priority>0.8</priority></url>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n" . implode("\n", $entries) . "\n</urlset>\n";
}
