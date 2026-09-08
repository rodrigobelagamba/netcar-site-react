<?php
// O candidato permanece no domínio Netcar; o formulário usa o backend existente.
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit;
}
$curl = curl_init('https://questionario-perfil.pages.dev/');
curl_setopt_array($curl, array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => array('Accept: text/html'),
));
$html = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);
if ($html === false || $html === '' || $status !== 200) {
    http_response_code(503);
    header('Retry-After: 60');
    echo '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Candidatura Netcar</title><p>O formulário está temporariamente indisponível. Tente novamente em instantes.</p><a href="/vagas/consultor-vendas-seminovos/">Voltar à vaga</a></html>';
    exit;
}
$html = str_replace("const API_URL = '/api/submit';", "const API_URL = '/vagas/consultor-vendas-seminovos/enviar';", $html);
$html = str_replace('src="logo-netcar.png"', 'src="/brand/netcar.png"', $html);
echo $html;
