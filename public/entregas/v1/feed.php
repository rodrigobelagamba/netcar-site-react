<?php
require_once __DIR__ . '/lib.php';

if (!in_array($_SERVER['REQUEST_METHOD'], array('GET', 'HEAD'), true)) {
    header('Allow: GET, HEAD');
    entregas_json_response(array('ok' => false, 'error' => 'Method not allowed'), 405);
}
try {
    $data = entregas_json_read(entregas_data_dir() . '/live.json');
    $feed = array('deliveries' => array_map('entregas_public_delivery', entregas_sort($data['deliveries'])), 'updatedAt' => isset($data['updatedAt']) ? $data['updatedAt'] : null);
    header('Cache-Control: public, max-age=30, s-maxage=30, stale-while-revalidate=30');
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
        header('Content-Type: application/json; charset=UTF-8');
        header('X-Robots-Tag: noindex, nofollow');
        exit;
    }
    entregas_json_response($feed);
} catch (Exception $error) {
    header('Cache-Control: no-store');
    error_log('Entregas feed: ' . $error->getMessage());
    entregas_json_response(array('ok' => false, 'error' => 'Feed temporarily unavailable'), 503);
}
