<?php
/** Live comparison fragments. Editorial copy remains in the generated page. */
require_once __DIR__ . '/landing-stock.php';

function netcar_comparison_name($vehicle)
{
    $brand = trim($vehicle['marca'] ?? '');
    $model = trim($vehicle['modelo'] ?? '');
    if ($brand !== '' && stripos($model, $brand) === 0) $model = trim(substr($model, strlen($brand)));
    return trim($brand . ' ' . $model . ' ' . ($vehicle['ano'] ?? ''));
}

function netcar_comparison_url($vehicle)
{
    return SEO_SITE_URL . '/veiculo/' . netcar_landing_vehicle_slug($vehicle);
}

function netcar_comparison_image($vehicle)
{
    $vehicle = netcarSanitizeVehicleImages($vehicle);
    if (empty($vehicle['imagens_site']['tem_fotos'])) return '';
    $raw = $vehicle['imagens_site']['capa_thumb'] ?? $vehicle['imagens_site']['capa'] ?? $vehicle['imagens']['thumb'][0] ?? '';
    return netcar_comparison_image_url($raw);
}

/** API media paths are relative to the site root, never to /comparar/{pair}. */
function netcar_comparison_image_url($raw)
{
    if (!is_string($raw) || trim($raw) === '') return '';
    $url = str_replace('\\', '/', trim($raw));
    if (preg_match('/[\x00-\x1F\x7F]/', $url)) return '';
    if (strpos($url, '//') === 0) $url = 'https:' . $url;
    elseif (preg_match('#^https?://#i', $url)) $url = preg_replace('#^http:#i', 'https:', $url);
    elseif (preg_match('#^[a-z][a-z0-9+.-]*:#i', $url)) return '';
    else $url = SEO_SITE_URL . '/' . ltrim(preg_replace('#^(?:\./)+#', '', $url), '/');
    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['host']) || strtolower($parts['scheme'] ?? '') !== 'https'
        || isset($parts['user']) || isset($parts['pass'])) return '';
    $segments = explode('/', $parts['path'] ?? '');
    $encoded = array();
    foreach ($segments as $segment) {
        $decoded = rawurldecode($segment);
        if ($decoded === '.' || $decoded === '..') return '';
        // Decode then encode each segment once: %20 must not become %2520.
        $encoded[] = rawurlencode($decoded);
    }
    $url = 'https://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '') . implode('/', $encoded);
    foreach (array('query' => '?', 'fragment' => '#') as $key => $separator) {
        if (isset($parts[$key])) $url .= $separator . str_replace(array(' ', '"', '<', '>'), array('%20', '%22', '%3C', '%3E'), $parts[$key]);
    }
    return $url;
}

function netcar_comparison_selection($stock, $page)
{
    $left = netcar_landing_selection($stock, array('filters' => array('marca' => $page['left']['brand'], 'modelo' => $page['left']['model'])));
    $right = netcar_landing_selection($stock, array('filters' => array('marca' => $page['right']['brand'], 'modelo' => $page['right']['model'])));
    $pair = null;
    $difference = INF;
    foreach ($left as $a) foreach ($right as $b) {
        $candidate = abs((float) $a['valor'] - (float) $b['valor']);
        if ((string) $a['id'] !== (string) $b['id'] && $candidate < $difference) {
            $pair = array($a, $b);
            $difference = $candidate;
        }
    }
    return array('left' => $left, 'right' => $right, 'pair' => $pair);
}

function netcar_comparison_card($vehicle)
{
    $url = seo_h(netcar_comparison_url($vehicle));
    $name = seo_h(netcar_comparison_name($vehicle));
    $image = netcar_comparison_image($vehicle);
    return '<article data-comparison-vehicle="' . seo_h($vehicle['id']) . '"><h3><a href="' . $url . '">' . $name . '</a></h3>'
        . ($image ? '<a href="' . $url . '"><img src="' . seo_h($image) . '" alt="' . $name . '" width="480" height="320" loading="lazy" style="max-width:100%;height:auto;object-fit:contain" /></a>' : '<p>Foto indisponível no momento.</p>')
        . '<p><a href="' . $url . '">Ver ficha de ' . $name . '</a></p></article>';
}

