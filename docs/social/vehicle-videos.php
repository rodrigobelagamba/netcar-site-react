<?php

declare(strict_types=1);

// Endpoint publico le apenas o cache: GET nunca consulta Meta/estoque nem executa sync.
require_once __DIR__ . '/lib/VehicleVideoSync.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60, stale-while-revalidate=60');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (!in_array($method, ['GET', 'HEAD'], true)) {
    header('Allow: GET, HEAD, OPTIONS');
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = VehicleVideoSync::publicResponse(__DIR__ . '/data/cache/vehicle-videos.json');
if ($data === null) {
    http_response_code(503);
    header('Cache-Control: no-store');
    $data = ['success' => false, 'message' => 'Vehicle videos cache unavailable'];
}
if ($method !== 'HEAD') {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
