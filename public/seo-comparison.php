<?php
require_once __DIR__ . '/seo/comparison-stock.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$pages = json_decode((string) @file_get_contents(__DIR__ . '/seo/comparisons.json'), true);
$page = null;
$file = null;
if ($path === '/comparar' || $path === '/comparar/') $file = __DIR__ . '/seo-static/page-comparar.html';
elseif (preg_match('#^/comparar/([a-z0-9-]+)/?$#D', (string) $path, $matches)) {
    foreach (is_array($pages) ? $pages : array() as $candidate) {
        if (($candidate['slug'] ?? '') === $matches[1]) { $page = $candidate; break; }
    }
    if ($page) $file = __DIR__ . '/seo-static/comparison-' . $page['slug'] . '.html';
}
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
if (!$file || !is_readable($file)) {
    http_response_code(404);
    header('X-Robots-Tag: noindex, follow');
    echo '<!doctype html><html lang="pt-BR"><title>Página não encontrada | Netcar</title><h1>Página não encontrada</h1><a href="/comparar">Comparar carros</a></html>';
    exit;
}
$stock = is_array($pages) ? netcar_landing_live_stock() : null;
$html = $stock === null ? null : netcar_comparison_html((string) file_get_contents($file), $stock, $pages, $page);
if ($html === null) {
    http_response_code(503);
    header('Retry-After: 60');
    echo '<!doctype html><html lang="pt-BR"><title>Estoque temporariamente indisponível | Netcar</title><h1>Não foi possível atualizar o estoque</h1><p>Tente novamente em instantes ou fale com a equipe para confirmar a disponibilidade.</p><a href="/seminovos">Ver estoque completo</a></html>';
    exit;
}
// Only successful complete reads may be reused, for at most one minute.
header('Cache-Control: public, max-age=60, s-maxage=60, must-revalidate');
echo $html;
