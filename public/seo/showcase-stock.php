<?php
/** Request-time inventory fragments, shared by regional and editorial pages. */
require_once __DIR__ . '/comparison-stock.php';

function netcar_showcase_file($path, $root)
{
    if (!is_string($path) || strpos($path, '%') !== false || strpos($path, '..') !== false) return null;
    $path = rtrim($path, '/');
    $exact = array('regioes-atendidas' => 'regions-hub', 'expointer-esteio' => 'page-expointer-esteio');
    $content = array('financiamento', 'atendimento-24h', 'move-brasil', 'seminovos-automaticos', 'politica-editorial', 'privacidade', 'como-selecionamos-nossos-carros', 'carro-de-locadora-vale-a-pena', 'carro-de-leilao-vale-a-pena', 'localiza-seminovos-vale-a-pena', 'movida-seminovos-vale-a-pena', 'unidas-seminovos-vale-a-pena');
    foreach ($content as $slug) $exact[$slug] = 'page-' . $slug;
    $canonical = null;
    $file = null;
    foreach ($exact as $slug => $name) {
        if ($path === '/' . $slug || $path === '/seo-static/' . $name . '.html') {
            $canonical = '/' . $slug;
            $file = $name;
            break;
        }
    }
    foreach (array('blog/' => 'blog-', 'seminovos-' => 'city-', 'vender-carro-' => 'sell-city-') as $prefix => $name) {
        if ($file !== null) break;
        if (preg_match('#^/' . preg_quote($prefix, '#') . '([a-z0-9-]+)$#D', $path, $matches)
            || preg_match('#^/seo-static/' . preg_quote($name, '#') . '([a-z0-9-]+)\.html$#D', $path, $matches)) {
            $canonical = '/' . $prefix . $matches[1];
            $file = $name . $matches[1];
        }
    }
    if ($file === null || !is_file($root . '/seo-static/' . $file . '.html')) return null;
    return array('file' => $root . '/seo-static/' . $file . '.html', 'canonical' => $canonical);
}

function netcar_showcase_score($vehicle, $priorities)
{
    $configured = (float) ($priorities[(string) $vehicle['id']] ?? 0);
    $km = is_numeric($vehicle['km'] ?? null) ? (float) $vehicle['km'] : null;
    $positive = array_filter($priorities, function ($value) { return is_numeric($value) && $value > 0; });
    $automatic = $km !== null && $km > 0 && $km < 25000 ? 25 + round((25000 - $km) / 1000) : 0;
    if ($positive) $automatic = min($automatic, max(1, min($positive) - 1));
    return ((int) ($vehicle['destaque'] ?? 0) === 1 ? 20000 : 0)
        + ((int) ($vehicle['promocao'] ?? 0) === 1 ? 10000 : 0)
        + ($configured > 0 ? $configured : $automatic);
}

function netcar_showcase_selection($stock, $config)
{
    if (!is_array($stock) || !is_array($config) || ($config['version'] ?? $config['v'] ?? null) !== 1
        || !in_array($config['mode'] ?? '', array('ids', 'selection'), true)) return null;
    $limit = $config['limit'] ?? 8;
    if (!is_int($limit) || $limit < 0 || $limit > 500) return null;
    $rows = array_values(array_filter($stock, function ($vehicle) { return (float) ($vehicle['valor'] ?? 0) > 0; }));
    if ($config['mode'] === 'ids') {
        if (!isset($config['ids']) || !is_array($config['ids'])) return null;
        $byId = array();
        foreach ($rows as $vehicle) $byId[(string) $vehicle['id']] = $vehicle;
        $rows = array();
        foreach ($config['ids'] as $id) {
            if ((!is_string($id) && !is_int($id)) || !preg_match('/^[1-9][0-9]*$/D', (string) $id)) return null;
            if (isset($byId[(string) $id])) { $rows[] = $byId[(string) $id]; unset($byId[(string) $id]); }
        }
    } else {
        if (!empty($config['photosOnly'])) $rows = array_values(array_filter($rows, function ($vehicle) { return netcar_comparison_image($vehicle) !== ''; }));
        if (!empty($config['match'])) {
            $match = $config['match'];
            if (!is_array($match) || !in_array($match['field'] ?? '', array('marca', 'modelo', 'cambio', 'combustivel', 'categoria', 'diferenciais'), true)
                || !is_string($match['pattern'] ?? null) || strlen($match['pattern']) > 256) return null;
            $pattern = '~' . str_replace('~', '\\~', $match['pattern']) . '~iu';
            if (@preg_match($pattern, '') === false) return null;
            $rows = array_values(array_filter($rows, function ($vehicle) use ($match, $pattern) {
                $value = $vehicle[$match['field']] ?? '';
                $values = is_array($value) ? $value : array($value);
                foreach ($values as $item) {
                    $item = is_array($item) ? ($item['tag'] ?? '') : $item;
                    if (is_scalar($item) && preg_match($pattern, netcar_landing_ascii((string) $item)) === 1) return true;
                }
                return false;
            }));
        }
        $order = $config['order'] ?? 'photos';
        if (!in_array($order, array('recommended', 'photos', 'api'), true)) return null;
        if ($order === 'recommended') {
            $priorities = json_decode((string) @file_get_contents(__DIR__ . '/showcase-priorities.json'), true);
            $priorities = is_array($priorities) ? $priorities : array();
            usort($rows, function ($a, $b) use ($priorities) {
                return netcar_showcase_score($b, $priorities) <=> netcar_showcase_score($a, $priorities)
                    ?: (float) $b['id'] <=> (float) $a['id'];
            });
        }
        if ($order === 'photos' || !empty($config['photosFirst'])) {
            $rows = array_merge(
                array_values(array_filter($rows, function ($vehicle) { return netcar_comparison_image($vehicle) !== ''; })),
                array_values(array_filter($rows, function ($vehicle) { return netcar_comparison_image($vehicle) === ''; }))
            );
        }
    }
    return array_slice($rows, 0, $limit);
}

