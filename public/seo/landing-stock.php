<?php
/** Request-time stock for purchase landings. Never use a build as live evidence. */
require_once __DIR__ . '/helpers.php';
require_once dirname(__DIR__) . '/vehicle-images.php';

function netcar_landing_request_page($offset, $remainingMs = 5000)
{
    if (!function_exists('curl_init')) return null;
    $config = dirname(__DIR__) . '/netcar-config.php';
    if (is_readable($config)) require_once $config;
    $base = defined('NETCAR_API_BASE_URL') ? NETCAR_API_BASE_URL : SEO_SITE_URL . '/api/v1';
    $ch = curl_init(rtrim($base, '/') . '/veiculos.php?limit=500&offset=' . (int) $offset);
    curl_setopt_array($ch, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT_MS => min(2000, $remainingMs),
        CURLOPT_TIMEOUT_MS => min(5000, $remainingMs),
        CURLOPT_HTTPHEADER => array('Accept: application/json', 'Cache-Control: no-cache'),
    ));
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (PHP_VERSION_ID < 80000) curl_close($ch);
    return array('status' => $status, 'payload' => is_string($body) ? json_decode($body, true) : null);
}

/** The endpoint counts each page, and may cap it below the requested limit. */
function netcar_landing_fetch_stock($requestPage = null)
{
    $requestPage = $requestPage ?: 'netcar_landing_request_page';
    $rows = array();
    $seen = array();
    $offset = 0;
    $deadline = microtime(true) + 8;
    for ($page = 0; $page < 20; $page++) {
        $remainingMs = (int) floor(($deadline - microtime(true)) * 1000);
        if ($remainingMs <= 0) return null;
        try {
            $response = call_user_func($requestPage, $offset, $remainingMs);
        } catch (Throwable $error) {
            return null;
        }
        $status = $response['status'] ?? 0;
        $payload = $response['payload'] ?? null;
        if (!is_array($payload) || !isset($payload['data']) || !is_array($payload['data'])
            || !isset($payload['total_results']) || !is_int($payload['total_results'])
            || $payload['total_results'] !== count($payload['data'])) return null;
        $data = $payload['data'];
        $terminal = count($data) === 0 && (
            ($status === 200 && ($payload['success'] ?? null) === true)
            || ($status === 404 && ($payload['success'] ?? null) === false
                && ($payload['message'] ?? '') === 'Nenhum carro encontrado')
        );
        // An empty/error first page is not proof that the entire stock sold.
        if ($terminal && count($rows) > 0) return $rows;
        if ($status !== 200 || ($payload['success'] ?? null) !== true
            || count($data) === 0 || count($data) > 500) return null;
        foreach ($data as $vehicle) {
            if (!is_array($vehicle)) return null;
            $id = $vehicle['id'] ?? null;
            $price = $vehicle['valor'] ?? null;
            if ((!is_int($id) && !is_string($id)) || !preg_match('/^[1-9][0-9]*$/D', (string) $id)
                || isset($seen[(string) $id]) || !is_string($vehicle['marca'] ?? null)
                || !is_string($vehicle['modelo'] ?? null)
                || (!is_int($price) && !is_float($price) && !is_string($price))
                || !preg_match('/^[0-9]+(?:\.[0-9]+)?$/D', (string) $price)
                || !is_finite((float) $price)) return null;
            $seen[(string) $id] = true;
            $rows[] = $vehicle;
        }
        $offset += count($data);
    }
    return null;
}

function netcar_landing_live_stock()
{
    static $loaded = false;
    static $stock = null;
    if (!$loaded) {
        $loaded = true;
        $stock = netcar_landing_fetch_stock();
    }
    return $stock;
}

function netcar_landing_ascii($value)
{
    // iconv transliteration varies with the server locale. Fold Portuguese
    // accents first so filters and canonical model slugs match the JS client.
    $value = strtr((string) $value, array('á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','Á'=>'A','À'=>'A','Â'=>'A','Ã'=>'A','Ä'=>'A','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','É'=>'E','È'=>'E','Ê'=>'E','Ë'=>'E','í'=>'i','ì'=>'i','î'=>'i','ï'=>'i','Í'=>'I','Ì'=>'I','Î'=>'I','Ï'=>'I','ó'=>'o','ò'=>'o','ô'=>'o','õ'=>'o','ö'=>'o','Ó'=>'O','Ò'=>'O','Ô'=>'O','Õ'=>'O','Ö'=>'O','ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u','Ú'=>'U','Ù'=>'U','Û'=>'U','Ü'=>'U','ç'=>'c','Ç'=>'C','ñ'=>'n','Ñ'=>'N'));
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    return $ascii === false ? $value : $ascii;
}

