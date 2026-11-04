<?php
require_once __DIR__ . '/seo/showcase-stock.php';
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
header('Vary: User-Agent');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$route = netcar_showcase_file($path, __DIR__);
if ($route === null) {
    http_response_code(404);
    header('X-Robots-Tag: noindex, follow');
    echo '<!doctype html><html lang="pt-BR"><title>Página não encontrada | Netcar</title><h1>Página não encontrada</h1><a href="/seminovos">Ver estoque</a></html>';
    exit;
}
if (strpos($path, '/seo-static/') === 0) {
    header('Location: ' . $route['canonical'], true, 301);
    exit;
}
$source = (string) file_get_contents($route['file']);
if (strpos($source, '<!--netcar:showcase:') === false) {
    // Old templates that still contain cards must not silently bypass freshness.
    $html = strpos($source, 'class="blog-car"') === false ? $source : null;
} else {
    $stock = netcar_landing_live_stock();
    $html = $stock === null ? null : netcar_showcase_html($source, $stock, SEO_SITE_URL . $route['canonical']);
}
if ($html === null) {
    http_response_code(503);
    header('Retry-After: 60');
    echo '<!doctype html><html lang="pt-BR"><title>Estoque temporariamente indisponível | Netcar</title><h1>Não foi possível atualizar o estoque</h1><p>Tente novamente em instantes ou consulte a disponibilidade com a equipe.</p><a href="/seminovos">Ver estoque</a></html>';
    exit;
}
echo $html;