function netcar_showcase_fragment($rows, $config)
{
    $html = empty($config['heading']) ? '' : '<h2>' . seo_h($config['heading']) . '</h2>';
    if (!$rows) $html .= '<p>Nenhum veículo anunciado nesta seleção no momento. Consulte o estoque atual ou fale com a equipe.</p>';
    else {
        $html .= '<div class="blog-cars">';
        foreach ($rows as $vehicle) {
            $name = netcar_comparison_name($vehicle);
            $image = netcar_comparison_image($vehicle);
            $specs = array();
            if (!empty($vehicle['ano'])) $specs[] = $vehicle['ano'];
            if (isset($vehicle['km']) && is_numeric($vehicle['km'])) $specs[] = number_format((float) $vehicle['km'], 0, ',', '.') . ' km';
            if (!empty($vehicle['cambio'])) $specs[] = $vehicle['cambio'];
            $html .= '<a class="blog-car" data-stock-vehicle="' . seo_h($vehicle['id']) . '" href="' . seo_h(netcar_comparison_url($vehicle)) . '">'
                . ($image ? '<img src="' . seo_h($image) . '" alt="' . seo_h($name) . '" loading="lazy" />' : '')
                . '<span class="blog-car__info"><b>' . seo_h($name) . '</b><small>' . seo_h(implode(' · ', $specs))
                . '</small><strong>R$ ' . number_format((float) $vehicle['valor'], 0, ',', '.') . '</strong></span></a>';
        }
        $html .= '</div>';
    }
    if (!empty($config['ctaHref'])) $html .= '<p><a href="' . seo_h($config['ctaHref']) . '">' . seo_h($config['ctaLabel'] ?? 'Ver estoque completo') . '</a></p>';
    return $html;
}

function netcar_showcase_html($source, $stock, $canonical)
{
    if (!is_string($source) || !is_array($stock)) return null;
    $visible = array();
    $failed = false;
    $count = 0;
    $source = preg_replace_callback('#<!--netcar:showcase:([A-Za-z0-9+/=]+):start-->.*?<!--netcar:showcase:end-->#s', function ($match) use ($stock, &$visible, &$failed) {
        $config = json_decode((string) base64_decode($match[1], true), true);
        $rows = netcar_showcase_selection($stock, $config);
        if ($rows === null) { $failed = true; return ''; }
        foreach ($rows as $vehicle) $visible[(string) $vehicle['id']] = $vehicle;
        return netcar_showcase_fragment($rows, $config);
    }, $source, -1, $count);
    if ($source === null || $failed || strpos($source, '<!--netcar:showcase:') !== false) return null;
    // Pages without inventory stay independent of stock availability.
    if ($count === 0) return $source;
    $items = array();
    foreach (array_values($visible) as $index => $vehicle) $items[] = array('@type' => 'ListItem', 'position' => $index + 1, 'url' => netcar_comparison_url($vehicle), 'name' => netcar_comparison_name($vehicle));
    $schema = array('@context' => 'https://schema.org', '@type' => 'ItemList', '@id' => $canonical . '#current-stock', 'name' => 'Veículos disponíveis nesta página', 'numberOfItems' => count($items), 'itemListElement' => $items);
    $markup = '<script type="application/ld+json" data-netcar-showcase-stock>' . json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . '</script>';
    if (strpos($source, '<!--netcar:blog-cover:start-->') !== false) {
        $image = '';
        foreach ($visible as $vehicle) { $image = netcar_comparison_image($vehicle); if ($image !== '') break; }
        $image = $image ?: SEO_SITE_URL . '/images/loja1.jpg';
        $source = preg_replace_callback('#<!--netcar:blog-cover:start-->.*?<!--netcar:blog-cover:end-->#s', function () use ($image) { return '<img src="' . seo_h($image) . '" alt="Netcar Multimarcas" loading="lazy" style="width:100%;border-radius:16px;margin:16px 0" />'; }, $source);
        $source = preg_replace_callback('#<meta\s+property="og:image"[^>]*>#i', function () use ($image) { return '<meta property="og:image" content="' . seo_h($image) . '" />'; }, $source);
        $source = preg_replace_callback('#<script\b(?=[^>]*\bdata-netcar-blog-post)[^>]*>(.*?)</script>#s', function ($match) use ($image, &$failed) {
            $schema = json_decode($match[1], true);
            if (!is_array($schema)) { $failed = true; return ''; }
            $schema['image'] = array($image);
            return '<script type="application/ld+json" data-netcar-blog-post>' . json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . '</script>';
        }, $source);
    }
    $source = preg_replace_callback('#</head>#i', function () use ($markup) { return $markup . '</head>'; }, $source, 1, $headCount);
    return !$failed && $headCount === 1 ? $source : null;
}