function netcar_landing_normalized($value)
{
    return trim(preg_replace('/[^A-Z0-9]+/', ' ', strtoupper(netcar_landing_ascii($value))));
}

function netcar_landing_vehicle_slug($vehicle)
{
    $vehicle['marca'] = netcar_landing_ascii($vehicle['marca'] ?? '');
    $vehicle['modelo'] = netcar_landing_ascii($vehicle['modelo'] ?? '');
    return seo_generate_vehicle_slug($vehicle);
}

function netcar_landing_matches($vehicle, $filters)
{
    if ((float) ($vehicle['valor'] ?? 0) <= 0) return false;
    foreach (array('marca', 'cambio', 'combustivel') as $field) {
        if (!empty($filters[$field]) && netcar_landing_normalized($vehicle[$field] ?? '') !== netcar_landing_normalized($filters[$field])) return false;
    }
    if (!empty($filters['modelo']) && strpos(str_replace(' ', '', netcar_landing_normalized($vehicle['modelo'] ?? '')), str_replace(' ', '', netcar_landing_normalized($filters['modelo']))) === false) return false;
    $model = netcar_landing_normalized($vehicle['modelo'] ?? '');
    $category = netcar_landing_normalized($vehicle['categoria'] ?? '');
    if (preg_match('/\b(RENEGADE|KICKS)\b/', $model)) $category = 'SUV';
    if (netcar_landing_normalized($vehicle['marca'] ?? '') === 'HONDA' && preg_match('/^CITY\b/', $model) && !preg_match('/\bHATCH\b/', $model)) $category = 'SEDAN';
    if (!empty($filters['categoria']) && $category !== netcar_landing_normalized($filters['categoria'])) return false;
    if (isset($filters['precoMin']) && (float) $vehicle['valor'] < (float) $filters['precoMin']) return false;
    if (isset($filters['precoMax']) && (float) $vehicle['valor'] > (float) $filters['precoMax']) return false;
    return true;
}

function netcar_landing_selection($stock, $landing)
{
    $rows = array_values(array_filter($stock, function ($vehicle) use ($landing) {
        return netcar_landing_matches($vehicle, $landing['filters'] ?? array());
    }));
    usort($rows, function ($a, $b) {
        return strnatcasecmp(netcar_landing_normalized($a['modelo']), netcar_landing_normalized($b['modelo']))
            ?: strnatcasecmp(netcar_landing_normalized($a['marca']), netcar_landing_normalized($b['marca']));
    });
    return $rows;
}

function netcar_landing_paragraphs($landing, $rows)
{
    $fallback = $landing['paragraphs'] ?? array();
    if (!$rows || empty($landing['paragraphTemplates'])) return $fallback;
    $prices = array_column($rows, 'valor');
    $years = array_map(function ($vehicle) { return $vehicle['ano'] ?? null; }, $rows);
    $completeYears = count(array_filter($years, function ($value) { return is_numeric($value) && is_finite((float) $value) && (float) $value > 0; })) === count($rows);
    $values = array(
        '{{minPrice}}' => 'R$ ' . number_format(round(min($prices)), 0, ',', '.'),
        '{{maxPrice}}' => 'R$ ' . number_format(round(max($prices)), 0, ',', '.'),
        '{{minYear}}' => $completeYears ? (string) min($years) : null, '{{maxYear}}' => $completeYears ? (string) max($years) : null,
        '{{years}}' => $completeYears ? (min($years) == max($years) ? (string) min($years) : min($years) . ' a ' . max($years)) : null,
        '{{count}}' => (string) count($rows),
    );
    $complete = true;
    $paragraphs = array_map(function ($text) use ($values, &$complete) {
        return preg_replace_callback('/\{\{[^{}]+\}\}/', function ($match) use ($values, &$complete) {
            if (!isset($values[$match[0]])) { $complete = false; return ''; }
            return $values[$match[0]];
        }, $text);
    }, $landing['paragraphTemplates']);
    return $complete ? $paragraphs : $fallback;
}

function netcar_landing_faq($landing, $rows)
{
    $faq = $landing['faq'] ?? array();
    if (!$rows && isset($faq[0]) && in_array($landing['type'] ?? '', array('marca', 'categoria', 'combustivel'), true)) $faq[0]['a'] = 'Consulte o estoque atualizado nesta página ou fale com a equipe para confirmar a disponibilidade.';
    return $faq;
}

