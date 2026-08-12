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
define('NETCAR_BANNER_CACHE_TTL', 600);   // 10 min — evita bloquear o HTML a cada visita
define('NETCAR_BANNER_FAIL_TTL', 60);     // não martelar a API quando ela falhar
define('NETCAR_BANNER_HTTP_TIMEOUT', 0.20); // fail-fast: manifesto de build cobre a imagem se a API demorar

/** Normaliza a rota sem aceitar caminho codificado ou traversal. */
function netcar_request_path()
{
    $requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
    $path = rawurldecode((string) parse_url($requestUri, PHP_URL_PATH));
    if ($path === '' || strpos($path, "\0") !== false || strpos($path, '..') !== false) {
        return null;
    }

    $path = '/' . ltrim(preg_replace('#/+#', '/', $path), '/');
    return $path === '/' ? '/' : rtrim($path, '/');
}

/** Arquivo pré-renderizado que comprova que uma rota dinâmica existe. */
function netcar_static_route_file($path)
{
    $exact = [
        '/regioes-atendidas' => 'regions-hub.html',
        '/financiamento' => 'page-financiamento.html',
        '/atendimento-24h' => 'page-atendimento-24h.html',
        '/move-brasil' => 'page-move-brasil.html',
        '/seminovos-automaticos' => 'page-seminovos-automaticos.html',
        '/politica-editorial' => 'page-politica-editorial.html',
    ];

    $file = isset($exact[$path]) ? $exact[$path] : null;
    $patterns = [
        '#^/blog/([a-z0-9-]+)$#' => 'blog-%s.html',
        '#^/seminovos-([a-z0-9-]+)$#' => 'city-%s.html',
        '#^/vender-carro-([a-z0-9-]+)$#' => 'sell-city-%s.html',
        '#^/comprar-([a-z0-9-]+)$#' => 'landing-%s.html',
    ];

    if ($file === null) {
        foreach ($patterns as $pattern => $format) {
            if (preg_match($pattern, $path, $matches)) {
                $file = sprintf($format, $matches[1]);
                break;
            }
        }
    }

    if ($file === null) {
        return null;
    }

    $fullPath = __DIR__ . '/seo-static/' . $file;
    return is_file($fullPath) ? $fullPath : null;
}

function netcar_fixed_route_meta()
{
    return [
        '/' => [
            'title' => 'Carros Seminovos em Esteio | Netcar Multimarcas',
            'description' => 'Encontre carros seminovos em Esteio, com estoque selecionado, financiamento, garantia e o pós-venda Nethelp. Consulte a equipe da Netcar.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/',
        ],
        '/seminovos' => [
            'title' => 'Carros Seminovos à Venda em Esteio/RS | Netcar Multimarcas',
            'description' => 'Confira o estoque de seminovos da Netcar em Esteio. Filtre por marca, modelo, ano e preço. Vistoriados e com garantia.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/seminovos',
        ],
        '/sobre' => [
            'title' => 'Sobre a Netcar Multimarcas | Revenda em Esteio',
            'description' => 'Conheça a Netcar Multimarcas em Esteio/RS: Fábrica de Valor, garantia, Nethelp e duas lojas. Seminovos com procedência desde 1997.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/sobre',
        ],
        '/contato' => [
            'title' => 'Contato | Netcar Multimarcas — 2 Lojas Esteio',
            'description' => 'WhatsApp (51) 99729-3118. Av. Presidente Vargas 740 e 1106, Esteio/RS.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/contato',
        ],
        '/compra' => [
            'title' => 'Venda seu Carro | Netcar Multimarcas Esteio',
            'description' => 'Venda seu carro para a Netcar Multimarcas em Esteio/RS. Avaliação gratuita, processo seguro e compra de veículo financiado.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/compra',
        ],
        '/blog' => [
            'title' => 'Blog | Netcar Multimarcas',
            'description' => 'Guias sobre compra, venda, financiamento e manutenção de seminovos com recorte de Esteio e do Rio Grande do Sul.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/blog',
        ],
        '/comparar' => [
            'title' => 'Comparar Seminovos | Netcar Multimarcas',
            'description' => 'Compare lado a lado preço, ano, quilometragem e características dos seminovos disponíveis na Netcar em Esteio/RS.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/comparar',
        ],
    ];
}

function netcar_is_valid_spa_route($path)
{
    if ($path === null) {
        return false;
    }

    $fixed = netcar_fixed_route_meta();
    if (isset($fixed[$path]) || netcar_static_route_file($path) !== null) {
        return true;
    }

    // IDs são validados pela API na página; aqui rejeitamos apenas slugs malformados.
    if (preg_match('#^/veiculo/[a-z0-9-]*[0-9]+$#', $path)) {
        return true;
    }
    if (preg_match('#^/laudo/[a-z0-9-]+$#', $path)) {
        return true;
    }

    return false;
}

