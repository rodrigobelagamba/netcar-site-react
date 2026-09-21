<?php
require_once __DIR__ . '/lib.php';
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    entregas_json_response(array('ok' => false, 'error' => 'Method not allowed'), 405);
}
entregas_require_publish_auth();
if ((int) (isset($_SERVER['CONTENT_LENGTH']) ? $_SERVER['CONTENT_LENGTH'] : 0) > 13 * 1024 * 1024) {
    entregas_json_response(array('ok' => false, 'error' => 'Request too large'), 413);
}
if (!isset($_POST['metadata']) || !is_string($_POST['metadata']) || strlen($_POST['metadata']) > 4096) {
    entregas_json_response(array('ok' => false, 'error' => 'Send metadata as a JSON form field'), 400);
}
$upload = isset($_FILES['image']) ? $_FILES['image'] : null;
if (!is_array($upload) || !isset($upload['error']) || $upload['error'] !== UPLOAD_ERR_OK
    || !isset($upload['tmp_name']) || !is_string($upload['tmp_name']) || !is_uploaded_file($upload['tmp_name'])) {
    entregas_json_response(array('ok' => false, 'error' => 'Send the final card in the image form field'), 400);
}
try {
    $result = entregas_publish(json_decode($_POST['metadata'], true), $upload['tmp_name'], (int) $upload['size']);
    $id = $result['delivery']['id'];
    entregas_json_response(array_merge(array('ok' => true, 'id' => $id,
        'url' => 'https://www.netcarmultimarcas.com.br/entregas#foto=' . rawurlencode($id)), $result), $result['action'] === 'created' ? 201 : 200);
} catch (InvalidArgumentException $error) {
    entregas_json_response(array('ok' => false, 'error' => $error->getMessage()), 422);
} catch (Throwable $error) {
    error_log('Entregas publish: ' . $error->getMessage());
    entregas_json_response(array('ok' => false, 'error' => 'Publication temporarily unavailable; retry the same delivery_id'), 503);
}
