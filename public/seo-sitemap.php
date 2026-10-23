<?php
require_once __DIR__ . '/seo/sitemap-stock.php';
header('Cache-Control: no-store');
$source = @file_get_contents(__DIR__ . '/sitemap.xml');
$stock = $source === false ? null : netcar_landing_live_stock();
$xml = $stock === null ? null : netcar_live_sitemap($source, $stock);
if ($xml === null) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Retry-After: 60');
    echo 'Não foi possível atualizar o sitemap. Tente novamente em instantes.';
    exit;
}
header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=60, s-maxage=60, must-revalidate');
echo $xml;