function netcar_landing_bootstrap_vehicle($vehicle)
{
    // Project only public presentation fields; never embed supplier/admin data.
    $result = array();
    foreach (array('marca', 'modelo', 'cor', 'motor', 'combustivel', 'cambio', 'potencia', 'placa', 'categoria', 'valor_formatado', 'preco_com_troca_formatado', 'pdf', 'pdf_url') as $key) {
        if (isset($vehicle[$key]) && is_scalar($vehicle[$key])) $result[$key] = (string) $vehicle[$key];
    }
    $result['id'] = (string) $vehicle['id'];
    $result['name'] = trim($vehicle['marca'] . ' ' . $vehicle['modelo']);
    $result['slug'] = netcar_landing_vehicle_slug($vehicle);
    foreach (array('valor' => 'price', 'ano' => 'year', 'ano_fabricacao' => 'anoFabricacao', 'km' => 'km', 'preco_com_troca' => 'preco_com_troca', 'portas' => 'portas', 'lugares' => 'lugares', 'destaque' => 'destaque', 'promocao' => 'promocao') as $source => $target) {
        if (isset($vehicle[$source]) && is_numeric($vehicle[$source])) $result[$target] = (float) $vehicle[$source];
    }
    $result['images'] = isset($vehicle['imagens']['thumb']) && is_array($vehicle['imagens']['thumb']) ? array_slice($vehicle['imagens']['thumb'], 0, 1) : array();
    $result['imagens_site'] = array();
    foreach (array('capa', 'capa_thumb', 'capa_opengraph', 'tem_fotos') as $key) {
        if (isset($vehicle['imagens_site'][$key]) && is_scalar($vehicle['imagens_site'][$key])) $result['imagens_site'][$key] = $vehicle['imagens_site'][$key];
    }
    $result['imagens_site']['galeria'] = array();
    $result['opcionais'] = array();
    $result['diferenciais'] = array();
    foreach (is_array($vehicle['diferenciais'] ?? null) ? $vehicle['diferenciais'] : array() as $item) {
        if (is_array($item) && in_array($item['tag'] ?? '', array('garantia_fabrica', 'unico_dono'), true)) {
            $result['diferenciais'][] = array('tag' => $item['tag'], 'descricao' => is_string($item['descricao'] ?? null) ? $item['descricao'] : '');
        }
    }
    // Preserve the same raw warranty gate as the JS API adapter, hashing identity.
    $warranty = array('diferenciais' => array());
    foreach (array('id', 'marca', 'modelo', 'motor', 'cambio') as $key) {
        if (is_string($vehicle[$key] ?? null)) $warranty[$key] = $vehicle[$key];
    }
    foreach (array('ano' => 'year', 'ano_fabricacao' => 'anoFabricacao', 'km' => 'km', 'valor' => 'price') as $source => $target) {
        if (is_int($vehicle[$source] ?? null) || is_float($vehicle[$source] ?? null)) $warranty[$target] = $vehicle[$source];
    }
    $vin = strtoupper(trim(is_string($vehicle['chassi'] ?? null) ? $vehicle['chassi'] : ''));
    $plate = strtoupper(trim(is_string($vehicle['placa'] ?? null) ? $vehicle['placa'] : ''));
    if (preg_match('/^[A-HJ-NPR-Z0-9]{17}$/D', $vin)) $warranty['unitKey'] = 'vin-sha256:' . hash('sha256', $vin);
    elseif ((!isset($vehicle['chassi']) || (is_string($vehicle['chassi']) && trim($vehicle['chassi']) === '')) && preg_match('/^(?:[A-Z]{3}-?[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$/D', $plate)) $warranty['unitKey'] = 'plate-sha256:' . hash('sha256', str_replace('-', '', $plate));
    foreach ($result['diferenciais'] as $item) {
        if ($item['tag'] === 'garantia_fabrica') $warranty['diferenciais'][] = array('tag' => 'garantia_fabrica', 'descricao' => '');
    }
    $warranty['observedAt'] = (int) floor(microtime(true) * 1000);
    $result['factoryWarrantyVehicle'] = $warranty;
    return netcarSanitizeVehicleImages($result);
}

function netcar_landing_bootstrap()
{
    $stock = netcar_landing_live_stock();
    if ($stock === null) return null;
    $available = array_values(array_filter($stock, function ($vehicle) { return (float) $vehicle['valor'] > 0; }));
    return array('generatedAt' => gmdate('c'), 'scope' => 'available', 'vehicles' => array_map('netcar_landing_bootstrap_vehicle', $available));
}

