<?php
// All writes stay in a temporary directory. No database, HTTP or real deliveries.
require_once __DIR__ . '/../../public/entregas/v1/lib.php';

$checks = 0;
function buyer_check($value, $message)
{
    global $checks;
    $checks++;
    if (!$value) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}
function buyer_rejects($callable, $class, $message)
{
    try {
        $callable();
    } catch (Throwable $error) {
        buyer_check($error instanceof $class, $message . ': expected exception type');
        return;
    }
    buyer_check(false, $message);
}
function buyer_cleanup($path)
{
    foreach (scandir($path) as $item) {
        if ($item === '.' || $item === '..') continue;
        $child = $path . '/' . $item;
        is_dir($child) ? buyer_cleanup($child) : unlink($child);
    }
    rmdir($path);
}

$temp = sys_get_temp_dir() . '/netcar-buyer-test-' . bin2hex(random_bytes(6));
mkdir($temp, 0700, true);
putenv('NETCAR_ENTREGAS_DATA_DIR=' . $temp . '/data');
putenv('NETCAR_ENTREGAS_MEDIA_DIR=' . $temp . '/media');
$id = 'delivery-' . str_repeat('a', 24);
$request = array('delivery_public_id' => $id, 'first_name' => 'José');
try {
    buyer_rejects(function () use ($request) { entregas_update_buyer($request); }, 'EntregasDeliveryNotFound', 'missing gallery does not create a delivery');
    buyer_check(!is_dir($temp . '/data'), 'missing gallery remains untouched');
    mkdir($temp . '/data');
    $target = array('id' => $id, 'imageUrl' => '/photo.webp', 'name' => '', 'date' => '2026-11-16',
        'publishedAt' => '2026-11-16T12:00:00Z', 'contentSha256' => str_repeat('b', 64), 'photoCrop' => array(0, 0, 1, 1));
    $other = array('id' => 'delivery-' . str_repeat('c', 24), 'imageUrl' => '/other.webp', 'name' => 'Ana');
    $initial = array('deliveries' => array($target, $other), 'aliases' => array('alias' => $id), 'updatedAt' => '2026-01-01T00:00:00Z');
    entregas_atomic_json($temp . '/data/live.json', $initial);
    $before = file_get_contents($temp . '/data/live.json');
    foreach (array('', 'José Silva', ' José', 'José ', 'José\nSilva', "José\nSilva", "José\u{00A0}Silva", "Jo\u{200B}sé", '<b>José</b>', 'IZN3F86', '51999999999', 'José_1', '-José', 'José-', "D''Ana", array('José'), null, 123, str_repeat('A', 81), str_repeat('𠮷', 65), "\xff") as $invalid) {
        buyer_rejects(function () use ($request, $invalid) { entregas_update_buyer(array_merge($request, array('first_name' => $invalid))); }, 'InvalidArgumentException', 'invalid first name refused');
    }
    foreach (array(null, array(), array('delivery_public_id' => $id), array_merge($request, array('phone' => 'private')), array_merge($request, array('delivery_public_id' => '../live')), array_merge($request, array('delivery_public_id' => array($id)))) as $invalid) {
        buyer_rejects(function () use ($invalid) { entregas_update_buyer($invalid); }, 'InvalidArgumentException', 'invalid payload refused');
    }
    buyer_rejects(function () use ($request) { entregas_update_buyer(array_merge($request, array('delivery_public_id' => 'delivery-' . str_repeat('d', 24)))); }, 'EntregasDeliveryNotFound', 'unknown public ID refused');
    buyer_check(file_get_contents($temp . '/data/live.json') === $before, 'rejections preserve exact manifest bytes');
    foreach (array('José', 'JOÃO', 'Álvaro', 'Ana-Maria', "D'Ávila", 'D’Ávila', "Jose\u{0301}", '李', str_repeat('A', 80)) as $valid) {
        buyer_check(entregas_validate_buyer(array_merge($request, array('first_name' => $valid)))['name'] === $valid, 'valid first name preserved');
    }
    $result = entregas_update_buyer($request);
    buyer_check($result === array('id' => $id, 'name' => 'José', 'action' => 'updated'), 'first name updated on exact public ID');
    $stored = entregas_json_read($temp . '/data/live.json');
    $expected = $initial;
    $expected['deliveries'][0]['name'] = 'José';
    $expected['updatedAt'] = $stored['updatedAt'];
    buyer_check($stored === $expected && $stored['updatedAt'] !== $initial['updatedAt'], 'only target name and feed freshness change');
    buyer_check(!is_dir($temp . '/media'), 'name update never regenerates images');
    $namedBytes = file_get_contents($temp . '/data/live.json');
    buyer_check(entregas_update_buyer($request)['action'] === 'unchanged', 'lost response retry is idempotent');
    buyer_check(file_get_contents($temp . '/data/live.json') === $namedBytes, 'retry leaves manifest and timestamp untouched');
    file_put_contents($temp . '/data/live.json', '{broken');
    buyer_rejects(function () use ($request) { entregas_update_buyer($request); }, 'RuntimeException', 'corrupt live data refused');
    buyer_check(file_get_contents($temp . '/data/live.json') === '{broken', 'corrupt bytes preserved for recovery');
    entregas_atomic_json($temp . '/data/live.json', $stored);

    // Exercise photo corrections and deduplication after a buyer has been resolved.
    $picture = imagecreatetruecolor(100, 100);
    imagefill($picture, 0, 0, imagecolorallocate($picture, 10, 80, 90));
    $image = $temp . '/photo.png';
    imagepng($picture, $image);
    $metadata = array('delivery_id' => 'buyer-test:photo', 'published_at' => '2026-11-15T12:00:00Z', 'image_kind' => 'photo');
    $published = entregas_publish($metadata, $image, filesize($image));
    buyer_check($published['delivery']['name'] === '', 'photo upload cannot assign a buyer');
    $publicId = $published['delivery']['id'];
    entregas_update_buyer(array('delivery_public_id' => $publicId, 'first_name' => 'João'));
    $retry = entregas_publish(array_merge($metadata, array('name' => 'Unapproved Name')), $image, filesize($image));
    buyer_check($retry['action'] === 'unchanged' && $retry['delivery']['name'] === 'João', 'photo retry preserves resolved name and ignores arbitrary metadata');
    $crop = entregas_publish(array_merge($metadata, array('photo_crop' => array(0, 0, .5, .5))), $image, filesize($image));
    buyer_check($crop['delivery']['name'] === 'João', 'crop correction preserves name');
    $duplicate = entregas_publish(array_merge($metadata, array('delivery_id' => 'buyer-test:alias')), $image, filesize($image));
    buyer_check($duplicate['delivery']['id'] === $publicId && $duplicate['delivery']['name'] === 'João', 'deduplicated event preserves buyer on canonical delivery');
    imagefilledrectangle($picture, 0, 0, 50, 50, imagecolorallocate($picture, 100, 150, 200));
    imagepng($picture, $image);
    clearstatcache();
    $corrected = entregas_publish($metadata, $image, filesize($image));
    buyer_check($corrected['delivery']['name'] === 'João' && $corrected['delivery']['id'] === $publicId
        && $corrected['delivery']['publishedAt'] === $published['delivery']['publishedAt']
        && $corrected['delivery']['imageUrl'] !== $published['delivery']['imageUrl'], 'new image bytes retain buyer, link and publication date');
    unlink($temp . '/media/' . basename($corrected['delivery']['previewImageUrl']));
    $repaired = entregas_publish($metadata, $image, filesize($image));
    buyer_check($repaired['delivery']['name'] === 'João', 'missing image repair preserves buyer');
    imagedestroy($picture);
    echo $checks . " buyer checks passed\n";
} finally {
    buyer_cleanup($temp);
}