function netcar_render_error($status)
{
    http_response_code($status);
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Robots-Tag: noindex, follow');
    header('Cache-Control: public, max-age=300');
    $file = __DIR__ . ($status === 410 ? '/410.html' : '/404.html');
    if (is_readable($file)) {
        readfile($file);
    } else {
        echo '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="robots" content="noindex, follow"><title>Página não encontrada | Netcar</title></head><body><h1>Página não encontrada</h1><p><a href="/seminovos">Ver seminovos</a></p></body></html>';
    }
    exit;
}

function netcar_extract_static_meta($file)
{
    $source = @file_get_contents($file);
    if ($source === false) {
        return null;
    }

    $patterns = [
        'title' => '#<title>(.*?)</title>#is',
        'description' => '#<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']\s*/?>#is',
        'canonical' => '#<link\s+rel=["\']canonical["\']\s+href=["\'](.*?)["\']\s*/?>#is',
        'image' => '#<meta\s+property=["\']og:image["\']\s+content=["\'](.*?)["\']\s*/?>#is',
    ];
    $meta = [];
    foreach ($patterns as $key => $pattern) {
        if (preg_match($pattern, $source, $matches)) {
            $meta[$key] = html_entity_decode(trim($matches[1]), ENT_QUOTES, 'UTF-8');
        }
    }

    return isset($meta['title'], $meta['description'], $meta['canonical']) ? $meta : null;
}

function netcar_route_meta($path)
{
    $staticFile = netcar_static_route_file($path);
    if ($staticFile !== null) {
        return netcar_extract_static_meta($staticFile);
    }
    $fixed = netcar_fixed_route_meta();
    return isset($fixed[$path]) ? $fixed[$path] : null;
}

function netcar_apply_route_meta($html, $meta)
{
    if (!is_array($meta)) {
        return $html;
    }

    $title = htmlspecialchars($meta['title'], ENT_QUOTES, 'UTF-8');
    $description = htmlspecialchars($meta['description'], ENT_QUOTES, 'UTF-8');
    $canonical = htmlspecialchars($meta['canonical'], ENT_QUOTES, 'UTF-8');
    $image = htmlspecialchars(isset($meta['image']) ? $meta['image'] : 'https://www.netcarmultimarcas.com.br/images/loja1.jpg', ENT_QUOTES, 'UTF-8');

    $replacements = [
        '#<title>.*?</title>#is' => '<title>' . $title . '</title>',
        '#<meta\s+name="description"[^>]*>#i' => '<meta name="description" content="' . $description . '" />',
        '#<link\s+rel="canonical"[^>]*>#i' => '<link rel="canonical" href="' . $canonical . '" />',
        '#<meta\s+property="og:title"[^>]*>#i' => '<meta property="og:title" content="' . $title . '" />',
        '#<meta\s+property="og:description"[^>]*>#i' => '<meta property="og:description" content="' . $description . '" />',
        '#<meta\s+property="og:url"[^>]*>#i' => '<meta property="og:url" content="' . $canonical . '" />',
        '#<meta\s+property="og:image"[^>]*>#i' => '<meta property="og:image" content="' . $image . '" />',
        '#<meta\s+name="twitter:title"[^>]*>#i' => '<meta name="twitter:title" content="' . $title . '" />',
        '#<meta\s+name="twitter:description"[^>]*>#i' => '<meta name="twitter:description" content="' . $description . '" />',
        '#<meta\s+name="twitter:image"[^>]*>#i' => '<meta name="twitter:image" content="' . $image . '" />',
    ];

    foreach ($replacements as $pattern => $replacement) {
        $html = preg_replace($pattern, $replacement, $html, 1);
    }
    return $html;
}

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

