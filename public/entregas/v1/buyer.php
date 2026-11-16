<?php
require_once __DIR__ . '/lib.php';
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    entregas_json_response(array('ok' => false, 'error' => 'Method not allowed'), 405);
}
entregas_require_publish_auth();
if ((int) (isset($_SERVER['CONTENT_LENGTH']) ? $_SERVER['CONTENT_LENGTH'] : 0) > 1024) {
    entregas_json_response(array('ok' => false, 'error' => 'Request too large'), 413);
}
$contentType = isset($_SERVER['CONTENT_TYPE']) ? strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'])[0])) : '';
if ($contentType !== 'application/json') {
    entregas_json_response(array('ok' => false, 'error' => 'Send application/json'), 415);
}
$body = file_get_contents('php://input', false, null, 0, 1025);
if ($body === false || strlen($body) > 1024) {
    entregas_json_response(array('ok' => false, 'error' => 'Request too large'), 413);
}
$metadata = json_decode($body, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    entregas_json_response(array('ok' => false, 'error' => 'Invalid JSON'), 400);
}
try {
    entregas_json_response(array_merge(array('ok' => true), entregas_update_buyer($metadata)));
} catch (InvalidArgumentException $error) {
    entregas_json_response(array('ok' => false, 'error' => $error->getMessage()), 422);
} catch (EntregasDeliveryNotFound $error) {
    entregas_json_response(array('ok' => false, 'error' => 'Delivery not found'), 404);
} catch (Throwable $error) {
    error_log('Entregas buyer: update unavailable');
    entregas_json_response(array('ok' => false, 'error' => 'Name update temporarily unavailable; retry the same delivery_public_id'), 503);
}