function netcar_comparison_category($vehicle)
{
    $model = netcar_landing_normalized($vehicle['modelo'] ?? '');
    if (preg_match('/\b(RENEGADE|KICKS)\b/', $model)) return 'SUV';
    if (netcar_landing_normalized($vehicle['marca'] ?? '') === 'HONDA' && preg_match('/^CITY\b/', $model) && !preg_match('/\bHATCH\b/', $model)) return 'SEDAN';
    return $vehicle['categoria'] ?? '';
}

function netcar_comparison_table($pair)
{
    $rows = array('Preço anunciado' => 'valor', 'Ano' => 'ano', 'Câmbio' => 'cambio', 'Motor' => 'motor', 'Combustível' => 'combustivel', 'Potência' => 'potencia', 'Portas' => 'portas', 'Cor' => 'cor', 'Categoria' => 'categoria');
    $html = '<div style="overflow-x:auto"><table><caption>Dados anunciados das unidades selecionadas</caption><thead><tr><th scope="col">Característica</th>';
    foreach ($pair as $vehicle) $html .= '<th scope="col">' . seo_h(netcar_comparison_name($vehicle)) . '</th>';
    $html .= '</tr></thead><tbody>';
    foreach ($rows as $label => $field) {
        $html .= '<tr><th scope="row">' . seo_h($label) . '</th>';
        foreach ($pair as $vehicle) {
            $value = $field === 'valor' ? 'R$ ' . number_format((float) $vehicle['valor'], 0, ',', '.')
                : ($field === 'categoria' ? netcar_comparison_category($vehicle) : ($vehicle[$field] ?? ''));
            $html .= '<td>' . seo_h($value ?: 'Não informado') . '</td>';
        }
        $html .= '</tr>';
    }
    return $html . '</tbody></table></div>';
}

function netcar_comparison_replace($html, $name, $replacement)
{
    $count = 0;
    $html = preg_replace_callback('#<!--netcar:comparison-' . $name . ':start-->.*?<!--netcar:comparison-' . $name . ':end-->#s', function () use ($replacement) { return $replacement; }, $html, -1, $count);
    return $count === 1 ? $html : null;
}

