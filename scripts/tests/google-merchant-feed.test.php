<?php
require_once __DIR__ . '/../../public/feeds/google-merchant-feed.php';

function verify_merchant($value, $message) {
    if (!$value) throw new RuntimeException($message);
}

function merchant_without_urls($raw) {
    $doc = new DOMDocument();
    $doc->loadXML($raw, LIBXML_NONET);
    $xp = new DOMXPath($doc);
    $xp->registerNamespace('m', 'http://base.google.com/ns/1.0');
    foreach ($xp->query('/rss/channel/item/m:link | /rss/channel/item/m:image_link') as $node) $node->textContent = '';
    return $doc->C14N();
}

$root = sys_get_temp_dir() . '/netcar-merchant-' . bin2hex(random_bytes(8));
$dir = $root . '/imagens/veiculos_automacar';
mkdir($dir . '/1200', 0700, true);
$name = 'Capa & ação.jpg';
$base = SEO_SITE_URL . '/imagens/veiculos_automacar/';
$original = $base . '1200/' . rawurlencode($name);
$legacy = SEO_SITE_URL . '/detalhe-produto-c4-x-2022-DEF-**01-branca.html';
$future = 'https://cdn.example.com/photo.jpg?w=1000&amp;q=95';
$item = '<item><p:id>42</p:id><p:title>Veículo &amp; cor</p:title><p:price>10 BRL</p:price>'
    . '<p:image_link>' . $original . '</p:image_link><p:link>' . $legacy . '</p:link>'
    . '<new field="stay"><![CDATA[&]]></new></item>';
$raw = '<rss xmlns:p="http://base.google.com/ns/1.0"><channel><link>https://example.com</link>'
    . $item . str_replace(['<p:id>42', $original], ['<p:id>43', $future], $item) . '</channel></rss>';
$stock = [['id'=>'42', 'modelo'=>'C4 Edição', 'marca'=>'Citroën', 'ano'=>2023, 'placa'=>'ABC1234']];
try {
    // A non-image HTTP error page can also exist on disk with a JPEG suffix.
    file_put_contents($dir . '/1200/' . $name, '<html>missing</html>');
    copy(__DIR__ . '/../../public/images/loja1.jpg', $dir . '/' . $name);
    $result = netcar_merchant_feed($raw, $stock, $root);
    verify_merchant(merchant_without_urls($result) === merchant_without_urls($raw), 'Preserve channel, items, order and unknown fields');
    verify_merchant(strpos($result, $base . rawurlencode($name)) !== false, 'Use verified original JPEG and encode filename once');
    verify_merchant(strpos($result, '/veiculo/c4-edicao-2023-abc-xx34-42') !== false, 'Use canonical live detail for exact ID');
    verify_merchant(strpos($result, '/veiculo/c4-x-2022-def-xx01-43') !== false, 'Handle new supplier car before API refresh');
    verify_merchant(strpos($result, $future) !== false, 'Preserve future CDN URL and its query');
    copy($dir . '/' . $name, $dir . '/1200/' . $name);
    verify_merchant(netcar_merchant_image_url($original, $root) === $original, 'Keep working supplier rendition');
    unlink($dir . '/' . $name);
    unlink($dir . '/1200/' . $name);
    verify_merchant(netcar_merchant_image_url($original, $root) === $original, 'One pending image cannot interrupt other listings');
    foreach ([substr($raw, 0, -4), str_replace('<p:id>43', '<p:id>42', $raw), '<rss><channel/></rss>', '<!DOCTYPE rss>' . $raw] as $invalid) {
        try { netcar_merchant_feed($invalid, $stock, $root); }
        catch (RuntimeException $e) { continue; }
        throw new RuntimeException('Invalid supplier XML was accepted');
    }
} finally {
    foreach ([$dir . '/' . $name, $dir . '/1200/' . $name] as $path) if (is_file($path)) unlink($path);
    rmdir($dir . '/1200'); rmdir($dir); rmdir($root . '/imagens'); rmdir($root);
}
echo "Google Merchant RSS regression tests passed\n";
