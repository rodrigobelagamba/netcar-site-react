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
function conflicts($callable, $message)
{
    try {
        $callable();
    } catch (EntregasPublishConflict $error) {
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
    foreach (array('Photo', 'video', '', null, 1, array()) as $badKind) {
        rejects(function () use ($metadata, $badKind) { entregas_validate_metadata(array_merge($metadata, array('image_kind' => $badKind))); }, 'unknown or malformed image kind rejected');
    }
    foreach (array(null, '', 12, array(), str_repeat('A', 64), str_repeat('a', 63)) as $badHash) {
        rejects(function () use ($metadata, $badHash) { entregas_validate_metadata(array_merge($metadata, array('expected_content_sha256' => $badHash))); }, 'malformed repair hash rejected');
    }
    check(entregas_public_delivery(array('id' => 'legacy'))['imageKind'] === 'story_card', 'legacy records retain Story card compatibility');
    foreach (array(array(0, 0, 0, .5), array(.9, 0, .2, .5), array(0, 0, .5, INF), array('0', 0, .5, .5), array(0, 0, .5), array('x' => 0, 'y' => 0, 'w' => .5, 'h' => .5), array(0, -1, .5, .5)) as $badCrop) {
        rejects(function () use ($metadata, $badCrop) { entregas_validate_metadata(array_merge($metadata, array('card_crop' => $badCrop))); }, 'invalid crop rejected');
        rejects(function () use ($metadata, $badCrop) { entregas_validate_metadata(array_merge($metadata, array('image_kind' => 'photo', 'photo_crop' => $badCrop))); }, 'invalid photo crop rejected');
    }
    $picture = imagecreatetruecolor(480, 800);
    imagefill($picture, 0, 0, imagecolorallocate($picture, 0, 92, 105));
    $image = $temp . '/card.png';
    imagepng($picture, $image);
    rejects(function () use ($metadata, $image) { entregas_publish(array_merge($metadata, array('card_crop' => array(0, 0, .5, .5))), $image, filesize($image)); }, 'nonsquare pixel crop rejected without writing gallery');
    rejects(function () use ($metadata, $image) { entregas_publish(array_merge($metadata, array('image_kind' => 'photo', 'photo_crop' => array(0, 0, .5, .5))), $image, filesize($image)); }, 'nonsquare photo crop rejected before writing gallery');
    rejects(function () use ($metadata, $image) { entregas_publish(array_merge($metadata, array('image_kind' => 'photo', 'photo_crop' => array(0, 0, .000001, .000001))), $image, filesize($image)); }, 'subpixel photo crop rejected');
    rejects(function () use ($metadata, $image) { entregas_publish(array_merge($metadata, array('image_kind' => 'story_card', 'photo_crop' => array(0, .2, .7, .42))), $image, filesize($image)); }, 'Story image cannot acquire a photo crop');
    $first = entregas_publish($metadata, $image, filesize($image));
    check($first['action'] === 'created', 'first event creates record');
    check($first['delivery']['imageKind'] === 'story_card', 'legacy sender creates Story card by default');
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
    $nativeMetadata = array_merge($metadata, array('image_kind' => 'photo'));
    $asPhoto = entregas_publish($nativeMetadata, $image, filesize($image));
    check($asPhoto['action'] === 'updated' && $asPhoto['delivery']['imageKind'] === 'photo' && $asPhoto['delivery']['cardCrop'] === null, 'same ID converted to photo clears old Story framing');
    check($asPhoto['delivery']['id'] === $first['delivery']['id'] && $asPhoto['delivery']['publishedAt'] === $first['delivery']['publishedAt'] && $asPhoto['delivery']['imageUrl'] === $first['delivery']['imageUrl'], 'image kind update preserves links, date and existing bytes');
    clearstatcache();
    check(filemtime($mediaPath) === 1000000000, 'image kind update does not reencode identical bytes');
    $photoRetry = entregas_publish($nativeMetadata, $image, filesize($image));
    check($photoRetry['action'] === 'unchanged', 'native photo retry is idempotent');
    check($photoRetry['delivery']['photoCrop'] === null, 'Story coordinates are never inherited as a photo crop');
    $photoFocused = entregas_publish(array_merge($nativeMetadata, array('photo_crop' => $crop)), $image, filesize($image));
    check($photoFocused['action'] === 'updated' && $photoFocused['delivery']['photoCrop'] === $crop && $photoFocused['delivery']['cardCrop'] === null, 'photo crop enriches only its separate public field');
    check($photoFocused['delivery']['imageUrl'] === $first['delivery']['imageUrl'] && $photoFocused['delivery']['publishedAt'] === $first['delivery']['publishedAt'], 'photo crop does not change full image or publication date');
    clearstatcache();
    check(filemtime($mediaPath) === 1000000000, 'photo crop does not reencode media');
    check(entregas_publish(array_merge($nativeMetadata, array('photo_crop' => $crop)), $image, filesize($image))['action'] === 'unchanged', 'photo crop enrichment retry is idempotent');
    $photoNoCropRetry = entregas_publish($metadata, $image, filesize($image));
    check($photoNoCropRetry['action'] === 'unchanged' && $photoNoCropRetry['delivery']['photoCrop'] === $crop, 'identical bytes preserve photo crop for old sender');
    $photoStored = entregas_json_read($temp . '/data/live.json')['deliveries'][0];
    check($photoStored['imageWidth'] === 480 && $photoStored['imageHeight'] === 800 && !isset($photoFocused['delivery']['imageWidth']), 'pixel dimensions are stored privately for framing validation');
    foreach (array(array('photoCrop' => array(0, 0, .5, .5)), array('imageWidth' => null), array('imageWidth' => '480'), array('photoCrop' => array(0, 0, .5, NAN)), array('photoCrop' => array(.8, 0, .7, .42))) as $unsafe) {
        check(entregas_public_delivery(array_merge($photoStored, $unsafe))['photoCrop'] === null, 'unsafe persisted photo crop falls back to full image');
    }
    check(entregas_public_delivery(array_merge($photoStored, array('imageKind' => 'story_card')))['photoCrop'] === null, 'public Story never exposes a photo crop');
    $legacyPhotoRetry = entregas_publish(array_merge($metadata, array('card_crop' => $crop)), $image, filesize($image));
    check($legacyPhotoRetry['action'] === 'unchanged' && $legacyPhotoRetry['delivery']['imageKind'] === 'photo' && $legacyPhotoRetry['delivery']['cardCrop'] === null, 'legacy same-byte retry cannot reapply Story framing to a photo');
    $photoAliasRetry = entregas_publish(array_merge($metadata, array('delivery_id' => 'wa:photo-alias', 'card_crop' => $crop)), $image, filesize($image));
    check($photoAliasRetry['action'] === 'duplicate' && $photoAliasRetry['delivery']['imageKind'] === 'photo' && $photoAliasRetry['delivery']['cardCrop'] === null, 'legacy duplicate cannot reapply Story framing either');
    check($photoAliasRetry['delivery']['photoCrop'] === $crop, 'same-byte duplicate preserves existing photo crop');
    $otherPhotoCrop = array(.1, .3, .6, .36);
    $newPhotoAlias = array_merge($nativeMetadata, array('delivery_id' => 'wa:photo-crop-alias', 'published_at' => '2026-08-23T01:20:00Z', 'photo_crop' => $otherPhotoCrop));
    $photoAliasFocused = entregas_publish($newPhotoAlias, $image, filesize($image));
    check($photoAliasFocused['action'] === 'updated' && $photoAliasFocused['delivery']['photoCrop'] === $otherPhotoCrop && $photoAliasFocused['delivery']['publishedAt'] === $first['delivery']['publishedAt'], 'new alias can enrich photo crop without replacing the first date');
    $photoAliasFocusedRetry = entregas_publish($newPhotoAlias, $image, filesize($image));
    check($photoAliasFocusedRetry['action'] === 'unchanged' && $photoAliasFocusedRetry['delivery'] === $photoAliasFocused['delivery'], 'same-byte alias retry preserves every public field including the original date');
    $photoReset = entregas_publish(array_merge($nativeMetadata, array('photo_crop' => null)), $image, filesize($image));
    check($photoReset['action'] === 'updated' && $photoReset['delivery']['photoCrop'] === null, 'explicit null removes photo framing');
    entregas_publish(array_merge($nativeMetadata, array('photo_crop' => $crop)), $image, filesize($image));
    $backToStory = entregas_publish(array_merge($metadata, array('image_kind' => 'story_card', 'card_crop' => $crop)), $image, filesize($image));
    check($backToStory['delivery']['cardCrop'] === $crop && $backToStory['delivery']['photoCrop'] === null, 'explicit legacy artwork keeps only its reviewed Story crop');
    $photoAlias = entregas_publish(array_merge($nativeMetadata, array('delivery_id' => 'wa:photo-kind-alias', 'published_at' => '2026-08-22T01:20:00Z')), $image, filesize($image));
    check($photoAlias['action'] === 'updated' && $photoAlias['delivery']['cardCrop'] === null && $photoAlias['delivery']['imageKind'] === 'photo' && $photoAlias['delivery']['publishedAt'] === $first['delivery']['publishedAt'], 'duplicate can correct image kind without duplicating or changing date');
    entregas_publish(array_merge($metadata, array('image_kind' => 'story_card', 'card_crop' => $crop)), $image, filesize($image));
    imagefilledrectangle($picture, 20, 20, 200, 200, imagecolorallocate($picture, 255, 255, 255));
    imagepng($picture, $image);
    clearstatcache();
    $legacyCorrection = entregas_publish($metadata, $image, filesize($image));
    check($legacyCorrection['delivery']['imageKind'] === 'story_card' && $legacyCorrection['delivery']['cardCrop'] === null, 'changed legacy image without new crop still clears stale coordinates');
    $updated = entregas_publish(array_merge($nativeMetadata, array('name' => 'Private person', 'plate' => 'ABC1D23', 'caption' => '<script>bad</script>', 'card_crop' => $crop)), $image, filesize($image));
    check($updated['action'] === 'updated' && $updated['delivery']['id'] === $first['delivery']['id'], 'card correction retains original share ID');
    check($updated['delivery']['imageUrl'] !== $first['delivery']['imageUrl'], 'correction gets fresh immutable image URL');
    check($updated['delivery']['cardCrop'] === null, 'native replacement clears stale coordinates even if a sender repeats them');
    check($updated['delivery']['imageKind'] === 'photo', 'native replacement retains its explicit image kind and rejects inherited zoom');
    $saved = file_get_contents($temp . '/data/live.json');
    check(strpos($saved, 'Private person') === false && strpos($saved, 'ABC1D23') === false && strpos($saved, '<script>') === false, 'unapproved text is never persisted');
    check(!isset($updated['delivery']['contentSha256']), 'public feed omits internal hash');
    entregas_publish(array_merge($nativeMetadata, array('photo_crop' => $crop)), $image, filesize($image));
    imagefilledrectangle($picture, 210, 30, 250, 60, imagecolorallocate($picture, 30, 60, 90));
    imagepng($picture, $image);
    clearstatcache();
    $photoCorrection = entregas_publish($nativeMetadata, $image, filesize($image));
    check($photoCorrection['delivery']['photoCrop'] === null && $photoCorrection['delivery']['cardCrop'] === null, 'new photo bytes without new framing clear both old coordinate spaces');
    check($photoCorrection['delivery']['imageUrl'] !== $updated['delivery']['imageUrl'] && $photoCorrection['delivery']['id'] === $updated['delivery']['id'] && $photoCorrection['delivery']['publishedAt'] === $updated['delivery']['publishedAt'], 'photo replacement retains identity/date but gets new full-image bytes');
    $updated = $photoCorrection;
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
    check(substr_count($pageOne, 'object-fit:contain') === 24 && strpos($pageOne, 'object-fit:cover') === false, 'initial HTML preserves complete photos before React and without JavaScript');
    $framedPublic = entregas_public_delivery($photoStored);
    $framedHtml = entregas_initial_html(array($framedPublic), 1);
    check(strpos($framedHtml, 'data-photo-crop="true"') !== false && strpos($framedHtml, 'padding-top:100%') !== false && strpos($framedHtml, 'height:238.095238%') !== false, 'initial HTML uses the validated square photo framing');
    check(strpos($framedHtml, 'max-width:none!important') !== false, 'framed SSR overrides narrow-screen global important image width limits');
    check(strpos($framedHtml, 'sizes="(max-width:600px) 129vw, (max-width:900px) 65vw, 400px"') !== false, 'framed SSR requests responsive resolution for the enlarged image');
    check(strpos($framedHtml, '#foto=' . $framedPublic['id']) !== false && $framedPublic['imageUrl'] === $first['delivery']['imageUrl'], 'focused thumbnail still opens the same complete image');
    foreach (array(array('imageKind' => 'story_card'), array('photoCrop' => null), array('photoCrop' => array(0, 0, 0, .4)), array('photoCrop' => array(.9, 0, .7, .42))) as $unsafeFraming) {
        $fallbackHtml = entregas_initial_html(array(array_merge($framedPublic, $unsafeFraming)), 1);
        check(strpos($fallbackHtml, 'data-photo-crop') === false && strpos($fallbackHtml, 'object-fit:contain') !== false, 'initial HTML does not reuse Story or unsafe photo coordinates');
    }
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
    $beforeGuard = file_get_contents($temp . '/data/live.json');
    $beforeGuardMedia = glob($temp . '/media/*.webp');
    $guardedMetadata = array_merge($nativeMetadata, array('photo_crop' => $crop, 'expected_content_sha256' => hash_file('sha256', $image)));
    imagefilledrectangle($picture, 290, 300, 390, 400, imagecolorallocate($picture, 0, 120, 140));
    imagepng($picture, $image);
    clearstatcache();
    conflicts(function () use ($guardedMetadata, $image) { entregas_publish(array_merge($guardedMetadata, array('expected_content_sha256' => str_repeat('0', 64))), $image, filesize($image)); }, 'guard rejects a different current image');
    conflicts(function () use ($guardedMetadata, $image) { entregas_publish(array_merge($guardedMetadata, array('delivery_id' => 'wa:missing-repair-target')), $image, filesize($image)); }, 'guard cannot create or deduplicate a missing repair target');
    conflicts(function () use ($guardedMetadata, $image) { entregas_publish(array_merge($guardedMetadata, array('published_at' => '2026-08-25T01:20:00Z')), $image, filesize($image)); }, 'guard cannot change the original publication date');
    check(file_get_contents($temp . '/data/live.json') === $beforeGuard && glob($temp . '/media/*.webp') === $beforeGuardMedia, 'conflicting repairs change neither manifest nor media');
    $guarded = entregas_publish($guardedMetadata, $image, filesize($image));
    check($guarded['action'] === 'updated' && $guarded['delivery']['id'] === $first['delivery']['id'] && $guarded['delivery']['publishedAt'] === $first['delivery']['publishedAt'], 'matching expected hash replaces only the existing publication');
    check($guarded['delivery']['imageKind'] === 'photo' && $guarded['delivery']['cardCrop'] === null && $guarded['delivery']['photoCrop'] === $crop, 'guarded repair applies the native photo contract');
    $afterGuard = file_get_contents($temp . '/data/live.json');
    check(count(json_decode($afterGuard, true)['deliveries']) === 1 && strpos($afterGuard, 'expectedContentSha256') === false && strpos($afterGuard, 'expected_content_sha256') === false, 'repair stays one record and does not persist request preconditions');
    $guardedMedia = $temp . '/media/' . basename($guarded['delivery']['imageUrl']);
    touch($guardedMedia, 1000000001);
    $guardedRetry = entregas_publish($guardedMetadata, $image, filesize($image));
    clearstatcache();
    check($guardedRetry['action'] === 'unchanged' && $guardedRetry['delivery'] === $guarded['delivery'] && file_get_contents($temp . '/data/live.json') === $afterGuard && filemtime($guardedMedia) === 1000000001, 'lost-response retry with old expected hash is a strict no-op');
    conflicts(function () use ($guardedMetadata, $image) { entregas_publish(array_merge($guardedMetadata, array('photo_crop' => null)), $image, filesize($image)); }, 'stale guard cannot mutate crop on completed repair');
    conflicts(function () use ($guardedMetadata, $image) { entregas_publish(array_merge($guardedMetadata, array('published_at' => '2026-08-25T01:20:00Z')), $image, filesize($image)); }, 'stale guard cannot redate a completed repair');
    check(file_get_contents($temp . '/data/live.json') === $afterGuard, 'rejected altered retries preserve completed record');
    $publishEntrypoint = file_get_contents(__DIR__ . '/../../public/entregas/v1/publish.php');
    check(strpos($publishEntrypoint, 'catch (EntregasPublishConflict') !== false && strpos($publishEntrypoint, '409);') !== false, 'authenticated endpoint maps repair conflicts to HTTP 409');
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