function netcar_banner_variant($url, $width)
{
    $path = parse_url($url, PHP_URL_PATH);
    if (!is_string($path) || !preg_match('#^/(imagens|images)/.*\.(png|jpe?g|webp)$#i', $path)) {
        return $url;
    }
    // URL.pathname no browser transforma espaço em %20; encodeURIComponent
    // (usado pelo React) transforma esse % em %25. Replicar exatamente evita
    // duas requisições para a mesma imagem e faz o preload ser reaproveitado.
    $browserPath = str_replace(' ', '%20', $path);
    return '/img.php?src=' . rawurlencode($browserPath) . '&w=' . intval($width);
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

function netcar_get_build_home_lcp()
{
    $file = __DIR__ . '/seo/home-lcp.json';
    if (!is_readable($file)) {
        return null;
    }
    $value = json_decode((string) @file_get_contents($file), true);
    if (
        !is_array($value)
        || empty($value['id'])
        || empty($value['image'])
        || empty($value['brand'])
        || empty($value['model'])
        || empty($value['year'])
        || empty($value['price'])
    ) {
        return null;
    }
    $image = netcar_normalize_banner_path($value['image']);
    if ($image === null) {
        return null;
    }

    $hero = array(
        'id' => (string) $value['id'],
        'brand' => trim((string) $value['brand']),
        'model' => trim((string) $value['model']),
        'year' => (int) $value['year'],
        'price' => (float) $value['price'],
        'image' => $image,
    );
    foreach (array(
        'valor_formatado',
        'preco_com_troca_formatado',
        'tag',
        'marca',
        'modelo',
        'placa',
        'combustivel',
        'cambio',
    ) as $field) {
        if (isset($value[$field]) && $value[$field] !== '') {
            $hero[$field] = trim((string) $value[$field]);
        }
    }
    if (isset($value['preco_com_troca']) && is_numeric($value['preco_com_troca'])) {
        $hero['preco_com_troca'] = (float) $value['preco_com_troca'];
    }

    return array('id' => (string) $value['id'], 'image' => $image, 'hero' => $hero);
}

$html = @file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'index.html nao encontrado';
    exit;
}

$path = netcar_request_path();
if (!netcar_is_valid_spa_route($path)) {
    netcar_render_error(404);
}

$html = netcar_apply_route_meta($html, netcar_route_meta($path));
$isHome = $path === '/';

if ($isHome) {
    $bannerUrl = netcar_get_active_banner_url();
    $hasActiveBanner = $bannerUrl !== null;
    $buildHomeLcp = netcar_get_build_home_lcp();
    $bannerStateScript = '<script>window.__NETCAR_HOME_HAS_ACTIVE_BANNER__='
        . ($hasActiveBanner ? 'true' : 'false')
        . ';</script>';
    $html = str_replace('</head>', "  {$bannerStateScript}\n  </head>", $html);
    if ($buildHomeLcp !== null) {
        $heroBootstrapScript = '<script>window.__NETCAR_HOME_LCP_ID__='
            . json_encode($buildHomeLcp['id'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)
            . ';window.__NETCAR_HOME_HERO__='
            . json_encode($buildHomeLcp['hero'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)
            . ';</script>';
        $html = str_replace('</head>', "  {$heroBootstrapScript}\n  </head>", $html);
    }
    if ($bannerUrl === null && $buildHomeLcp !== null) {
        $bannerUrl = $buildHomeLcp['image'];
    }
    if ($bannerUrl !== null) {
        // Precisa ser a mesma lista usada pelo componente React. Se o browser
        // escolher outra largura no preload, ele baixa a imagem duas vezes.
        $imageWidths = $hasActiveBanner
            ? array(480, 768, 960, 1280, 1920)
            : array(480, 768, 960, 1280, 1600);
        $srcsetParts = array();
        foreach ($imageWidths as $imageWidth) {
            $srcsetParts[] = htmlspecialchars(
                netcar_banner_variant($bannerUrl, $imageWidth),
                ENT_QUOTES,
                'UTF-8'
            ) . ' ' . $imageWidth . 'w';
        }
        $responsiveSrcset = implode(', ', $srcsetParts);
        $banner1280 = netcar_banner_variant($bannerUrl, 1280);
        $preload = '<link rel="preload" as="image" href="'
            . htmlspecialchars($banner1280, ENT_QUOTES, 'UTF-8')
            . '" imagesrcset="'
            . $responsiveSrcset
            . '" imagesizes="100vw" fetchpriority="high" />';
        $html = str_replace('</head>', "  {$preload}\n  </head>", $html);
        $initialHero = '<div id="netcar-initial-lcp"><img src="'
            . htmlspecialchars($banner1280, ENT_QUOTES, 'UTF-8')
            . '" srcset="'
            . $responsiveSrcset
            . '" sizes="100vw" alt="Carro seminovo em destaque" width="1600" height="900" loading="eager" decoding="async" fetchpriority="high"></div>';
        $html = str_replace('<div id="netcar-initial-lcp"></div>', $initialHero, $html);
    }
}

header('Content-Type: text/html; charset=UTF-8');
// O HTML é público e não personalizado. Permite cache de borda curto e
// revalidação, reduzindo TTFB sem congelar estoque ou metadados.
header('Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60');
echo $html;
