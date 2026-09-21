<?php
// Run with PHP 7.4+ and GD/WebP: php scripts/tests/entregas-backend.test.php
require_once __DIR__ . '/../../public/entregas/v1/seo.php';

$checks = 0;
function check($value, $message)
{
    global $checks;
    $checks++;
    if (!$value) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}
function rejects($callable, $message)
{
    try {
        $callable();
    } catch (InvalidArgumentException $error) {
        check(true, $message);
        return;
    }
    check(false, $message);
}
function remove_test_directory($path)
{
    foreach (scandir($path) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $child = $path . '/' . $item;
        is_dir($child) ? remove_test_directory($child) : unlink($child);
    }
    rmdir($path);
}

$temp = sys_get_temp_dir() . '/netcar-entregas-test-' . bin2hex(random_bytes(6));
mkdir($temp, 0700, true);
putenv('NETCAR_ENTREGAS_DATA_DIR=' . $temp . '/data');
putenv('NETCAR_ENTREGAS_MEDIA_DIR=' . $temp . '/media');
try {
    check(extension_loaded('gd') && function_exists('imagewebp'), 'GD/WebP available');
    foreach (array_merge(glob(__DIR__ . '/../../public/entregas/v1/*.php'), array(__DIR__ . '/../../public/index.php')) as $phpFile) {
        token_get_all(file_get_contents($phpFile), TOKEN_PARSE);
        check(true, 'PHP entrypoint syntax valid: ' . basename($phpFile));
    }
    $testToken = str_repeat('test-only-no-production-secret-', 2);
    putenv('NETCAR_ENTREGAS_PUBLISH_TOKEN=short');
    check(entregas_publish_token() === null, 'short publishing token is refused');
    putenv('NETCAR_ENTREGAS_PUBLISH_TOKEN=' . $testToken);
    check(entregas_publish_token() === $testToken, 'private environment token accepted');
    putenv('NETCAR_ENTREGAS_PUBLISH_TOKEN');
    file_put_contents($temp . '/config.php', '<?php return array("token" => "' . $testToken . '");');
    putenv('NETCAR_ENTREGAS_CONFIG_FILE=' . $temp . '/config.php');
    check(entregas_publish_token() === $testToken, 'config outside webroot accepted');
    putenv('NETCAR_ENTREGAS_CONFIG_FILE=' . __DIR__ . '/../../public/entregas/v1/lib.php');
    check(entregas_publish_token() === null, 'config inside webroot is refused');
    putenv('NETCAR_ENTREGAS_CONFIG_FILE');
    $metadata = array('delivery_id' => 'wa:123:approved-v1', 'published_at' => '2026-08-20T01:20:00Z');
    $parsed = entregas_validate_metadata($metadata);
    check($parsed['date'] === '2026-08-19' && $parsed['month'] === '08', 'publication uses Sao Paulo calendar date');
    check($parsed['id'] === entregas_validate_metadata($metadata)['id'], 'same event has permanent ID');
    check($parsed['id'] !== entregas_validate_metadata(array('delivery_id' => 'wa:124', 'published_at' => $metadata['published_at']))['id'], 'different event has different ID');
    rejects(function () { entregas_validate_metadata(array('delivery_id' => '../outside', 'published_at' => '2026-08-20T01:20:00Z')); }, 'path traversal rejected');
    rejects(function () { entregas_validate_metadata(array('delivery_id' => 'x', 'published_at' => '2026-02-31T01:20:00Z')); }, 'invalid calendar date rejected');
    rejects(function () { entregas_validate_metadata(array('delivery_id' => 'x', 'published_at' => '2026-08-20')); }, 'timezone required');
    rejects(function () { entregas_validate_metadata(array('instagram_media_id' => array('bad'), 'published_at' => '2026-08-20T01:20:00Z')); }, 'non-string media ID rejected');
    foreach (array(array(0, 0, 0, .5), array(.9, 0, .2, .5), array(0, 0, .5, INF), array('0', 0, .5, .5), array(0, 0, .5), array('x' => 0, 'y' => 0, 'w' => .5, 'h' => .5), array(0, -1, .5, .5)) as $badCrop) {
        rejects(function () use ($metadata, $badCrop) { entregas_validate_metadata(array_merge($metadata, array('card_crop' => $badCrop))); }, 'invalid crop rejected');
    }
    $picture = imagecreatetruecolor(480, 800);
    imagefill($picture, 0, 0, imagecolorallocate($picture, 0, 92, 105));
    $image = $temp . '/card.png';
    imagepng($picture, $image);
    rejects(function () use ($metadata, $image) { entregas_publish(array_merge($metadata, array('card_crop' => array(0, 0, .5, .5))), $image, filesize($image)); }, 'nonsquare pixel crop rejected without writing gallery');
    $first = entregas_publish($metadata, $image, filesize($image));
    check($first['action'] === 'created', 'first event creates record');
    check(count(entregas_json_read($temp . '/data/live.json')['deliveries']) === 1, 'one record after publish');
    check(count(glob($temp . '/media/*.webp')) === 4, 'four optimized variants generated');
    check(strpos($first['delivery']['previewSrcSet'], '480w') !== false && strpos($first['delivery']['previewSrcSet'], '960w') === false, 'responsive widths do not upscale');
    $again = entregas_publish($metadata, $image, filesize($image));
    check($again['action'] === 'unchanged' && $again['delivery'] === $first['delivery'], 'retry is idempotent');
    $crop = array(0.0, .2, .7, .42);
    $mediaPath = $temp . '/media/' . basename($first['delivery']['imageUrl']);
    touch($mediaPath, 1000000000);
    clearstatcache();
    $focused = entregas_publish(array_merge($metadata, array('card_crop' => $crop)), $image, filesize($image));
    check($focused['action'] === 'updated' && $focused['delivery']['cardCrop'] == $crop, 'same image can gain public crop metadata');
    check($focused['delivery']['id'] === $first['delivery']['id'] && $focused['delivery']['publishedAt'] === $first['delivery']['publishedAt'] && $focused['delivery']['imageUrl'] === $first['delivery']['imageUrl'], 'crop enrichment retains ID, date and original image URL');
    clearstatcache();
    check(filemtime($mediaPath) === 1000000000, 'crop-only update does not reencode original bytes');
    $cropRetry = entregas_publish(array_merge($metadata, array('card_crop' => $crop)), $image, filesize($image));
    check($cropRetry['action'] === 'unchanged', 'crop update is idempotent');
    $oldClientRetry = entregas_publish($metadata, $image, filesize($image));
    check($oldClientRetry['action'] === 'unchanged' && $oldClientRetry['delivery']['cardCrop'] == $crop, 'older sender without crop preserves framing of identical image');
    $reset = entregas_publish(array_merge($metadata, array('card_crop' => null)), $image, filesize($image));
    check($reset['action'] === 'updated' && $reset['delivery']['cardCrop'] === null, 'explicit null restores complete image');
    $otherId = array_merge($metadata, array('delivery_id' => 'wa:duplicate'));
    $duplicate = entregas_publish($otherId, $image, filesize($image));
    check($duplicate['action'] === 'duplicate' && $duplicate['delivery']['id'] === $first['delivery']['id'], 'same photo under another event is deduplicated');
    check(count(entregas_json_read($temp . '/data/live.json')['deliveries']) === 1, 'duplicate does not increase total');
    $retryAlias = entregas_publish($otherId, $image, filesize($image));
    check($retryAlias['action'] === 'unchanged' && $retryAlias['delivery']['id'] === $first['delivery']['id'], 'deduplicated event resolves same ID on retry');
    $enrichedAlias = entregas_publish(array_merge($metadata, array('delivery_id' => 'wa:another-duplicate', 'published_at' => '2026-08-21T01:20:00Z', 'card_crop' => $crop)), $image, filesize($image));
    check($enrichedAlias['action'] === 'updated' && $enrichedAlias['delivery']['cardCrop'] === $crop && $enrichedAlias['delivery']['publishedAt'] === $first['delivery']['publishedAt'], 'duplicate event can enrich crop without replacing original date');
    imagefilledrectangle($picture, 20, 20, 200, 200, imagecolorallocate($picture, 255, 255, 255));
    imagepng($picture, $image);
    clearstatcache();
    $updated = entregas_publish(array_merge($metadata, array('name' => 'Private person', 'plate' => 'ABC1D23', 'caption' => '<script>bad</script>')), $image, filesize($image));
    check($updated['action'] === 'updated' && $updated['delivery']['id'] === $first['delivery']['id'], 'card correction retains original share ID');
    check($updated['delivery']['imageUrl'] !== $first['delivery']['imageUrl'], 'correction gets fresh immutable image URL');
    check($updated['delivery']['cardCrop'] === null, 'changed image without new crop clears stale coordinates');
    $saved = file_get_contents($temp . '/data/live.json');
    check(strpos($saved, 'Private person') === false && strpos($saved, 'ABC1D23') === false && strpos($saved, '<script>') === false, 'unapproved text is never persisted');
    check(!isset($updated['delivery']['contentSha256']), 'public feed omits internal hash');
    unlink($temp . '/media/' . basename($updated['delivery']['previewImageUrl']));
    $repaired = entregas_publish($metadata, $image, filesize($image));
    check(is_file($temp . '/media/' . basename($repaired['delivery']['previewImageUrl'])), 'retry repairs missing image variant');
    $fake = $temp . '/fake.png';
    file_put_contents($fake, '<?php echo "unsafe";');
    rejects(function () use ($fake) { entregas_validate_image($fake, filesize($fake)); }, 'file extension does not bypass image validation');
    rejects(function () use ($image) { entregas_validate_image($image, 13 * 1024 * 1024); }, 'oversized image rejected');
    $seed = array('deliveries' => array(array('id' => 'old-seed', 'name' => '', 'imageUrl' => '/old.webp', 'date' => '2020-01-01', 'year' => '2020', 'month' => '01', 'source' => 'archive')));
    entregas_atomic_json($temp . '/data/seed.json', $seed);
    $all = entregas_all_deliveries();
    check(count($all) === 2 && $all[0]['id'] === $first['delivery']['id'], 'HTML merges seed and live newest first');
    $recent = $all[0];
    $later = array_merge($recent, array('id' => 'later', 'publishedAt' => '2026-08-20T01:40:00Z'));
    check(entregas_sort(array($recent, $later))[0]['id'] === 'later', 'same day orders by publication time');
    $many = array();
    for ($index = 0; $index < 50; $index++) {
        $many[] = array_merge($recent, array('id' => 'page-item-' . $index));
    }
    $pageOne = entregas_initial_html($many, 1);
    $pageTwo = entregas_initial_html($many, 2);
    check(substr_count($pageOne, '<figure ') === 24 && substr_count($pageTwo, '<figure ') === 24, 'server pages contain 24 actual images');
    check(strpos($pageOne, '?pagina=2') !== false && strpos($pageTwo, '?pagina=3') !== false, 'crawlable next-page links traverse history');
    check(strpos($pageTwo, '#foto=page-item-24') !== false && strpos($pageTwo, '#foto=page-item-0"') === false, 'page two has a distinct slice');
    check(entregas_page_meta(2)['canonical'] === 'https://www.netcarmultimarcas.com.br/entregas?pagina=2', 'paginated canonical retains page');
    $template = file_get_contents(__DIR__ . '/../../index.html');
    $rendered = entregas_inject_initial_html($template, $pageOne);
    check(strpos($rendered, 'id="netcar-initial-shell"') === false && substr_count($rendered, 'id="entregas-initial"') === 1 && substr_count($rendered, 'id="root"') === 1, 'real shared HTML shell is replaced exactly once');
    check(strpos($rendered, '/src/main.tsx') !== false && strpos($rendered, '</body>') !== false, 'injection preserves app script and surrounding document');
    $builtTemplate = __DIR__ . '/../../dist/index.html';
    if (is_file($builtTemplate)) {
        $built = entregas_inject_initial_html(file_get_contents($builtTemplate), $pageTwo);
        check(strpos($built, 'id="netcar-initial-shell"') === false && substr_count($built, '<figure ') === 24 && strpos($built, '/assets/') !== false, 'production build receives real images and preserves assets');
    }
    $_GET = array('pagina' => '0');
    check(entregas_requested_page() === null, 'page zero rejected');
    $_GET = array('pagina' => array('2'));
    check(entregas_requested_page() === null, 'array query rejected');
    $_GET = array('pagina' => '2');
    check(entregas_requested_page() === 2, 'valid page accepted');
    file_put_contents($temp . '/data/live.json', '{broken');
    $rejectedCorrupt = false;
    try {
        entregas_publish($metadata, $image, filesize($image));
    } catch (RuntimeException $error) {
        $rejectedCorrupt = true;
    }
    check($rejectedCorrupt && file_get_contents($temp . '/data/live.json') === '{broken', 'corrupt live file is preserved and publication fails safely');
    imagedestroy($picture);
    echo 'PASS: ' . $checks . " delivery backend checks\n";
} finally {
    remove_test_directory($temp);
}
