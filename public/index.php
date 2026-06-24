<?php
/**
 * Serve o index.html do SPA injetando <link rel="preload"> do banner ativo da home.
 * Objetivo: o navegador começa a baixar a imagem do LCP junto com os bundles JS,
 * em vez de esperar React montar + chamada à API de banners (corta ~2-3s do LCP).
 *
 * Fail-safe: qualquer erro (API fora, JSON inválido, timeout) resulta no
 * index.html original, sem preload.
 */

// URL da API: vem do netcar-config.php, gerado no build a partir do .env.production.
// O fallback hardcoded só é usado se o config não tiver sido deployado.
$netcarConfigFile = __DIR__ . '/netcar-config.php';
if (is_readable($netcarConfigFile)) {
    include $netcarConfigFile;
}
if (!defined('NETCAR_API_BASE_URL')) {
    define('NETCAR_API_BASE_URL', 'https://www.netcarmultimarcas.com.br/api/v1');
}

define('NETCAR_BANNER_API', NETCAR_API_BASE_URL . '/site.php?action=banners');
define('NETCAR_BANNER_CACHE_TTL', 300);   // 5 min — mesmo banner raramente muda
define('NETCAR_BANNER_FAIL_TTL', 60);     // não martelar a API quando ela falhar
define('NETCAR_BANNER_HTTP_TIMEOUT', 2);  // segundos

/**
 * Replica a normalização do frontend (normalizeImageUrl em site.ts):
 * "./imagens/banner/x.jpg" -> "/imagens/banner/x.jpg" (root-relative resolve
 * para a mesma URL absoluta que o <img> do React usa, então o browser deduplica).
 */
function netcar_normalize_banner_path($url)
{
    if (!is_string($url) || $url === '') {
        return null;
    }
    $normalized = str_replace('\\', '/', trim($url));
    $normalized = preg_replace('#^\./+#', '', $normalized);

    if (preg_match('#^https?://#i', $normalized)) {
        return $normalized;
    }
    return '/' . ltrim($normalized, '/');
}

function netcar_fetch_banner_url()
{
    $context = stream_context_create([
        'http' => [
            'timeout' => NETCAR_BANNER_HTTP_TIMEOUT,
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents(NETCAR_BANNER_API, false, $context);
    if ($body === false) {
        return null;
    }

    $json = json_decode($body, true);
    if (!is_array($json) || empty($json['success']) || empty($json['data'][0]['imagem'])) {
        return null;
    }
    return netcar_normalize_banner_path($json['data'][0]['imagem']);
}

function netcar_get_active_banner_url()
{
    $cacheFile = sys_get_temp_dir() . '/netcar_home_banner.json';

    if (is_readable($cacheFile)) {
        $cache = json_decode((string) @file_get_contents($cacheFile), true);
        if (is_array($cache) && isset($cache['expires']) && $cache['expires'] > time()) {
            return isset($cache['url']) && $cache['url'] !== '' ? $cache['url'] : null;
        }
    }

    $url = netcar_fetch_banner_url();
    $ttl = $url !== null ? NETCAR_BANNER_CACHE_TTL : NETCAR_BANNER_FAIL_TTL;
    @file_put_contents(
        $cacheFile,
        json_encode(array('url' => $url !== null ? $url : '', 'expires' => time() + $ttl)),
        LOCK_EX
    );
    return $url;
}

$html = @file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'index.html nao encontrado';
    exit;
}

$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
$path = parse_url($requestUri, PHP_URL_PATH);
$isHome = in_array($path, ['/', '/index.php', '/index.html'], true);

if ($isHome) {
    $bannerUrl = netcar_get_active_banner_url();
    if ($bannerUrl !== null) {
        $preload = '<link rel="preload" as="image" href="'
            . htmlspecialchars($bannerUrl, ENT_QUOTES, 'UTF-8')
            . '" fetchpriority="high" />';
        $html = str_replace('</head>', "  {$preload}\n  </head>", $html);
    }

    // HTML válido fora do #root: React (createRoot) não remove; fica no source para crawlers.
    // Visualmente oculto via #netcar-seo-prerender no index.html; visível em <noscript>.
    $seoPrerender = <<<'HTML'
<div id="netcar-seo-prerender" aria-hidden="true">
  <main>
    <h1>Seminovos em Esteio/RS — Netcar Multimarcas</h1>
    <p>
      Loja de seminovos em Esteio desde 1997. Carros vistoriados, garantia, financiamento em até 60x
      e compra de usados — mesmo financiados. Duas lojas na Av. Presidente Vargas.
      Atendemos Esteio, Canoas, Sapucaia do Sul, São Leopoldo, Novo Hamburgo, Gravataí,
      Cachoeirinha, Porto Alegre e região metropolitana.
    </p>
    <nav aria-label="Navegação principal">
      <a href="/seminovos">Ver seminovos</a>
      <a href="/compra">Vender ou trocar meu carro</a>
      <a href="/sobre">Sobre a Netcar</a>
      <a href="/contato">Contato</a>
      <a href="/blog">Blog</a>
    </nav>
  </main>
</div>

HTML;
    $html = str_replace('<div id="root">', $seoPrerender . '<div id="root">', $html);
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
echo $html;
