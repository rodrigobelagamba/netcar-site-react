<?php
/** Fresh SPA bootstrap. The generated JSON is a build artifact, not availability. */
require_once __DIR__ . '/seo/landing-stock.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
$value = netcar_landing_bootstrap();
if ($value === null) {
    http_response_code(503);
    header('Retry-After: 60');
    echo json_encode(array('error' => 'Não foi possível atualizar o estoque'), JSON_UNESCAPED_UNICODE);
    exit;
}
$value['scope'] = 'showroom';
$value['showroomVehicles'] = array_map('netcar_landing_bootstrap_vehicle', netcar_landing_live_stock());
echo json_encode($value, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