function netcar_landing_html($source, $landing, $stock)
{
    $rows = netcar_landing_selection($stock, $landing);
    $canonical = SEO_SITE_URL . '/comprar-' . $landing['slug'];
    $cards = '<h2>Veículos desta seleção</h2>';
    $list = array();
    if (!$rows) $cards .= '<p>Nenhum veículo anunciado nesta seleção no momento.</p><p>Veja outras opções do estoque ou fale com a equipe sobre o carro e a faixa de preço que procura.</p>';
    else $cards .= '<div class="blog-cars">';
    foreach (array_slice($rows, 0, 12) as $index => $vehicle) {
        $vehicle = netcarSanitizeVehicleImages($vehicle);
        $url = SEO_SITE_URL . '/veiculo/' . netcar_landing_vehicle_slug($vehicle);
        $name = trim($vehicle['marca'] . ' ' . $vehicle['modelo'] . ' ' . ($vehicle['ano'] ?? ''));
        $photo = !empty($vehicle['imagens_site']['tem_fotos']) ? ($vehicle['imagens_site']['capa_thumb'] ?? $vehicle['imagens_site']['capa'] ?? $vehicle['imagens']['thumb'][0] ?? '') : '';
        $cards .= '<a class="blog-car" href="' . seo_h($url) . '">'
            . ($photo ? '<img src="' . seo_h($photo) . '" alt="' . seo_h($name) . '" loading="lazy" />' : '')
            . '<span class="blog-car__info"><b>' . seo_h($name) . '</b><small>'
            . seo_h(($vehicle['ano'] ?? '') . ' · ' . number_format((float) ($vehicle['km'] ?? 0), 0, ',', '.') . ' km · ' . ($vehicle['cambio'] ?? ''))
            . '</small><strong>R$ ' . number_format((float) $vehicle['valor'], 0, ',', '.') . '</strong></span></a>';
        $list[] = array('@type' => 'ListItem', 'position' => $index + 1, 'url' => $url, 'name' => $name);
    }
    if ($rows) $cards .= '</div>';
    $query = http_build_query($landing['filters'] ?? array(), '', '&', PHP_QUERY_RFC3986);
    $cards .= '<p><a href="' . seo_h(SEO_SITE_URL . '/seminovos' . ($query ? '?' . $query : '')) . '">' . (count($rows) > 12 ? 'Ver os ' . count($rows) . ' veículos desta seleção' : 'Ajustar filtros no estoque') . '</a></p>';
    $paragraphs = implode('', array_map(function ($text) { return '<p>' . seo_h($text) . '</p>'; }, netcar_landing_paragraphs($landing, $rows)));
    $faq = netcar_landing_faq($landing, $rows);
    $faqHtml = implode('', array_map(function ($item) { return '<h3>' . seo_h($item['q']) . '</h3><p>' . seo_h($item['a']) . '</p>'; }, $faq));
    foreach (array('stock' => $cards, 'paragraphs' => $paragraphs, 'faq' => $faqHtml) as $key => $replacement) {
        $count = 0;
        $source = preg_replace_callback('#<!--netcar:landing-' . $key . ':start-->.*?<!--netcar:landing-' . $key . ':end-->#s', function () use ($replacement) { return $replacement; }, $source, 1, $count);
        if ($count !== 1) return null;
    }
    $schemas = array(
        'collection' => array('@context' => 'https://schema.org', '@type' => 'CollectionPage', '@id' => $canonical . '#webpage', 'url' => $canonical, 'name' => $landing['h1'], 'description' => $landing['description'], 'inLanguage' => 'pt-BR', 'mainEntity' => array('@type' => 'ItemList', 'numberOfItems' => count($rows), 'itemListElement' => $list)),
        'faq' => array('@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => array_map(function ($item) { return array('@type' => 'Question', 'name' => $item['q'], 'acceptedAnswer' => array('@type' => 'Answer', 'text' => $item['a'])); }, $faq)),
    );
    foreach ($schemas as $key => $schema) {
        $count = 0;
        $source = preg_replace_callback('#<script\b(?=[^>]*\bdata-netcar-landing-' . $key . ')[^>]*>.*?</script>#s', function () use ($key, $schema) { return '<script type="application/ld+json" data-netcar-landing-' . $key . '>' . json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . '</script>'; }, $source, 1, $count);
        if ($count !== 1) return null;
    }
    return $source;
}
