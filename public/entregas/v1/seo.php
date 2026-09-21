<?php
require_once __DIR__ . '/lib.php';

function entregas_escape($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function entregas_page_url($page)
{
    return '/entregas' . ($page > 1 ? '?pagina=' . $page : '');
}

function entregas_requested_page()
{
    if (!isset($_GET['pagina'])) {
        return 1;
    }
    return is_string($_GET['pagina']) && preg_match('/^[1-9][0-9]{0,5}$/D', $_GET['pagina'])
        ? (int) $_GET['pagina'] : null;
}

function entregas_page_meta($page)
{
    return array(
        'title' => 'Netcar - Entregas de carros e clientes | Esteio/RS' . ($page > 1 ? ' — Página ' . $page : ''),
        'description' => 'Conheça as entregas de carros da Netcar Multimarcas em Esteio/RS. Explore as fotos por mês e ano, reveja sua entrega e compartilhe esse momento.' . ($page > 1 ? ' Página ' . $page . ' do histórico.' : ''),
        'canonical' => 'https://www.netcarmultimarcas.com.br' . entregas_page_url($page),
        'robots' => 'index, follow, max-image-preview:large',
        'image' => 'https://www.netcarmultimarcas.com.br/entregas-media/mkt-f70fefc7.webp',
    );
}

function entregas_inject_initial_html($html, $markup)
{
    // The shared shell contains nested divs; anchor to its main closing tag.
    $result = preg_replace_callback('#<div\\s+id="netcar-initial-shell"[^>]*>.*?</main>\\s*</div>#s', function () use ($markup) {
        return $markup;
    }, $html, 1, $count);
    if ($result !== null && $count === 1) {
        return $result;
    }
    $result = preg_replace_callback('#<div\\s+id="root">\\s*</div>#s', function () use ($markup) {
        return '<div id="root">' . $markup . '</div>';
    }, $html, 1, $count);
    if ($result === null || $count !== 1) {
        throw new RuntimeException('Delivery HTML shell not found');
    }
    return $result;
}

function entregas_photo_caption($delivery)
{
    if (empty($delivery['date'])) {
        return 'Entrega Netcar — registro sem data';
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $delivery['date']);
    $label = isset($delivery['source']) && $delivery['source'] === 'archive' ? 'Registro de entrega em ' : 'Foto publicada em ';
    return $date ? $label . $date->format('d/m/Y') : 'Entrega Netcar';
}

/** Visible HTML for every visitor, replaced by React on mount. */
function entregas_initial_html($deliveries, $page)
{
    $pageCount = max(1, (int) ceil(count($deliveries) / 24));
    $items = array_slice($deliveries, ($page - 1) * 24, 24);
    $html = '<main id="entregas-initial" style="max-width:1200px;margin:0 auto;padding:32px 20px;color:#153c40;font-family:Arial,sans-serif">'
        . '<nav aria-label="Navegação principal"><a href="/">Netcar</a> · <a href="/seminovos">Estoque</a> · <a href="/sobre">Sobre a Netcar</a></nav>'
        . '<p>ENTREGAS NETCAR · ESTEIO/RS</p><h1>O carro muda. A história fica.</h1>'
        . '<p>Conheça as entregas de carros da Netcar Multimarcas. Encontre seu momento por mês e ano e compartilhe essa história.</p>'
        . '<h2>Cada entrega, uma história.</h2><p>' . count($deliveries) . ' fotos · Página ' . $page . ' de ' . $pageCount . '</p>'
        . '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px">';
    foreach ($items as $index => $delivery) {
        $caption = entregas_photo_caption($delivery);
        $src = isset($delivery['previewImageUrl']) ? $delivery['previewImageUrl'] : $delivery['imageUrl'];
        $srcSet = !empty($delivery['previewSrcSet']) ? ' srcset="' . entregas_escape($delivery['previewSrcSet']) . '" sizes="(max-width:600px) 90vw, (max-width:900px) 45vw, 280px"' : '';
        $html .= '<figure style="margin:0"><a href="' . entregas_escape(entregas_page_url($page) . '#foto=' . rawurlencode($delivery['id'])) . '">'
            . '<img src="' . entregas_escape($src) . '"' . $srcSet
            . ' alt="' . entregas_escape('Entrega de carro na Netcar em Esteio — ' . $caption) . '" loading="' . ($index < 3 ? 'eager' : 'lazy') . '" decoding="async" width="640" height="800" style="width:100%;height:320px;object-fit:cover;border-radius:12px">'
            . '</a><figcaption>' . entregas_escape($caption) . '</figcaption></figure>';
    }
    $html .= '</div><nav aria-label="Páginas do histórico" style="display:flex;gap:20px;margin:32px 0">';
    if ($page > 1) {
        $html .= '<a href="' . entregas_page_url($page - 1) . '" rel="prev">Fotos mais recentes</a>';
    }
    if ($page < $pageCount) {
        $html .= '<a href="' . entregas_page_url($page + 1) . '" rel="next">Fotos anteriores</a>';
    }
    $html .= '</nav><p><a href="/seminovos">Encontre seu próximo carro no estoque Netcar</a></p></main>';
    return $html;
}

function entregas_collection_schema($deliveries, $page)
{
    $meta = entregas_page_meta($page);
    $schema = array(
        '@context' => 'https://schema.org',
        '@type' => 'CollectionPage',
        '@id' => $meta['canonical'] . '#galeria',
        'url' => $meta['canonical'],
        'name' => $meta['title'],
        'description' => $meta['description'],
        'inLanguage' => 'pt-BR',
        'isPartOf' => array('@type' => 'WebSite', 'url' => 'https://www.netcarmultimarcas.com.br/'),
        'mainEntity' => array('@type' => 'ItemList', 'numberOfItems' => count($deliveries), 'itemListElement' => array()),
    );
    foreach (array_slice($deliveries, ($page - 1) * 24, 24) as $index => $delivery) {
        $image = strpos($delivery['imageUrl'], '/') === 0 ? 'https://www.netcarmultimarcas.com.br' . $delivery['imageUrl'] : $delivery['imageUrl'];
        $schema['mainEntity']['itemListElement'][] = array(
            '@type' => 'ListItem', 'position' => ($page - 1) * 24 + $index + 1,
            'item' => array('@type' => 'ImageObject', 'contentUrl' => $image, 'caption' => entregas_photo_caption($delivery)),
        );
    }
    return '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . '</script>';
}
