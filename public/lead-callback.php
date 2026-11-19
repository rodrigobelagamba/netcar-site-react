<?php
/**
 * Proxy server-to-server para o botão "Me chamar" (ficha do veículo).
 *
 * Encaminha o pedido ao endpoint `crmleads` do CRM Netcar, que já executa o
 * `assign-seller` (round-robin vigente com pesos, stickiness e crm_match).
 * Nunca sorteia vendedor aqui e nunca expõe credenciais/detalhes internos ao browser.
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function nc_json_exit($status, $payload)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function nc_clean_text($value, $maxLength)
{
    $clean = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $value);
    $clean = trim(preg_replace('/\s+/u', ' ', (string) $clean));
    if (function_exists('mb_substr')) {
        return mb_substr($clean, 0, $maxLength, 'UTF-8');
    }
    return substr($clean, 0, $maxLength);
}

function nc_normalize_br_phone($raw)
{
    $digits = preg_replace('/\D+/', '', (string) $raw);
    if ((strlen($digits) === 12 || strlen($digits) === 13) && substr($digits, 0, 2) === '55') {
        $digits = substr($digits, 2);
    }
    $len = strlen($digits);
    if ($len !== 10 && $len !== 11) {
        return null;
    }
    $ddd = (int) substr($digits, 0, 2);
    if ($ddd < 11 || $ddd > 99) {
        return null;
    }
    if ($len === 11 && $digits[2] !== '9') {
        return null;
    }
    if (preg_match('/^(\d)\1+$/', $digits)) {
        return null;
    }
    return '55' . $digits;
}

function nc_is_allowed_origin()
{
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
    if ($origin === '') {
        return true;
    }
    $parts = parse_url($origin);
    $host = isset($parts['host']) ? strtolower($parts['host']) : '';
    if ($host === '') {
        return false;
    }
    $allowed = array(
        'www.netcarmultimarcas.com.br',
        'netcarmultimarcas.com.br',
        'localhost',
        '127.0.0.1',
    );
    $serverHost = isset($_SERVER['HTTP_HOST']) ? strtolower(preg_replace('/:\d+$/', '', (string) $_SERVER['HTTP_HOST'])) : '';
    if ($serverHost !== '') {
        $allowed[] = $serverHost;
    }
    return in_array($host, $allowed, true);
}

function nc_state_dir()
{
    $base = rtrim(sys_get_temp_dir(), '/\\') . '/netcar-lead-callback';
    if (!is_dir($base)) {
        @mkdir($base, 0700, true);
    }
    return is_dir($base) && is_writable($base) ? $base : null;
}

function nc_client_ip()
{
    $candidates = array(
        isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? $_SERVER['HTTP_CF_CONNECTING_IP'] : '',
        isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '',
    );
    foreach ($candidates as $ip) {
        $trimmed = trim((string) $ip);
        if ($trimmed !== '' && filter_var($trimmed, FILTER_VALIDATE_IP)) {
            return $trimmed;
        }
    }
    return 'unknown';
}

function nc_check_rate_limit($dir, $ip, $limit, $windowSeconds)
{
    if ($dir === null) {
        return true;
    }
    $path = $dir . '/rl-' . hash('sha256', $ip) . '.json';
    $fp = @fopen($path, 'c+');
    if ($fp === false) {
        return true;
    }
    $allowed = true;
    try {
        if (flock($fp, LOCK_EX)) {
            $now = time();
            $raw = stream_get_contents($fp);
            $decoded = $raw !== false && $raw !== '' ? json_decode($raw, true) : array();
            $timestamps = is_array($decoded) ? $decoded : array();
            $fresh = array();
            foreach ($timestamps as $ts) {
                if (is_int($ts) && ($now - $ts) < $windowSeconds) {
                    $fresh[] = $ts;
                }
            }
            if (count($fresh) >= $limit) {
                $allowed = false;
            } else {
                $fresh[] = $now;
                ftruncate($fp, 0);
                rewind($fp);
                fwrite($fp, json_encode($fresh));
            }
            flock($fp, LOCK_UN);
        }
    } finally {
        fclose($fp);
    }
    return $allowed;
}

function nc_dedup_path($dir, $phone, $vehicleId)
{
    if ($dir === null) {
        return null;
    }
    return $dir . '/dup-' . hash('sha256', $phone . '|' . $vehicleId) . '.txt';
}

function nc_is_recent_duplicate($dir, $phone, $vehicleId, $windowSeconds)
{
    $path = nc_dedup_path($dir, $phone, $vehicleId);
    if ($path === null || !is_file($path)) {
        return false;
    }
    $ts = (int) trim((string) @file_get_contents($path));
    return $ts > 0 && (time() - $ts) < $windowSeconds;
}

function nc_mark_dedup($dir, $phone, $vehicleId)
{
    $path = nc_dedup_path($dir, $phone, $vehicleId);
    if ($path !== null) {
        @file_put_contents($path, (string) time(), LOCK_EX);
    }
}

function nc_extract_json_object($text)
{
    $trimmed = trim((string) $text);
    if ($trimmed === '') {
        return null;
    }
    $decoded = json_decode($trimmed, true);
    if (is_array($decoded)) {
        return $decoded;
    }
    $pos = strpos($trimmed, '{');
    if ($pos !== false) {
        $decoded = json_decode(substr($trimmed, $pos), true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return null;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    nc_json_exit(405, array('ok' => false, 'error' => 'Método não permitido.'));
}

if (!nc_is_allowed_origin()) {
    nc_json_exit(403, array('ok' => false, 'error' => 'Origem não autorizada.'));
}

$maxBytes = 16 * 1024;
if (isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > $maxBytes) {
    nc_json_exit(413, array('ok' => false, 'error' => 'Requisição muito grande.'));
}

$contentType = isset($_SERVER['CONTENT_TYPE']) ? (string) $_SERVER['CONTENT_TYPE'] : '';
if (stripos($contentType, 'application/json') !== 0) {
    nc_json_exit(415, array('ok' => false, 'error' => 'Envie os dados em JSON.'));
}

$stream = fopen('php://input', 'rb');
$rawBody = $stream !== false ? stream_get_contents($stream, $maxBytes + 1) : false;
if ($stream !== false) {
    fclose($stream);
}
if ($rawBody === false || strlen($rawBody) > $maxBytes) {
    nc_json_exit(413, array('ok' => false, 'error' => 'Requisição muito grande.'));
}

$input = json_decode($rawBody, true);
if (!is_array($input)) {
    nc_json_exit(400, array('ok' => false, 'error' => 'Dados inválidos.'));
}

// Honeypot invisível: descarta silenciosamente bots sem queimar turno do round-robin.
$honeypot = isset($input['website']) ? trim((string) $input['website']) : '';
if ($honeypot !== '') {
    nc_json_exit(200, array('ok' => true, 'accepted' => true, 'crm_confirmed' => false));
}

$normalizedPhone = nc_normalize_br_phone(isset($input['phone']) ? $input['phone'] : '');
if ($normalizedPhone === null) {
    nc_json_exit(422, array('ok' => false, 'error' => 'Informe um WhatsApp válido com DDD.'));
}

$vehicleId = preg_replace('/\D+/', '', (string) (isset($input['vehicleId']) ? $input['vehicleId'] : ''));
$vehicleId = substr($vehicleId, 0, 12);
$vehicleName = nc_clean_text(isset($input['vehicleName']) ? $input['vehicleName'] : '', 160);
$intentSummary = nc_clean_text(isset($input['intentSummary']) ? $input['intentSummary'] : '', 220);
$pageUrl = nc_clean_text(isset($input['pageUrl']) ? $input['pageUrl'] : '', 260);
$clickId = nc_clean_text(isset($input['clickId']) ? $input['clickId'] : '', 40);
$waRef = nc_clean_text(isset($input['waRef']) ? $input['waRef'] : '', 16);

$stateDir = nc_state_dir();
if (!nc_check_rate_limit($stateDir, nc_client_ip(), 5, 600)) {
    nc_json_exit(429, array(
        'ok' => false,
        'error' => 'Muitas tentativas em poucos minutos. Chame direto no WhatsApp.',
    ));
}

if (nc_is_recent_duplicate($stateDir, $normalizedPhone, $vehicleId, 900)) {
    nc_json_exit(200, array(
        'ok' => true,
        'duplicate' => true,
        'crm_confirmed' => false,
    ));
}

$interest = $vehicleName !== '' ? $vehicleName : 'Seminovo Netcar';
if ($vehicleId !== '') {
    $interest .= ' (ID ' . $vehicleId . ')';
}

$summaryParts = array('Pedido de retorno no site (Me chamar).');
if ($intentSummary !== '') {
    $summaryParts[] = 'Intenção: ' . $intentSummary . '.';
}
if ($pageUrl !== '') {
    $summaryParts[] = 'Página: ' . $pageUrl . '.';
}

$traffic = isset($input['traffic']) && is_array($input['traffic']) ? $input['traffic'] : array();
$trafficBits = array();
$trafficFields = array(
    'src' => 'Fonte',
    'campaign' => 'Campanha',
    'utmSource' => 'utm_source',
    'utmMedium' => 'utm_medium',
    'utmContent' => 'utm_content',
    'utmTerm' => 'utm_term',
    'gclid' => 'gclid',
    'gbraid' => 'gbraid',
    'wbraid' => 'wbraid',
    'fbclid' => 'fbclid',
);
foreach ($trafficFields as $key => $label) {
    if (!empty($traffic[$key])) {
        $val = nc_clean_text($traffic[$key], 120);
        if ($val !== '') {
            $trafficBits[] = $label . '=' . $val;
        }
    }
}
if ($waRef !== '') {
    $trafficBits[] = 'wa_ref=' . $waRef;
}
if ($clickId !== '') {
    $trafficBits[] = 'click_id=' . $clickId;
}
if (!empty($trafficBits)) {
    $summaryParts[] = 'Atribuição: ' . implode(' | ', $trafficBits) . '.';
}

$tz = new DateTimeZone('America/Sao_Paulo');
$timestamp = (new DateTimeImmutable('now', $tz))->format(DATE_ATOM);

$payload = array(
    'event' => 'lead_created',
    'timestamp' => $timestamp,
    'data' => array(
        'phone' => $normalizedPhone,
        'name' => 'Lead Site',
        'interest' => $interest,
        'origem' => 'SITE',
        'canal' => 'Site',
        'id_carro' => $vehicleId,
        'summary' => nc_clean_text(implode(' ', $summaryParts), 1000),
    ),
);

$dryRunFlag = strtolower(trim((string) getenv('NETCAR_CRM_CALLBACK_DRY_RUN')));
if (in_array($dryRunFlag, array('1', 'true', 'yes', 'on'), true)) {
    nc_mark_dedup($stateDir, $normalizedPhone, $vehicleId);
    nc_json_exit(200, array(
        'ok' => true,
        'dry_run' => true,
        'crm_confirmed' => false,
        'payload' => $payload,
    ));
}

$crmUrl = trim((string) getenv('NETCAR_CRM_LEADS_URL'));
if ($crmUrl === '') {
    $crmUrl = 'https://www.netcar-rc.com.br/fabrica/php/server.php?service=crmleads';
}
$crmToken = trim((string) getenv('NETCAR_CRM_TOKEN'));

$headers = array(
    'Content-Type: application/json',
    'Accept: application/json',
    'User-Agent: Netcar-Site-Callback/1.0',
);
if ($crmToken !== '') {
    $headers[] = 'Authorization: ' . $crmToken;
    $headers[] = 'X-Netcar-Token: ' . $crmToken;
}

$curl = curl_init($crmUrl);
curl_setopt_array($curl, array(
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => $headers,
));

$crmRaw = curl_exec($curl);
$crmStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($crmStatus === 409) {
    nc_mark_dedup($stateDir, $normalizedPhone, $vehicleId);
    nc_json_exit(200, array(
        'ok' => true,
        'duplicate' => true,
        'crm_confirmed' => false,
    ));
}

if ($crmRaw === false || $crmStatus < 200 || $crmStatus >= 300) {
    nc_json_exit(502, array(
        'ok' => false,
        'error' => 'Não foi possível confirmar o pedido agora. Chame direto no WhatsApp.',
    ));
}

$crmObj = nc_extract_json_object($crmRaw);
if (!is_array($crmObj) || (isset($crmObj['success']) && $crmObj['success'] === false)) {
    nc_json_exit(502, array(
        'ok' => false,
        'error' => 'Não foi possível confirmar o pedido agora. Chame direto no WhatsApp.',
    ));
}

nc_mark_dedup($stateDir, $normalizedPhone, $vehicleId);

$leadId = '';
if (is_array($crmObj)) {
    if (!empty($crmObj['id_crm_negocio'])) {
        $leadId = (string) $crmObj['id_crm_negocio'];
    } elseif (!empty($crmObj['id'])) {
        $leadId = (string) $crmObj['id'];
    }
}

nc_json_exit(200, array(
    'ok' => true,
    'crm_confirmed' => true,
    'lead_id' => $leadId,
));
