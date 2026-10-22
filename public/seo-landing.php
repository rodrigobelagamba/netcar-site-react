<?php
require_once __DIR__ . '/seo/landing-stock.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$landing = null;
if (preg_match('#^/comprar-([a-z0-9-]+)/?$#D', (string) $path, $matches)) {
    $landings = json_decode((string) @file_get_contents(__DIR__ . '/seo/landings.json'), true);
    foreach (is_array($landings) ? $landings : array() as $candidate) {
        if (($candidate['slug'] ?? '') === $matches[1]) { $landing = $candidate; break; }
    }
}
$file = $landing ? __DIR__ . '/seo-static/landing-' . $landing['slug'] . '.html' : null;
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
if (!$file || !is_readable($file)) {
    http_response_code(404);
    header('X-Robots-Tag: noindex, follow');
    echo '<!doctype html><html lang="pt-BR"><title>Página não encontrada | Netcar</title><h1>Página não encontrada</h1><a href="/seminovos">Ver estoque completo</a></html>';
    exit;
}
$stock = netcar_landing_live_stock();
$html = $stock === null ? null : netcar_landing_html((string) file_get_contents($file), $landing, $stock);
if ($html === null) {
    http_response_code(503);
    header('Retry-After: 60');
    echo '<!doctype html><html lang="pt-BR"><title>Estoque temporariamente indisponível | Netcar</title><h1>Não foi possível atualizar o estoque</h1><p>Tente novamente em instantes ou fale com a equipe para confirmar a disponibilidade.</p><a href="/seminovos">Ver estoque completo</a></html>';
    exit;
}
echo $html;
