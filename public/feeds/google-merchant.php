<?php
// Automacar continues to own the on-disk XML at the importer URL.
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
try {
    require_once __DIR__ . '/carclick-description.php';
    require_once __DIR__ . '/google-merchant-feed.php';
    $raw = netcar_carclick_read_source(__DIR__ . '/google_merchant.xml');
    $xml = netcar_merchant_feed($raw, netcar_landing_live_stock() ?? [], dirname(__DIR__));
    header('Content-Type: application/xml; charset=UTF-8');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $xml;
} catch (Throwable $error) {
    // An interrupted export must not look like an empty or partial inventory.
    http_response_code(503);
    header('Retry-After: 60');
    header('Content-Type: text/plain; charset=UTF-8');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo 'Feed temporariamente indisponível.';
}
