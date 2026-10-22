<?php
require __DIR__ . '/../../public/seo/landing-stock.php';

$checks = 0;
function check_landing($condition, $message)
{
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function landing_vehicle($id, $price, $extra = array())
{
    return array_merge(array('id' => (string) $id, 'valor' => $price, 'marca' => 'CHERY', 'modelo' => 'TIGGO ' . $id, 'ano' => 2024, 'km' => 30000, 'cambio' => 'AUTOMATICO', 'categoria' => 'SUV'), $extra);
}
function landing_page_response($rows, $status = 200, $extra = array())
{
    return array('status' => $status, 'payload' => array_merge(array('success' => $status === 200, 'data' => $rows, 'total_results' => count($rows)), $extra));
}

$current = array(landing_vehicle(11, 137900), landing_vehicle(12, 149900), landing_vehicle(13, 149900), landing_vehicle(14, 0, array('ano' => 2025)));
$offsets = array();
$received = netcar_landing_fetch_stock(function ($offset, $timeout) use (&$offsets, $current) {
    $offsets[] = $offset;
    check_landing($timeout > 0 && $timeout <= 8000, 'bounded total request budget');
    // Server limit below requested page size: short pages do not terminate.
    if ($offset < 4) return landing_page_response(array_slice($current, $offset, 2));
    return landing_page_response(array(), 404, array('message' => 'Nenhum carro encontrado'));
});
check_landing($received === $current, 'complete API stock accepted including sold history');
check_landing($offsets === array(0, 2, 4), 'actual page count drives pagination');

foreach (array(
    landing_page_response(array(), 404, array('message' => 'Nenhum carro encontrado')),
    landing_page_response(array(), 503),
    array('status' => 200, 'payload' => null),
    landing_page_response(array($current[0]), 200, array('total_results' => 2)),
    landing_page_response(array(landing_vehicle(11, 'invalid'))),
    landing_page_response(array(landing_vehicle(11, -1))),
    landing_page_response(array(landing_vehicle(11, null))),
    landing_page_response(array(landing_vehicle(11, 100), landing_vehicle(11, 200))),
) as $bad) {
    check_landing(netcar_landing_fetch_stock(function () use ($bad) { return $bad; }) === null, 'invalid/incomplete source never becomes an empty selection');
}
check_landing(netcar_landing_fetch_stock(function ($offset) use ($current) { return $offset ? landing_page_response(array(), 503) : landing_page_response($current); }) === null, 'failed terminal request is not complete stock');
check_landing(netcar_landing_fetch_stock(function () use ($current) { return landing_page_response(array($current[0])); }) === null, 'duplicate IDs across pages rejected');
check_landing(netcar_landing_fetch_stock(function ($offset) use ($current) { return $offset ? landing_page_response(array(), 404, array('message' => 'different error')) : landing_page_response($current); }) === null, 'generic404 is not complete stock');

$landing = array(
    'slug' => 'chery', 'type' => 'marca', 'name' => 'Chery', 'h1' => 'Chery seminovos', 'description' => 'Compare Chery', 'filters' => array('marca' => 'CHERY'),
    'paragraphs' => array('Consulte as unidades anunciadas nesta página.'),
    'paragraphTemplates' => array('De {{minPrice}} a {{maxPrice}}; anos {{minYear}} a {{maxYear}}; {{count}} unidades.'),
    'faq' => array(array('q' => 'Há carros?', 'a' => 'Veja os carros disponíveis hoje.')),
);
$selected = netcar_landing_selection($current, $landing);
check_landing(count($selected) === 3 && array_column($selected, 'id') === array('11', '12', '13'), 'sold unit absent from current selection');
check_landing(netcar_landing_paragraphs($landing, $selected) === array('De R$ 137.900 a R$ 149.900; anos 2024 a 2024; 3 unidades.'), 'range and years derive from same available selection');
check_landing(netcar_landing_paragraphs($landing, array()) === $landing['paragraphs'], 'empty selection uses neutral fallback');
check_landing(netcar_landing_paragraphs($landing, array(landing_vehicle(11, 100, array('ano' => null)), $current[1])) === $landing['paragraphs'], 'partial years cannot claim a complete year range');
$priceOnly = array_merge($landing, array('paragraphTemplates' => array('{{minPrice}} a {{maxPrice}}')));
check_landing(netcar_landing_paragraphs($priceOnly, array(landing_vehicle(11, 100, array('ano' => null)))) === array('R$ 100 a R$ 100'), 'missing years do not block price-only templates');
$unknownToken = array_merge($landing, array('paragraphTemplates' => array('{{unknown}}')));
check_landing(netcar_landing_paragraphs($unknownToken, $selected) === $landing['paragraphs'], 'unknown tokens use fallback');
check_landing(netcar_landing_fetch_stock(function () { throw new RuntimeException('network transport'); }) === null, 'transport exception yields unknown availability');
check_landing(strpos(netcar_landing_faq($landing, array())[0]['a'], 'disponíveis hoje') === false, 'empty FAQ does not assert availability');
check_landing(netcar_landing_matches(landing_vehicle(21, 80000, array('marca' => 'HONDA', 'modelo' => 'CITY EX', 'categoria' => 'HATCH')), array('categoria' => 'SEDAN')), 'category normalization matches React');
check_landing(netcar_landing_matches(landing_vehicle(22, 80000, array('modelo' => 'TIGGO 8 MAX')), array('modelo' => 'Tiggo8', 'cambio' => 'Automático', 'precoMin' => 80000, 'precoMax' => 80000)), 'model accents and inclusive prices match React');
check_landing(!netcar_landing_matches($current[0], array('precoMax' => 100000)), 'price boundary excludes outside vehicles');

$template = '<html><head><script type="application/ld+json" data-netcar-landing-collection>{"old":true}</script><script type="application/ld+json" data-netcar-landing-faq>{"old":true}</script></head><body><!--netcar:landing-stock:start-->stale sold card<!--netcar:landing-stock:end--><!--netcar:landing-paragraphs:start-->stale R$ 151.900<!--netcar:landing-paragraphs:end--><!--netcar:landing-faq:start-->stale answer<!--netcar:landing-faq:end--></body></html>';
$html = netcar_landing_html($template, $landing, $current);
check_landing($html !== null && strpos($html, 'stale') === false, 'runtime rendering replaces all stale template facts');
check_landing(strpos($html, '151.900') === false && strpos($html, '149.900') !== false, 'sold maximum absent from HTML');
check_landing(substr_count($html, 'class="blog-car"') === 3, 'initial HTML has same three cards');
check_landing(strpos($html, 'numberOfItems":3') !== false && strpos($html, 'tiggo-14') === false, 'schema matches available cards');
check_landing(netcar_landing_html('<html>old unmarked template</html>', $landing, $current) === null, 'missing template markers fail closed');
$emptyHtml = netcar_landing_html($template, $landing, array(landing_vehicle(11, 0)));
check_landing(strpos($emptyHtml, 'Nenhum veículo anunciado') !== false && strpos($emptyHtml, 'numberOfItems":0') !== false, 'confirmed empty selection has coherent markup and schema');
check_landing(strpos($emptyHtml, 'R$') === false && strpos($emptyHtml, 'disponíveis hoje') === false, 'empty selection has no stale price or availability claim');

$sensitive = landing_vehicle(99, 89900, array('chassi' => '9BWZZZ377VT004251', 'renavam' => 'private-registry', 'observacoes' => 'private-note', 'diferenciais' => array(array('tag' => 'garantia_fabrica', 'descricao' => 'public'), array('tag' => 'private', 'descricao' => 'private-value'))));
$projected = netcar_landing_bootstrap_vehicle($sensitive);
$json = json_encode($projected);
check_landing($projected['price'] === 89900.0 && $projected['id'] === '99', 'new arrival is projected from current API');
foreach (array('chassi', 'renavam', 'observacoes', '9BWZZZ377VT004251', 'private-registry', 'private-note', 'private-value') as $private) {
    check_landing(strpos($json, $private) === false, 'administrative data never enters HTML bootstrap');
}
check_landing($projected['factoryWarrantyVehicle']['unitKey'] === 'vin-sha256:' . hash('sha256', '9BWZZZ377VT004251'), 'warranty identity preserved as hash only');
check_landing($projected['factoryWarrantyVehicle']['price'] === 89900, 'warranty gate retains original API numeric type');
$htaccess = file_get_contents(__DIR__ . '/../../public/.htaccess');
check_landing(strpos($htaccess, 'RewriteRule ^comprar-([a-z0-9-]+)/?$ seo-landing.php [L]') !== false, 'crawler canonical route uses live renderer');
check_landing(strpos($htaccess, 'RewriteCond %{DOCUMENT_ROOT}/seo-static/landing-$1.html -f') !== false, 'unknown landing retains existing404 route guard');
check_landing(preg_match('#<If "%\{THE_REQUEST\} =~ m\#\^\[A-Z\]\+.*?comprar-.*?</If>#s', $htaccess, $cacheBlock) === 1 && strpos($cacheBlock[0], 'Header always set Cache-Control "no-store"') !== false, 'original landing request overrides Apache default HTML cache');
check_landing(strpos($htaccess, 'Header always set Cache-Control "public, max-age=60, s-maxage=300, stale-while-revalidate=60"') !== false, 'other route cache policy preserved');
echo 'Landing stock PHP: ' . $checks . " checks passed\n";
