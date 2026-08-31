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

/**
 * Coloca o preload crítico no início do head, logo após o viewport.
 * Inserir perto de </head> faz o navegador descobrir a imagem somente depois
 * dos bundles, CSS e dados inline, desperdiçando boa parte do benefício.
 */
function netcar_prepend_critical_head_markup($html, $markup)
{
    $count = 0;
    $result = preg_replace_callback(
        '#<meta\\b[^>]*\\bname="viewport"[^>]*>#i',
        function ($matches) use ($markup) {
            return $matches[0] . "\n    " . $markup;
        },
        $html,
        1,
        $count
    );

    if ($result !== null && $count > 0) {
        return $result;
    }

    return preg_replace(
        '#<head>#i',
        "<head>\n    " . $markup,
        $html,
        1
    );
}

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
        '/comparar' => 'page-comparar.html',
        '/como-selecionamos-nossos-carros' => 'page-como-selecionamos-nossos-carros.html',
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
            'title' => 'Carros Seminovos e Usados em Esteio/RS | Netcar Multimarcas',
            'description' => 'Veja carros seminovos e usados à venda na Netcar em Esteio/RS. Consulte fotos, preço e ano dos veículos disponíveis.',
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
            'title' => 'Comparar carros lado a lado | Preço e ficha | Netcar',
            'description' => 'Escolha de 2 a 4 carros do estoque e compare preço, ano, câmbio, motor e outros dados na mesma tela. Abra as fichas e veja qual combina mais com você.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/comparar',
        ],
        '/privacidade' => [
            'title' => 'Privacidade e cookies | Netcar Multimarcas',
            'description' => 'Saiba como a Netcar utiliza dados, cookies e recursos de medição e como alterar suas preferências de privacidade.',
            'canonical' => 'https://www.netcarmultimarcas.com.br/privacidade',
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
        'robots' => '#<meta\s+name=["\']robots["\']\s+content=["\'](.*?)["\']\s*/?>#is',
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
    $robots = htmlspecialchars(isset($meta['robots']) ? $meta['robots'] : 'index, follow, max-image-preview:large', ENT_QUOTES, 'UTF-8');

    $replacements = [
        '#<title>.*?</title>#is' => '<title>' . $title . '</title>',
        '#<meta\s+name="description"[^>]*>#i' => '<meta name="description" content="' . $description . '" />',
        '#<meta\s+name="robots"[^>]*>#i' => '<meta name="robots" content="' . $robots . '" />',
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

function netcar_route_uses_stock_bootstrap($path)
{
    return $path === '/'
        || $path === '/seminovos'
        || $path === '/regioes-atendidas'
        || in_array($path, array('/financiamento', '/atendimento-24h', '/move-brasil'), true)
        || preg_match('#^/veiculo/#', (string) $path)
        || preg_match('#^/seminovos-[a-z0-9-]+$#', (string) $path)
        || preg_match('#^/vender-carro-[a-z0-9-]+$#', (string) $path)
        || preg_match('#^/comprar-[a-z0-9-]+$#', (string) $path);
}

function netcar_stock_bootstrap_value()
{
    static $loaded = false;
    static $value = null;

    if ($loaded) {
        return $value;
    }
    $loaded = true;

    $file = __DIR__ . '/seo/stock-bootstrap.json';
    if (!is_readable($file)) {
        return null;
    }
    $decoded = json_decode((string) @file_get_contents($file), true);
    if (!is_array($decoded) || empty($decoded['vehicles']) || !is_array($decoded['vehicles'])) {
        return null;
    }
    $value = $decoded;
    return $value;
}

function netcar_stock_bootstrap_script($path)
{
    $value = netcar_stock_bootstrap_value();
    if (!is_array($value) || empty($value['vehicles']) || !is_array($value['vehicles'])) {
        return null;
    }

    // Somente o showroom recebe também os registros vendidos. Nas demais
    // rotas injetamos apenas o array disponível, sem carregar nem expor a
    // coleção completa no HTML.
    $vehicles = $value['vehicles'];
    if (
        $path === '/seminovos'
        && !empty($value['showroomVehicles'])
        && is_array($value['showroomVehicles'])
    ) {
        $vehicles = $value['showroomVehicles'];
    }
    $payload = array(
        'generatedAt' => isset($value['generatedAt']) ? $value['generatedAt'] : null,
        'scope' => $path === '/seminovos' ? 'showroom' : 'available',
        'vehicles' => $vehicles,
    );

    return '<script>window.__NETCAR_STOCK__='
        . json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)
        . ';</script>';
}

/** Veículo cuja capa será o LCP nas rotas de estoque e detalhe. */
function netcar_stock_critical_vehicle($path)
{
    $stock = netcar_stock_bootstrap_value();
    if (!is_array($stock) || empty($stock['vehicles'])) {
        return null;
    }
    $vehicles = $stock['vehicles'];

    if ($path === '/seminovos') {
        usort($vehicles, function ($left, $right) {
            $leftModel = isset($left['modelo']) ? (string) $left['modelo'] : (isset($left['name']) ? (string) $left['name'] : '');
            $rightModel = isset($right['modelo']) ? (string) $right['modelo'] : (isset($right['name']) ? (string) $right['name'] : '');
            return strnatcasecmp($leftModel, $rightModel);
        });
        return isset($vehicles[0]) && is_array($vehicles[0]) ? $vehicles[0] : null;
    }

    // URLs canônicas terminam em "-19888"; a rota curta "/veiculo/19888"
    // também continua válida. Sem o hífen aqui, o shell inicial ficava vazio
    // justamente nas URLs publicadas e o Safari mostrava só header + rodapé.
    if (preg_match('#(?:/|-)([0-9]+)$#', (string) $path, $matches)) {
        foreach ($vehicles as $vehicle) {
            if (is_array($vehicle) && isset($vehicle['id']) && (string) $vehicle['id'] === $matches[1]) {
                return $vehicle;
            }
        }
    }
    return null;
}

function netcar_vehicle_cover($vehicle, $preferThumb)
{
    if (!is_array($vehicle)) {
        return null;
    }
    $siteImages = isset($vehicle['imagens_site']) && is_array($vehicle['imagens_site'])
        ? $vehicle['imagens_site']
        : array();
    $candidates = $preferThumb
        ? array(isset($siteImages['capa_thumb']) ? $siteImages['capa_thumb'] : null, isset($siteImages['capa']) ? $siteImages['capa'] : null)
        : array(isset($siteImages['capa']) ? $siteImages['capa'] : null, isset($siteImages['capa_thumb']) ? $siteImages['capa_thumb'] : null);
    if (!empty($vehicle['images'][0])) {
        $candidates[] = $vehicle['images'][0];
    }
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }
    return null;
}

