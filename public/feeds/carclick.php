<?php
/**
 * Same Carclick URL and original supplier file, with approved descriptions.
 * Reads the local XML directly (never calls its rewritten HTTP URL).
 * Never writes the source file, ERP, prices, photos or inventory identifiers.
 */
header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

try {
    require_once __DIR__ . '/carclick-description.php';
    require_once __DIR__ . '/carclick-warranty.php';
    $raw = netcar_carclick_read_source(__DIR__ . '/carclick.xml');
    $parsed = netcar_carclick_parse_source($raw);
    $liveById = array();
    // The existing bounded reader verifies current warranty flags. Failure only
    // omits warranty copy; it never removes vehicles or blocks their base text.
    require_once dirname(__DIR__) . '/seo/landing-stock.php';
    try {
        $live = netcar_landing_live_stock();
        if (is_array($live)) foreach ($live as $row) $liveById[(string) $row['id']] = $row;
    } catch (Throwable $error) {
        $liveById = array();
    }
    $manifestPath = __DIR__ . '/carclick-warranty.json';
    $registryPath = dirname(__DIR__) . '/seo/factory-warranty-registry.json';
    $manifest = is_readable($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : null;
    $registryHash = is_readable($registryPath) ? hash_file('sha256', $registryPath) : null;
    $result = netcar_carclick_transform($parsed, function ($row) use ($manifest, $registryHash, $liveById) {
        $id = trim($row['codigo_anuncio_revenda'] ?? '');
        return netcar_carclick_warranty_claim($row, $manifest, $registryHash, $liveById[$id] ?? null);
    });
    header('X-Netcar-Carclick-Descriptions: v1');
    header('X-Netcar-Carclick-Vehicles: ' . $result['vehicles']);
    header('X-Netcar-Carclick-Warranties: ' . $result['warranties']);
    header('X-Netcar-Carclick-Source-SHA256: ' . hash('sha256', $raw));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $result['xml'];
} catch (Throwable $error) {
    // Never return an empty inventory (which a portal might treat as removal).
    http_response_code(503);
    header('Retry-After: 60');
    header('Content-Type: text/plain; charset=UTF-8');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo 'Feed temporariamente indisponivel. Tente novamente.';
}
