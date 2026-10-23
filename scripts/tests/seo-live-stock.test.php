<?php
require __DIR__ . '/../../public/seo/comparison-stock.php';
require __DIR__ . '/../../public/seo/sitemap-stock.php';

$checks = 0;
function check_stock($condition, $message) {
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function live_vehicle($id, $brand, $model, $price) {
    return array('id' => (string) $id, 'marca' => $brand, 'modelo' => $model, 'valor' => $price, 'ano' => 2024, 'km' => 15000, 'cambio' => 'AUTOMATICO', 'imagens_site' => array('tem_fotos' => 0));
}
$stock = array(live_vehicle(11, 'FIAT', 'FASTBACK', 125900), live_vehicle(12, 'VOLKSWAGEN', 'NIVUS', 120000), live_vehicle(13, 'FIAT', 'FASTBACK', 0), live_vehicle(14, 'VOLKSWAGEN', 'NIVUS', 126000));
$page = array('slug' => 'nivus-x-fastback', 'left' => array('brand' => 'VOLKSWAGEN', 'model' => 'NIVUS', 'label' => 'Nivus'), 'right' => array('brand' => 'FIAT', 'model' => 'FASTBACK', 'label' => 'Fastback'), 'stockNote' => 'Confira estas unidades.');
$pair = netcar_comparison_selection($stock, $page);
check_stock(array_column($pair['pair'], 'id') === array('14', '11'), 'closest current-price pair selected, sold unit ignored');
$relativePhoto = './imagens/veiculos_automacar/02102026COMPASS LIMITED IXN3G56CAPA_small.png';
$absolutePhoto = SEO_SITE_URL . '/imagens/veiculos_automacar/02102026COMPASS%20LIMITED%20IXN3G56CAPA_small.png';
foreach (array($relativePhoto, substr($relativePhoto, 1), substr($relativePhoto, 2), $absolutePhoto) as $raw) {
    check_stock(netcar_comparison_image_url($raw) === $absolutePhoto, 'relative/root/absolute media resolve to the same canonical root URL without double encoding');
}
check_stock(netcar_comparison_image_url('https://cdn.example.com/a%20b (1).png?v=2&fit=cover') === 'https://cdn.example.com/a%20b%20%281%29.png?v=2&fit=cover', 'absolute external photo retains origin/query and encodes its path once');
check_stock(netcar_comparison_image_url('//cdn.example.com/foto.png') === 'https://cdn.example.com/foto.png', 'protocol-relative image is made HTTPS absolute');
check_stock(netcar_comparison_image_url('http://cdn.example.com/foto.png') === 'https://cdn.example.com/foto.png', 'legacy HTTP image follows existing HTTPS media policy');
foreach (array('javascript:alert(1)', 'data:image/svg+xml,unsafe', '../private.png', 'https://user:secret@cdn.example.com/a.png', "https://cdn.example.com/a\n.png") as $invalid) {
    check_stock(netcar_comparison_image_url($invalid) === '', 'unsupported/unsafe media URL rejected');
}
$pictured = array_replace_recursive($stock[0], array('imagens_site' => array('tem_fotos' => 1, 'capa_thumb' => $relativePhoto)));
check_stock(netcar_comparison_image($pictured) === $absolutePhoto, 'existing vehicle image policy passes through the URL normalizer');
$head = '<html><head><title>Comparação</title><link rel="canonical" href="' . SEO_SITE_URL . '/comparar"><meta property="og:image" content="https://example.com/old-sold.jpg"></head><body>';
$stockMarker = '<!--netcar:comparison-stock:start-->stale-sold-13-price-999999<!--netcar:comparison-stock:end-->';
$examplesMarker = '<!--netcar:comparison-examples:start-->stale-sold-13<!--netcar:comparison-examples:end-->';
$html = netcar_comparison_html($head . $examplesMarker . $stockMarker . '</body></html>', $stock, array($page));
check_stock($html !== null && strpos($html, 'stale-sold') === false, 'hub replaces every availability fragment');
check_stock(strpos($html, 'numberOfItems":3') !== false && substr_count($html, 'class="blog-car"') === 3, 'hub ItemList describes exactly the three visible cards');
check_stock(strpos($html, '126.000') !== false && strpos($html, '999999') === false, 'current advertised prices only');
check_stock(strpos($html, '"@type":"WebPage"') === false, 'does not replace/add editorial page schema');
$pairHtml = netcar_comparison_html($head . $stockMarker . '</body></html>', $stock, array($page), $page);
check_stock(strpos($pairHtml, 'data-comparison-stock="complete"') !== false, 'complete current pair');
check_stock(strpos($pairHtml, '<table>') !== false && strpos($pairHtml, 'numberOfItems":2') !== false, 'table/schema same current pair');
check_stock(strpos($pairHtml, 'old-sold.jpg') === false && strpos($pairHtml, '/images/loja1.jpg') !== false, 'pair social cover does not retain a sold vehicle');
check_stock(strpos($pairHtml, '<th scope="row">Km') === false && strpos($pairHtml, 'Quilometragem') === false, 'keeps prior decision not to show km in comparator');
$picturedPair = netcar_comparison_html($head . $stockMarker . '</body></html>', array(array_replace_recursive($stock[1], array('imagens_site' => array('tem_fotos' => 1, 'capa_thumb' => $relativePhoto))), $stock[0]), array($page), $page);
check_stock(strpos($picturedPair, '<meta property="og:image" content="' . $absolutePhoto . '"') !== false && strpos($picturedPair, '<img src="' . $absolutePhoto . '"') !== false, 'pair OG and visible photo use the same absolute encoded media URL');
$picturedHub = netcar_comparison_html($head . $examplesMarker . $stockMarker . '</body></html>', array($pictured), array($page));
check_stock(strpos($picturedHub, '<img src="' . $absolutePhoto . '"') !== false, 'hub card photo resolves independently of the route path');
$partial = netcar_comparison_html($head . $stockMarker . '</body></html>', array($stock[0], $stock[2]), array($page), $page);
check_stock(strpos($partial, 'data-comparison-stock="partial"') !== false && strpos($partial, '<table>') === false && strpos($partial, 'numberOfItems":1') !== false, 'one available model gives partial guide, not fake pair');
$empty = netcar_comparison_html($head . $stockMarker . '</body></html>', array($stock[2]), array($page), $page);
check_stock(strpos($empty, 'data-comparison-stock="empty"') !== false && strpos($empty, 'numberOfItems":0') !== false && strpos($empty, 'R$') === false, 'confirmed zero active units never retain stale offer');
check_stock(netcar_comparison_html($head . '</body></html>', $stock, array($page), $page) === null, 'missing stock marker fails closed');
check_stock(netcar_comparison_html($head . $stockMarker . $stockMarker . '</body></html>', $stock, array($page), $page) === null, 'duplicate stock markers fail closed');
$malicious = live_vehicle(99, 'FIAT', 'A </script><script>alert(1)</script> & "x"', 100000);
$escaped = netcar_comparison_html($head . $examplesMarker . $stockMarker . '</body></html>', array($malicious), array($page));
check_stock(strpos($escaped, '<script>alert(1)') === false && strpos($escaped, '&lt;/script&gt;') !== false, 'feed text escaped in HTML and JSON-LD');
preg_match('#<script type="application/ld\+json" data-netcar-comparison-stock>(.*?)</script>#s', $escaped, $schema);
check_stock(is_array(json_decode($schema[1] ?? '', true)), 'escaped ItemList is valid JSON');

$editorial = '<url><loc>' . SEO_SITE_URL . '/seminovos-canoas</loc><lastmod>2026-10-01</lastmod></url>';
$old = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . $editorial . '<url><loc>' . SEO_SITE_URL . '/veiculo/old-13</loc><lastmod>2026-10-01</lastmod></url></urlset>';
$xml = netcar_live_sitemap($old, $stock);
check_stock(strpos($xml, $editorial) !== false && strpos($xml, '/veiculo/old-13') === false, 'editorial timestamps preserved, obsolete vehicle entries removed');
check_stock(substr_count($xml, '/veiculo/') === 3 && strpos($xml, '/veiculo/nivus-2024-14') !== false, 'new active vehicles added with canonical slug');
check_stock(substr_count($xml, '<lastmod>') === 1, 'does not invent modification dates for vehicles');
$dom = new DOMDocument();
check_stock($dom->loadXML($xml), 'generated sitemap XML is valid');
$noOffers = netcar_live_sitemap($old, array($stock[2]));
check_stock(strpos($noOffers, $editorial) !== false && strpos($noOffers, '/veiculo/') === false, 'confirmed sold-only feed preserves editorial sitemap');
check_stock(netcar_live_sitemap('<html>not a sitemap</html>', $stock) === null, 'invalid source cannot become accepted sitemap');
check_stock(netcar_live_sitemap(str_replace(SEO_SITE_URL . '/seminovos-canoas', 'https://attacker.example/page', $old), $stock) === null, 'unexpected origin rejected');
$htaccess = file_get_contents(__DIR__ . '/../../public/.htaccess');
$rule = 'RewriteRule ^sitemap\.xml$ seo-sitemap.php [L]';
check_stock(strpos($htaccess, $rule) < strpos($htaccess, 'RewriteCond %{REQUEST_FILENAME} -f'), 'live sitemap runs before static file short circuit');
echo 'Live SEO stock PHP: ' . $checks . " checks passed\n";