/** Preload responsivo idêntico ao <img> que o React renderiza. */
function netcar_stock_critical_preload($path)
{
    if ($path !== '/seminovos' && !preg_match('#^/veiculo/#', (string) $path)) {
        return '';
    }
    $isStock = $path === '/seminovos';
    $vehicle = netcar_stock_critical_vehicle($path);
    $cover = netcar_vehicle_cover($vehicle, $isStock);
    if ($cover === null) {
        return '';
    }

    $widths = $isStock ? array(320, 480, 640, 768, 960) : array(480, 640, 768, 960, 1280);
    $fallbackWidth = $isStock ? 640 : 960;
    $srcset = array();
    foreach ($widths as $width) {
        $srcset[] = htmlspecialchars(netcar_banner_variant($cover, $width), ENT_QUOTES, 'UTF-8') . ' ' . $width . 'w';
    }
    $href = htmlspecialchars(netcar_banner_variant($cover, $fallbackWidth), ENT_QUOTES, 'UTF-8');
    $sizes = $isStock ? '(max-width: 767px) 50vw, 25vw' : '(max-width: 1023px) 100vw, 70vw';
    return '<link rel="preload" as="image" href="' . $href
        . '" imagesrcset="' . implode(', ', $srcset)
        . '" imagesizes="' . $sizes . '" fetchpriority="high">';
}