function netcar_comparison_html($source, $stock, $pages, $page = null)
{
    $available = netcar_landing_selection($stock, array());
    $canonical = SEO_SITE_URL . '/comparar' . ($page ? '/' . $page['slug'] : '');
    if ($page === null) {
        $examples = '';
        foreach ($pages as $definition) {
            $selection = netcar_comparison_selection($available, $definition);
            if (!$selection['pair']) continue;
            $links = array_map(function ($vehicle) { return '<a href="' . seo_h(netcar_comparison_url($vehicle)) . '">' . seo_h(netcar_comparison_name($vehicle)) . '</a>'; }, $selection['pair']);
            $examples .= '<li><strong>' . seo_h($definition['left']['label'] . ' x ' . $definition['right']['label']) . '</strong>: ' . implode(' e ', $links) . '</li>';
        }
        $source = netcar_comparison_replace($source, 'examples', $examples ? '<ul>' . $examples . '</ul>' : '<p>Escolha dois veículos do estoque atual para começar a comparação.</p>');
        if ($source === null) return null;
        // Same priority as the generated showcase: actual photos first.
        $withPhotos = array_values(array_filter($available, function ($vehicle) { return netcar_comparison_image($vehicle) !== ''; }));
        $withoutPhotos = array_values(array_filter($available, function ($vehicle) { return netcar_comparison_image($vehicle) === ''; }));
        $visible = array_slice(array_merge($withPhotos, $withoutPhotos), 0, 10);
        $fragment = '<h2>Carros disponíveis para comparar agora</h2>';
        if (!$visible) $fragment .= '<p>Nenhum veículo anunciado no momento. Consulte a equipe para confirmar novas opções.</p>';
        else {
            $fragment .= '<div class="blog-cars">';
            foreach ($visible as $vehicle) {
                $name = seo_h(netcar_comparison_name($vehicle));
                $photo = netcar_comparison_image($vehicle);
                $fragment .= '<a class="blog-car" href="' . seo_h(netcar_comparison_url($vehicle)) . '">'
                    . ($photo ? '<img src="' . seo_h($photo) . '" alt="' . $name . '" loading="lazy" />' : '')
                    . '<span class="blog-car__info"><b>' . $name . '</b><small>' . seo_h(($vehicle['ano'] ?? '') . ' · ' . ($vehicle['cambio'] ?? ''))
                    . '</small><strong>R$ ' . number_format((float) $vehicle['valor'], 0, ',', '.') . '</strong></span></a>';
            }
            $fragment .= '</div>';
        }
        $fragment .= '<p><a href="' . SEO_SITE_URL . '/comparar">Abrir o comparador interativo</a></p>';
    } else {
        $selection = netcar_comparison_selection($available, $page);
        $pair = $selection['pair'];
        $visible = $pair ?: array_values(array_filter(array($selection['left'][0] ?? null, $selection['right'][0] ?? null)));
        $missing = array();
        if (!$selection['left']) $missing[] = $page['left']['label'];
        if (!$selection['right']) $missing[] = $page['right']['label'];
        $state = $pair ? 'complete' : ($visible ? 'partial' : 'empty');
        $fragment = '<section data-comparison-stock="' . $state . '" aria-labelledby="comparison-stock-title"><h2 id="comparison-stock-title">Carros do estoque nesta comparação</h2><p>' . seo_h($page['stockNote']) . '</p>';
        if (!$pair) $fragment .= '<p>No momento, não há unidades de ' . seo_h(implode(' e ', $missing)) . ' anunciadas para formar este par. O guia continua disponível para sua pesquisa; consulte o estoque e confirme novas opções com a Netcar.</p>';
        foreach ($visible as $vehicle) $fragment .= netcar_comparison_card($vehicle);
        if ($pair) $fragment .= netcar_comparison_table($pair);
        $fragment .= '<p><a href="' . SEO_SITE_URL . '/seminovos">Consultar o estoque completo</a> · <a href="' . SEO_SITE_URL . '/comparar">Montar outra comparação</a></p></section>';
        // Do not leave a sold unit's photo in the social preview of a pair.
        $image = $visible ? netcar_comparison_image($visible[0]) : '';
        $image = $image ?: SEO_SITE_URL . '/images/loja1.jpg';
        $source = preg_replace_callback('#<meta\s+property="og:image"[^>]*>#i', function () use ($image) { return '<meta property="og:image" content="' . seo_h($image) . '" />'; }, $source);
    }
    $source = netcar_comparison_replace($source, 'stock', $fragment);
    if ($source === null) return null;
    $items = array();
    foreach ($visible as $index => $vehicle) $items[] = array('@type' => 'ListItem', 'position' => $index + 1, 'url' => netcar_comparison_url($vehicle), 'name' => netcar_comparison_name($vehicle));
    $schema = array('@context' => 'https://schema.org', '@type' => 'ItemList', '@id' => $canonical . '#current-stock', 'name' => 'Veículos disponíveis nesta comparação', 'numberOfItems' => count($items), 'itemListElement' => $items);
    $markup = '<script type="application/ld+json" data-netcar-comparison-stock>' . json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . '</script>';
    $count = 0;
    $source = preg_replace_callback('#</head>#i', function () use ($markup) { return $markup . '</head>'; }, $source, 1, $count);
    return $count === 1 ? $source : null;
}
