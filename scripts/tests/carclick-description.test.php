<?php
require_once __DIR__ . '/../../public/feeds/carclick-description.php';

function check($condition, $label) {
    if (!$condition) throw new RuntimeException($label);
}
function rejects($raw, $label) {
    try { netcar_carclick_parse_source($raw); }
    catch (Throwable $error) { return; }
    throw new RuntimeException('Accepted ' . $label);
}
function fixture($id, $model) {
    return '<veiculo record="preserve"><codigo_anuncio_revenda>' . $id . '</codigo_anuncio_revenda>'
        . '<modelo>' . $model . '</modelo><preco>123456.78</preco><quilometragem>45678</quilometragem>'
        . '<OBSERVACAO><![CDATA[Old description & contents]]></OBSERVACAO>'
        . '<placa>SYNTHETIC-PLATE</placa><chassis>SYNTHETIC-VIN</chassis><renavam>SYNTHETIC-REGISTRATION</renavam>'
        . '<foto1>https://example.invalid/photo?a=1&amp;b=2</foto1>'
        . '<extra future="yes"><value>ç &amp; ação</value></extra></veiculo>';
}
function nonDescriptionXml($raw) {
    $doc = new DOMDocument(); $doc->loadXML($raw, LIBXML_NONET);
    foreach ($doc->getElementsByTagName('OBSERVACAO') as $node) {
        while ($node->firstChild) $node->removeChild($node->firstChild);
    }
    return $doc->C14N();
}
$raw = '<?xml version="1.0" encoding="UTF-8"?><dataroot exported="unchanged">'
    . fixture('900001', 'C4 CACTUS SHINE PACK') . fixture('900002', 'HB20 LIMITED') . '</dataroot>';
$result = netcar_carclick_transform(netcar_carclick_parse_source($raw));
check($result['vehicles'] === 2 && $result['warranties'] === 0, 'Retain both source vehicles');
check(nonDescriptionXml($raw) === nonDescriptionXml($result['xml']), 'Every non-description node and attribute preserved');
$out = new DOMDocument(); check($out->loadXML($result['xml']), 'Valid UTF-8 output');
$texts = array(); foreach ($out->getElementsByTagName('OBSERVACAO') as $node) $texts[] = $node->textContent;
check(strpos($texts[0], 'C4 Cactus Shine Pack') !== false && strpos($texts[1], 'HB20 Limited') !== false, 'Actual model per record');
foreach ($texts as $text) {
    check(strpos($text, 'Nethelp') !== false && strpos($text, 'desde 1997') !== false, 'Approved brand copy');
    check(strpos($text, 'Qual é o modelo e o ano do seu usado?') !== false, 'Approved contact prompt');
    check(!preg_match('/https?:|www\.|@|WhatsApp|R\$|45[.,]?678|123456|90000[12]|SYNTHETIC|quilometragem|\bkm\b/i', $text), 'No contact, price, mileage or identifiers');
    check(strpos($text, 'garantia') === false, 'No warranty inferred from year/model');
}
$withWarranty = netcar_carclick_transform(netcar_carclick_parse_source($raw), function ($row) {
    return $row['codigo_anuncio_revenda'] === '900001'
        ? 'tem garantia de fábrica vigente para motor e câmbio, conforme as condições do fabricante.' : '';
});
check($withWarranty['warranties'] === 1, 'Coverage belongs only to approved unit');
check(strpos($withWarranty['xml'], 'vigente para motor e câmbio') !== false, 'Specific coverage preserved');
check(nonDescriptionXml($raw) === nonDescriptionXml($withWarranty['xml']), 'Warranty affects only description');
rejects('<!DOCTYPE dataroot [<!ENTITY x SYSTEM "file:///etc/passwd">]><dataroot/>', 'external entity');
rejects('<dataroot/>', 'empty inventory');
rejects('<dataroot>' . fixture('900001', 'TERA HIGH') . fixture('900001', 'HB20') . '</dataroot>', 'duplicate ID');
rejects(str_replace('<OBSERVACAO><![CDATA[Old description & contents]]></OBSERVACAO>', '', $raw), 'missing description field');
rejects(str_replace('HB20 LIMITED', 'www.example.invalid', $raw), 'contact URL as model');
rejects(substr($raw, 0, -8), 'partial export');
// Simulate a normal next supplier export: same path, new car, no build or write by us.
$file = tempnam(sys_get_temp_dir(), 'netcar-carclick-test-');
try {
    file_put_contents($file, $raw);
    $hash = hash_file('sha256', $file);
    netcar_carclick_transform(netcar_carclick_parse_source(netcar_carclick_read_source($file)));
    check($hash === hash_file('sha256', $file), 'Supplier file never rewritten');
    $new = str_replace('</dataroot>', fixture('900003', 'NOVO MODELO') . '</dataroot>', $raw);
    file_put_contents($file, $new);
    $next = netcar_carclick_transform(netcar_carclick_parse_source(netcar_carclick_read_source($file)));
    check($next['vehicles'] === 3 && strpos($next['xml'], 'Gostou deste Novo Modelo?') !== false, 'New vehicle automatically receives copy');
    check(nonDescriptionXml($new) === nonDescriptionXml($next['xml']), 'New export fields preserved');
} finally { unlink($file); }
echo "Carclick description and field-preservation tests passed\n";