function netcar_stock_initial_lcp($path)
{
    if ($path !== '/seminovos' && !preg_match('#^/veiculo/#', (string) $path)) {
        return '';
    }
    $isStock = $path === '/seminovos';
    $vehicle = netcar_stock_critical_vehicle($path);
    $cover = netcar_vehicle_cover($vehicle, $isStock);
    if ($cover === null) {
        return '';
    }
    $widths = $isStock ? array(320, 480, 640, 768, 960) : array(480, 640, 768, 960, 1280);
    $fallbackWidth = $isStock ? 640 : 960;
    $srcset = array();
    foreach ($widths as $width) {
        $srcset[] = htmlspecialchars(netcar_banner_variant($cover, $width), ENT_QUOTES, 'UTF-8') . ' ' . $width . 'w';
    }
    $name = is_array($vehicle) && !empty($vehicle['name']) ? (string) $vehicle['name'] : 'Veículo seminovo';
    $sizes = $isStock ? '(max-width: 767px) 50vw, 25vw' : '100vw';
    $style = $isStock ? ' style="width:50vw;max-width:380px"' : '';
    return '<img src="'
        . htmlspecialchars(netcar_banner_variant($cover, $fallbackWidth), ENT_QUOTES, 'UTF-8')
        . '" srcset="' . implode(', ', $srcset)
        . '" sizes="' . $sizes
        . '" alt="' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8')
        . '" width="1600" height="900" loading="eager" decoding="sync" fetchpriority="high"'
        . $style . '>';
}

function netcar_route_manifest_entry($path)
{
    if ($path === '/') return 'src/modules/home/pages/HomePage.tsx';
    if ($path === '/seminovos') return 'src/modules/seminovos/pages/SeminovosPage.tsx';
    if (preg_match('#^/veiculo/#', (string) $path)) return 'src/modules/detalhes/pages/DetalhesPage.tsx';
    if (preg_match('#^/laudo/#', (string) $path)) return 'src/modules/detalhes/pages/ICheckLaudoPage.tsx';
    if ($path === '/sobre') return 'src/modules/sobre/pages/SobrePage.tsx';
    if ($path === '/contato') return 'src/modules/contato/pages/ContatoPage.tsx';
    if (in_array($path, array('/compra', '/compramos-seu-usado', '/vender-meu-carro'), true)) {
        return 'src/modules/compra/pages/CompraPage.tsx';
    }
    if ($path === '/blog') return 'src/modules/blog/pages/BlogPage.tsx';
    if (preg_match('#^/blog/#', (string) $path)) return 'src/modules/blog/pages/BlogPostPage.tsx';
    if ($path === '/seminovos-automaticos') return 'src/modules/seo/pages/SeminovosAutomaticosPage.tsx';
    if ($path === '/comparar') return 'src/modules/seo/pages/ComparadorPage.tsx';
    if ($path === '/privacidade') return 'src/modules/legal/pages/PrivacyPage.tsx';
    if ($path === '/regioes-atendidas') return 'src/modules/seo/pages/RegionsHubPage.tsx';
    if ($path === '/como-selecionamos-nossos-carros') return 'src/modules/procedencia/pages/ComoSelecionamosPage.tsx';
    if (preg_match('#^/seminovos-[a-z0-9-]+$#', (string) $path)) return 'src/modules/seo/pages/CityLandingPage.tsx';
    if (preg_match('#^/vender-carro-[a-z0-9-]+$#', (string) $path)) return 'src/modules/seo/pages/SellCityLandingPage.tsx';
    if (preg_match('#^/comprar-[a-z0-9-]+$#', (string) $path)) return 'src/modules/seo/pages/EstoqueLandingPage.tsx';
    if (in_array($path, array('/financiamento', '/atendimento-24h', '/move-brasil', '/politica-editorial'), true)) {
        return 'src/modules/seo/pages/contentSeoPages.tsx';
    }
    return null;
}

