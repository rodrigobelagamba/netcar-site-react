<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(array('error' => 'Use o formulário para enviar sua candidatura.'));
    exit;
}
$maxBytes = 7 * 1024 * 1024 + 128 * 1024;
if (isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > $maxBytes) {
    http_response_code(413);
    echo json_encode(array('error' => 'O currículo pode ter até 5 MB.'));
    exit;
}
if (stripos(isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '', 'application/json') !== 0) {
    http_response_code(415);
    echo json_encode(array('error' => 'Formato de envio inválido.'));
    exit;
}
$input = fopen('php://input', 'rb');
$body = stream_get_contents($input, $maxBytes + 1);
fclose($input);
if ($body === false || strlen($body) > $maxBytes) {
    http_response_code(413);
    echo json_encode(array('error' => 'O currículo pode ter até 5 MB.'));
    exit;
}
$curl = curl_init('https://questionario-perfil.pages.dev/api/submit');
curl_setopt_array($curl, array(
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => array('Content-Type: application/json', 'Accept: application/json'),
));
$result = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);
if ($result === false || !$status) {
    http_response_code(502);
    echo json_encode(array('error' => 'Não foi possível confirmar o recebimento. Suas respostas continuam nesta página. Tente novamente.'));
    exit;
}
$decoded = json_decode($result, true);
if (!is_array($decoded)) {
    http_response_code(502);
    echo json_encode(array('error' => 'Não foi possível confirmar o recebimento. Tente novamente.'));
    exit;
}
http_response_code($status);
echo json_encode($decoded);
