<?php
require __DIR__ . '/../../public/seo/showcase-stock.php';

$checks = 0;
function check_showcase($condition, $message) {
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function showcase_vehicle($id, $model, $price, $photo = true) {
    return array('id' => (string) $id, 'marca' => 'VOLKSWAGEN', 'modelo' => $model,
        'valor' => $price, 'ano' => 2026, 'km' => 15000, 'cambio' => 'AUTOMATICO',
        'imagens_site' => array('tem_fotos' => $photo ? 1 : 0,
            'capa_thumb' => $photo ? './imagens/fixture ' . $id . '.png' : null));
}
function showcase_marker($config, $stale = 'STALE-20018-156900') {
    return '<!--netcar:showcase:' . base64_encode(json_encode($config)) . ':start-->' . $stale . '<!--netcar:showcase:end-->';
}
function showcase_schema($html) {
    preg_match_all('#<script\b[^>]*type="application/ld\+json"[^>]*>(.*?)</script>#s', $html, $matches);
    foreach ($matches[1] as $raw) {
        $schema = json_decode($raw, true);
        if (($schema['@type'] ?? null) === 'ItemList') return $schema;
    }
    return null;
}
$canonical = SEO_SITE_URL . '/vender-carro-campo-bom';
$head = '<!doctype html><html><head><title>Campo Bom</title><link rel="canonical" href="' . $canonical . '"><script type="application/ld+json">{"@type":"WebPage","name":"EDITORIAL-SCHEMA"}</script></head><body><p>EDITORIAL-PRESERVED</p>';
$config = array('version' => 1, 'mode' => 'selection', 'heading' => 'Carros para troca', 'limit' => 8, 'order' => 'api', 'ctaHref' => SEO_SITE_URL . '/seminovos', 'ctaLabel' => 'Ver estoque');
$template = $head . showcase_marker($config) . '</body></html>';
$old = showcase_vehicle(20018, 'NIVUS GTS', 156900);
$remaining = showcase_vehicle(20019, 'TERA', 129900);
$initial = netcar_showcase_html($template, array($old, $remaining), $canonical);
check_showcase(is_string($initial) && strpos($initial, '156.900') !== false, 'initial current inventory is rendered');
check_showcase(strpos($initial, 'STALE-') === false, 'build-time offers are replaced');
check_showcase(strpos($initial, 'EDITORIAL-PRESERVED') !== false && strpos($initial, 'EDITORIAL-SCHEMA') !== false, 'editorial body and unrelated schema preserved');
check_showcase(strpos($initial, '<link rel="canonical" href="' . $canonical . '">') !== false, 'canonical preserved');
$added = showcase_vehicle(20020, 'T CROSS', 139900);
$changed = $remaining;
$changed['valor'] = 127900;
$changed['km'] = 8800;
$changed['modelo'] = 'TERA HIGH';
$changed['imagens_site']['capa_thumb'] = './imagens/updated photo.png';
$next = netcar_showcase_html($template, array($changed, $added), $canonical);
check_showcase(strpos($next, '20018') === false && strpos($next, '156.900') === false, 'absent ID and its old price disappear without rebuilding');
check_showcase(strpos($next, '20020') !== false && strpos($next, '139.900') !== false, 'new vehicle enters the showcase without rebuilding');
check_showcase(strpos($next, '127.900') !== false && strpos($next, '129.900') === false && strpos($next, 'TERA HIGH') !== false, 'current price and model replace initial data');
check_showcase(strpos($next, '8.800') !== false && strpos($next, '15.000') !== false, 'current mileage shown for each unit');
check_showcase(strpos($next, '/imagens/updated%20photo.png') !== false, 'changed media is canonical and encoded');
check_showcase(stripos($next, 'vendido') === false, 'missing source ID is not described as sold');
$schema = showcase_schema($next);
check_showcase(is_array($schema) && $schema['numberOfItems'] === 2 && count($schema['itemListElement']) === 2, 'schema describes exactly the current visible selection');
foreach ($schema['itemListElement'] as $item) check_showcase(strpos($next, 'href="' . $item['url'] . '"') !== false, 'each schema URL has a visible offer');
$noPrice = showcase_vehicle(20021, 'POLO', 0);
$noPhoto = showcase_vehicle(20022, 'GOLF', 100000, false);
$filteredConfig = array_replace($config, array('photosOnly' => true, 'match' => array('field' => 'cambio', 'pattern' => 'AUTOMATICO')));
$manual = showcase_vehicle(20023, 'FOX', 50000);
$manual['cambio'] = 'MANUAL';
$selected = netcar_showcase_selection(array($noPrice, $noPhoto, $manual, $added), $filteredConfig);
check_showcase(array_column($selected, 'id') === array('20020'), 'current field filter, availability and real-photo requirement apply together');
$accented = $added;
$accented['cambio'] = 'Automático';
check_showcase(count(netcar_showcase_selection(array($accented), $filteredConfig)) === 1, 'Portuguese accents do not exclude automatic transmission');
$diff = $added;
$diff['diferenciais'] = array(array('tag' => 'unico_dono', 'descricao' => 'Único dono'));
$differentialConfig = array_replace($config, array('match' => array('field' => 'diferenciais', 'pattern' => 'unico_dono|garantia_fabrica')));
check_showcase(array_column(netcar_showcase_selection(array($manual, $diff), $differentialConfig), 'id') === array('20020'), 'content tag filter reads current differential tags');
$limited = netcar_showcase_html($head . showcase_marker(array_replace($config, array('limit' => 1))) . '</body></html>', array($remaining, $added), $canonical);
check_showcase(showcase_schema($limited)['numberOfItems'] === 1, 'schema count uses displayed limit');
$editorialConfig = array('version' => 1, 'mode' => 'ids', 'ids' => array('20018', '20019'), 'limit' => 8);
$editorial = netcar_showcase_html($head . showcase_marker($editorialConfig) . '</body></html>', array($changed, $added), $canonical);
check_showcase(strpos($editorial, '20019') !== false && strpos($editorial, '127.900') !== false, 'article exact-ID card uses live fields');
check_showcase(strpos($editorial, '20018') === false && strpos($editorial, '20020') === false, 'article removes missing citation without substituting unrelated unit');
$reactivated = netcar_showcase_html($head . showcase_marker($editorialConfig) . '</body></html>', array($old, $changed), $canonical);
check_showcase(strpos($reactivated, '20018') !== false, 'returned exact-ID vehicle reappears');
$empty = netcar_showcase_html($template, array($noPrice), $canonical);
check_showcase(is_string($empty) && strpos($empty, 'STALE-') === false && strpos($empty, 'class="blog-car"') === false, 'confirmed zero active units clear old offer cards');
check_showcase(showcase_schema($empty)['numberOfItems'] === 0, 'empty current selection has zero schema offers');
check_showcase(stripos($empty, 'vendido') === false, 'empty selection does not invent a sale');
$malicious = showcase_vehicle(20024, '</script><script>alert(1)</script> & "x"', 100000);
$escaped = netcar_showcase_html($template, array($malicious), $canonical);
check_showcase(strpos($escaped, '<script>alert(1)') === false && strpos($escaped, '&lt;/script&gt;') !== false && is_array(showcase_schema($escaped)), 'source fields are escaped in HTML and JSON-LD');
check_showcase(netcar_showcase_html($head . '<!--netcar:showcase:!!!:start-->old<!--netcar:showcase:end--></body></html>', array($old), $canonical) === null, 'malformed marker fails closed');
check_showcase(netcar_showcase_html($head . showcase_marker(array('version' => 99, 'mode' => 'selection')) . '</body></html>', array($old), $canonical) === null, 'unknown manifest version fails closed');
check_showcase(netcar_showcase_html($head . '<!--netcar:showcase:' . base64_encode(json_encode($config)) . ':start-->old</body></html>', array($old), $canonical) === null, 'unterminated fragment fails closed');
$coverTemplate = $head . '<meta property="og:image" content="https://example.com/old.jpg"><script type="application/ld+json" data-netcar-blog-post>{"@type":"BlogPosting","headline":"Editorial title","image":["https://example.com/old.jpg"]}</script><!--netcar:blog-cover:start--><img src="https://example.com/old.jpg"><!--netcar:blog-cover:end-->' . showcase_marker($editorialConfig) . '</body></html>';
$cover = netcar_showcase_html($coverTemplate, array($changed), SEO_SITE_URL . '/blog/fixture');
check_showcase(strpos($cover, 'old.jpg') === false && substr_count($cover, 'updated%20photo.png') >= 3, 'article cover, social image and BlogPosting image follow current visible vehicle');
check_showcase(strpos($cover, 'Editorial title') !== false, 'blog headline is preserved when updating cover');
$neutralCover = netcar_showcase_html($coverTemplate, array($added), SEO_SITE_URL . '/blog/fixture');
check_showcase(strpos($neutralCover, 'old.jpg') === false && strpos($neutralCover, '/images/loja1.jpg') !== false, 'article with no cited active vehicle uses neutral cover');
check_showcase(netcar_showcase_selection(array($added), array_replace($config, array('match' => array('field' => 'cambio', 'pattern' => '[')))) === null, 'invalid source filter fails closed');
check_showcase(netcar_showcase_selection(array($added), array_replace($config, array('limit' => 501))) === null, 'invalid selection limit fails closed');
echo 'Showcase live stock PHP: ' . $checks . " checks passed\n";