function netcar_collect_manifest_files($manifest, $key, &$files, &$seen)
{
    if (isset($seen[$key]) || !isset($manifest[$key]) || !is_array($manifest[$key])) return;
    $seen[$key] = true;
    $entry = $manifest[$key];
    if (!empty($entry['file']) && is_string($entry['file'])) {
        $files[] = $entry['file'];
    }
    if (!empty($entry['imports']) && is_array($entry['imports'])) {
        foreach ($entry['imports'] as $dependency) {
            netcar_collect_manifest_files($manifest, $dependency, $files, $seen);
        }
    }
}

function netcar_resolve_manifest_key($manifest, $entryKey)
{
    if (isset($manifest[$entryKey])) return $entryKey;

    $expectedName = pathinfo($entryKey, PATHINFO_FILENAME);
    foreach ($manifest as $key => $entry) {
        if (!is_array($entry)) continue;
        if (isset($entry['src']) && $entry['src'] === $entryKey) return $key;
        if (isset($entry['name']) && $entry['name'] === $expectedName) return $key;
    }
    return null;
}

function netcar_route_modulepreloads($path)
{
    $entryKey = netcar_route_manifest_entry($path);
    $manifestFile = __DIR__ . '/.vite/manifest.json';
    if ($entryKey === null || !is_readable($manifestFile)) return '';
    $manifest = json_decode((string) @file_get_contents($manifestFile), true);
    if (!is_array($manifest)) return '';
    $resolvedKey = netcar_resolve_manifest_key($manifest, $entryKey);
    if ($resolvedKey === null) return '';

    $files = array();
    $seen = array();
    netcar_collect_manifest_files($manifest, $resolvedKey, $files, $seen);
    $tags = array();
    foreach (array_unique($files) as $file) {
        if (!preg_match('/\.js$/', $file)) continue;
        $tags[] = '<link rel="modulepreload" crossorigin href="/'
            . htmlspecialchars(ltrim($file, '/'), ENT_QUOTES, 'UTF-8')
            . '">';
    }
    return implode("\n  ", $tags);
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

/**
 * Converte um veículo do bootstrap no único payload usado pelo preload, pelo
 * shell inicial e pelo React. Ter uma só origem impede o primeiro paint de
 * baixar um carro e a hidratação abrir outro.
 */
function netcar_home_lcp_from_vehicle($vehicle)
{
    if (!is_array($vehicle) || empty($vehicle['id'])) {
        return null;
    }
    $siteImages = isset($vehicle['imagens_site']) && is_array($vehicle['imagens_site'])
        ? $vehicle['imagens_site']
        : array();
    $rawImage = isset($siteImages['capa']) ? $siteImages['capa'] : null;
    $image = netcar_normalize_banner_path($rawImage);
    $brand = isset($vehicle['marca']) ? trim((string) $vehicle['marca']) : '';
    $model = isset($vehicle['modelo']) ? trim((string) $vehicle['modelo']) : '';
    $year = isset($vehicle['year']) ? (int) $vehicle['year'] : (isset($vehicle['ano']) ? (int) $vehicle['ano'] : 0);
    $price = isset($vehicle['price']) ? (float) $vehicle['price'] : (isset($vehicle['valor']) ? (float) $vehicle['valor'] : 0);
    if ($image === null || $brand === '' || $model === '' || $year <= 0 || $price <= 0) {
        return null;
    }

    $hero = array(
        'id' => (string) $vehicle['id'],
        'brand' => $brand,
        'model' => $model,
        'year' => $year,
        'price' => $price,
        'image' => $image,
    );
    foreach (array(
        'valor_formatado',
        'preco_com_troca_formatado',
        'marca',
        'modelo',
        'placa',
        'combustivel',
        'cambio',
    ) as $field) {
        if (isset($vehicle[$field]) && $vehicle[$field] !== '') {
            $hero[$field] = trim((string) $vehicle[$field]);
        }
    }
    if (isset($vehicle['preco_com_troca']) && is_numeric($vehicle['preco_com_troca'])) {
        $hero['preco_com_troca'] = (float) $vehicle['preco_com_troca'];
    }
    $tag = trim(
        (isset($vehicle['combustivel']) ? (string) $vehicle['combustivel'] : '')
        . ' '
        . (isset($vehicle['motor']) ? (string) $vehicle['motor'] : '')
    );
    if ($tag !== '') {
        $hero['tag'] = $tag;
    }

    return array('id' => (string) $vehicle['id'], 'image' => $image, 'hero' => $hero);
}

/** Mesmo contrato de disponibilidade/prioridade usado por homeStock.ts. */
function netcar_daily_home_lcp()
{
    $stock = netcar_stock_bootstrap_value();
    if (!is_array($stock) || empty($stock['vehicles']) || !is_array($stock['vehicles'])) {
        return null;
    }

    $available = array_values(array_filter($stock['vehicles'], function ($vehicle) {
        if (!is_array($vehicle)) return false;
        $price = isset($vehicle['price']) ? (float) $vehicle['price'] : 0;
        $siteImages = isset($vehicle['imagens_site']) && is_array($vehicle['imagens_site'])
            ? $vehicle['imagens_site']
            : array();
        return $price > 0
            && array_key_exists('tem_fotos', $siteImages)
            && $siteImages['tem_fotos'] !== null
            && (int) $siteImages['tem_fotos'] !== 0;
    }));
    if (empty($available)) {
        return null;
    }

    usort($available, function ($left, $right) {
        $leftFeatured = isset($left['destaque']) && (int) $left['destaque'] === 1 ? 1 : 0;
        $rightFeatured = isset($right['destaque']) && (int) $right['destaque'] === 1 ? 1 : 0;
        if ($leftFeatured !== $rightFeatured) {
            return $rightFeatured - $leftFeatured;
        }
        return (isset($right['id']) ? (int) $right['id'] : 0)
            - (isset($left['id']) ? (int) $left['id'] : 0);
    });

    // O primeiro da ordem alimenta o card de destaque abaixo do banner e não se
    // repete no hero. Os quatro seguintes preservam o conjunto atual do carrossel.
    $featuredId = isset($available[0]['id']) ? (string) $available[0]['id'] : '';
    $candidates = array_values(array_filter($available, function ($vehicle) use ($featuredId) {
        $siteImages = isset($vehicle['imagens_site']) && is_array($vehicle['imagens_site'])
            ? $vehicle['imagens_site']
            : array();
        $cover = isset($siteImages['capa']) ? (string) $siteImages['capa'] : '';
        return isset($vehicle['id'])
            && (string) $vehicle['id'] !== $featuredId
            && isset($vehicle['price'])
            && (float) $vehicle['price'] > 80000
            && stripos($cover, '.png') !== false;
    }));
    $candidates = array_slice($candidates, 0, 4);
    if (empty($candidates)) {
        return null;
    }

    // Dia local convertido em número monotônico: mesmo índice durante todo o
    // dia em São Paulo (e para todas as réplicas/cache), próximo índice amanhã.
    try {
        $now = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
        $localDay = intdiv($now->getTimestamp() + $now->getOffset(), 86400);
    } catch (Exception $error) {
        $localDay = intdiv(time() - 10800, 86400);
    }
    // O deslocamento evita que o primeiro dia deste release repita o Cruze,
    // sem introduzir aleatoriedade entre HTML, preload e hidratação.
    $rotationDay = $localDay + 1;
    $selectedIndex = (($rotationDay % count($candidates)) + count($candidates)) % count($candidates);
    return netcar_home_lcp_from_vehicle($candidates[$selectedIndex]);
}

function netcar_get_build_home_lcp()
{
    $daily = netcar_daily_home_lcp();
    if ($daily !== null) {
        return $daily;
    }

    // Fallback do build para bootstrap ausente/inválido ou estoque sem candidato.
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

$modulePreloads = netcar_route_modulepreloads($path);
$stockBootstrapScript = netcar_route_uses_stock_bootstrap($path)
    ? netcar_stock_bootstrap_script($path)
    : null;

$criticalImageByPath = array(
    '/sobre' => array(
        'src' => '/img.php?src=%2Fimages%2Floja1.webp&amp;w=640',
        'srcset' => '/img.php?src=%2Fimages%2Floja1.webp&amp;w=320 320w, /img.php?src=%2Fimages%2Floja1.webp&amp;w=480 480w, /img.php?src=%2Fimages%2Floja1.webp&amp;w=640 640w',
        'sizes' => '(max-width: 767px) 70vw, 320px',
    ),
);
if (isset($criticalImageByPath[$path])) {
    $criticalImage = $criticalImageByPath[$path];
    $html = netcar_prepend_critical_head_markup(
        $html,
        "<link rel=\"preload\" as=\"image\" href=\"{$criticalImage['src']}\" imagesrcset=\"{$criticalImage['srcset']}\" imagesizes=\"{$criticalImage['sizes']}\" fetchpriority=\"high\">"
    );
}

$stockCriticalPreload = netcar_stock_critical_preload($path);
if ($stockCriticalPreload !== '') {
    $html = netcar_prepend_critical_head_markup($html, $stockCriticalPreload);
}
$stockInitialLcp = netcar_stock_initial_lcp($path);
if ($stockInitialLcp !== '') {
    $html = str_replace('<div id="netcar-initial-lcp"></div>', '<div id="netcar-initial-lcp">' . $stockInitialLcp . '</div>', $html);
}

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
            : array(480, 640, 768, 960, 1280);
        $srcsetParts = array();
        foreach ($imageWidths as $imageWidth) {
            $srcsetParts[] = htmlspecialchars(
                netcar_banner_variant($bannerUrl, $imageWidth),
                ENT_QUOTES,
                'UTF-8'
            ) . ' ' . $imageWidth . 'w';
        }
        $responsiveSrcset = implode(', ', $srcsetParts);
        $fallbackWidth = $hasActiveBanner ? 1280 : 960;
        $heroSizes = $hasActiveBanner ? '100vw' : '(max-width: 767px) 50vw, 70vw';
        $heroWidth = $hasActiveBanner ? 1920 : 1280;
        $heroHeight = $hasActiveBanner ? 680 : 960;
        $heroClass = $hasActiveBanner ? ' class="netcar-initial-banner"' : '';
        $bannerFallback = netcar_banner_variant($bannerUrl, $fallbackWidth);
        $preload = '<link rel="preload" as="image" href="'
            . htmlspecialchars($bannerFallback, ENT_QUOTES, 'UTF-8')
            . '" imagesrcset="'
            . $responsiveSrcset
            . '" imagesizes="' . $heroSizes . '" fetchpriority="high" />';
        $html = netcar_prepend_critical_head_markup($html, $preload);
        $initialHero = '<div id="netcar-initial-lcp"><img src="'
            . htmlspecialchars($bannerFallback, ENT_QUOTES, 'UTF-8')
            . '" srcset="'
            . $responsiveSrcset
            . '" sizes="' . $heroSizes . '" alt="Carro seminovo em destaque" width="' . $heroWidth
            . '" height="' . $heroHeight . '" loading="eager" decoding="sync" fetchpriority="high"'
            . $heroClass . '></div>';
        $html = str_replace('<div id="netcar-initial-lcp"></div>', $initialHero, $html);
    }
}

// Imagens críticas aparecem antes dos preloads de JS e do JSON de estoque.
// Isso dá ao navegador a primeira oportunidade de rede para baixar o LCP.
if ($modulePreloads !== '') {
    $html = str_replace('</head>', "  {$modulePreloads}\n  </head>", $html);
}
if ($stockBootstrapScript !== null) {
    // O módulo principal só executa depois do parse. No fim do body, os dados
    // continuam disponíveis a tempo e deixam de atrasar a descoberta do LCP.
    $html = str_replace('</body>', "  {$stockBootstrapScript}\n  </body>", $html);
}

header('Content-Type: text/html; charset=UTF-8');
// O HTML é público e não personalizado. Permite cache de borda curto e
// revalidação, reduzindo TTFB sem congelar estoque ou metadados.
header('Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60');
echo $html;
