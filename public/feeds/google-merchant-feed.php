<?php
require_once dirname(__DIR__) . '/seo/landing-stock.php';

function netcar_merchant_detail_url($id, $link, $vehicle)
{
    if ($vehicle !== null) {
        return SEO_SITE_URL . '/veiculo/' . netcar_landing_vehicle_slug($vehicle);
    }
    // The two supplier exports may arrive minutes apart. The legacy product
    // URL contains the model, model year and masked plate of this very item.
    $path = rawurldecode((string) parse_url($link, PHP_URL_PATH));
    if (preg_match('~^/detalhe-produto-([a-z0-9-]+-[0-9]{4}-[a-z]{3})-\*\*([0-9]{2})-[^/]+\.html$~iD', $path, $m)) {
        return SEO_SITE_URL . '/veiculo/' . strtolower($m[1]) . '-xx' . $m[2] . '-' . $id;
    }
    return $link;
}

function netcar_merchant_image_url($url, $publicRoot)
{
    // Only repair the local legacy thumbnail path. A future supplier URL that
    // uses a different image host or layout passes through unchanged.
    if (!preg_match('~^https?://(?:www\.)?netcarmultimarcas\.com\.br/imagens/veiculos_automacar/1200/([^/?#]+\.jpe?g)$~iD', $url, $m)) {
        return $url;
    }
    $filename = rawurldecode($m[1]);
    if (strpbrk($filename, "/\\") !== false || preg_match('/[\x00-\x1f\x7f]/', $filename)) {
        throw new RuntimeException('Invalid supplier image name');
    }
    $base = '/imagens/veiculos_automacar/';
    foreach (['1200/', '', 'big/'] as $folder) {
        $file = $publicRoot . $base . $folder . $filename;
        if (!is_file($file)) continue;
        $info = @getimagesize($file);
        if ($info && $info[2] === IMAGETYPE_JPEG) {
            return SEO_SITE_URL . $base . $folder . rawurlencode($filename);
        }
    }
    // The importer may run during a photo upload. Keep this item's own URL
    // until the file arrives, allowing the remaining inventory to refresh.
    return $url;
}

function netcar_merchant_feed($raw, $stock, $publicRoot)
{
    if ($raw === '' || preg_match('/<!DOCTYPE|<!ENTITY/i', $raw)) {
        throw new RuntimeException('Invalid supplier XML');
    }
    $doc = new DOMDocument();
    if (!@$doc->loadXML($raw, LIBXML_NONET) || $doc->doctype !== null) {
        throw new RuntimeException('Invalid supplier XML');
    }
    $xpath = new DOMXPath($doc);
    $xpath->registerNamespace('g', 'http://base.google.com/ns/1.0');
    $items = $xpath->query('/rss/channel/item');
    if (!$items->length) throw new RuntimeException('Empty supplier inventory');
    $byId = array_column($stock, null, 'id');
    $seen = [];
    foreach ($items as $item) {
        $fields = [];
        foreach (['id', 'link', 'image_link'] as $name) {
            $nodes = $xpath->query('g:' . $name, $item);
            if ($nodes->length !== 1 || trim($nodes[0]->textContent) === '') {
                throw new RuntimeException('Missing or duplicate supplier field');
            }
            $fields[$name] = $nodes[0];
        }
        $id = trim($fields['id']->textContent);
        if (!preg_match('/^[1-9][0-9]*$/D', $id) || isset($seen[$id])) {
            throw new RuntimeException('Invalid or duplicate supplier ID');
        }
        $seen[$id] = true;
        $fields['link']->textContent = netcar_merchant_detail_url($id, trim($fields['link']->textContent), $byId[$id] ?? null);
        $fields['image_link']->textContent = netcar_merchant_image_url(trim($fields['image_link']->textContent), $publicRoot);
    }
    $doc->encoding = 'UTF-8';
    return $doc->saveXML();
}
