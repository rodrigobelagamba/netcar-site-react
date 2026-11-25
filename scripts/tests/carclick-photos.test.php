<?php
require_once dirname(__DIR__, 2) . '/public/feeds/carclick-description.php';
require_once dirname(__DIR__, 2) . '/public/feeds/carclick-photos.php';

function photo_check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
$root = sys_get_temp_dir() . '/netcar-carclick-photos-' . bin2hex(random_bytes(8));
$native = $root . '/imagens/veiculos_automacar';
$backup = $root . '/images/carclick-gallery';
mkdir($native, 0700, true);
mkdir($backup, 0700, true);
$jpeg = base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AP7//2Q==');
$xml = '<dataroot><veiculo><codigo_anuncio_revenda>100</codigo_anuncio_revenda><modelo>Exemplo</modelo>'
    . '<placa>ABC-1234</placa><chassis>FIXTURE-VIN</chassis><foto1>Cover.jpg</foto1><foto2>Interior.jpg</foto2>'
    . '<foto3 slot="original"/><fotonova>0</fotonova><OBSERVACAO>texto</OBSERVACAO><extra>keep</extra></veiculo></dataroot>';
$prefix = './imagens/veiculos_automacar/';
$gallery = array_map(function ($name) use ($prefix) { return $prefix . $name; }, array(
    'Cover.avif', 'Interior.avif', 'Primeira%20vista.avif', 'Outra.avif', 'Outra.avif', 'Ausente.avif',
    'Invalida.avif', 'falso%2fOutra.avif', 'Bad%00name.avif', 'Diretorio%5cOutra.avif', '../Outra.avif'));
$gallery[] = 'https://example.org/imagens/veiculos_automacar/Externa.avif';
$live = array('id'=>100, 'placa'=>'ABC1234','imagens_site'=>array('tem_fotos'=>1, 'galeria'=>$gallery));
try {
    foreach (array('Primeira vista', 'Invalida', 'Externa') as $name) file_put_contents($backup . '/' . $name . '.jpg', $jpeg);
    file_put_contents($native . '/Outra.jpg', $jpeg);
    file_put_contents($native . '/Invalida.jpg', 'not a JPEG');
    $parsed = netcar_carclick_parse_source($xml);
    photo_check(netcar_carclick_complete_photos($parsed, array(100=>$live), $root) === 2, 'Complete the two eligible views');
    $document = $parsed['document'];
    $expected = str_replace('<foto3 slot="original"/>', '<foto3 slot="original">Primeira vista.jpg</foto3><foto4>Outra.jpg</foto4>', $xml);
    $expectedDocument = new DOMDocument(); $expectedDocument->loadXML($expected);
    photo_check($document->C14N() === $expectedDocument->C14N(), 'Preserve cover, ordering, metadata and non-photo fields');
    photo_check(netcar_carclick_complete_photos(netcar_carclick_parse_source($document->saveXML()), array(100=>$live), $root) === 0, 'No duplicate after next export');
    $mismatch = $live; $mismatch['placa'] = 'ZZZ0000';
    $mismatchedVin = $live; $mismatchedVin['chassi'] = 'ANOTHER-VIN';
    $mismatchedId = $live; $mismatchedId['id'] = 101;
    $removed = $live; $removed['imagens_site']['galeria'] = array($prefix . 'Cover.avif');
    foreach (array(array(), array(100=>$mismatch), array(100=>$mismatchedVin), array(100=>$mismatchedId), array(100=>$removed)) as $inventory) {
        $parsed = netcar_carclick_parse_source($xml);
        photo_check(netcar_carclick_complete_photos($parsed, $inventory, $root) === 0, 'Missing inventory, other unit or retired view');
    }
    $placeholder = netcar_carclick_parse_source(str_replace('Cover.jpg', 'CarroSemFoto.jpg', $xml));
    photo_check(netcar_carclick_complete_photos($placeholder, array(100=>$live), $root) === 0, 'Preserve pending-photo listing');
} finally {
    foreach (array($native, $backup) as $dir) {
        foreach (glob($dir . '/*.jpg') as $file) unlink($file);
        rmdir($dir); rmdir(dirname($dir));
    }
    rmdir($root);
}
echo "CarClick JPEG gallery tests passed\n";
