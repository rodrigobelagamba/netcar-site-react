<?php
/** Shared delivery feed and publishing primitives. No network requests. */

class EntregasPublishConflict extends RuntimeException {}

function entregas_public_root()
{
    return dirname(__DIR__, 2);
}

function entregas_data_dir()
{
    return getenv('NETCAR_ENTREGAS_DATA_DIR') ?: entregas_public_root() . '/entregas-data';
}

function entregas_media_dir()
{
    return getenv('NETCAR_ENTREGAS_MEDIA_DIR') ?: entregas_public_root() . '/entregas-media/live';
}

function entregas_json_read($path, $allowMissing = true)
{
    if (!is_file($path) && $allowMissing) {
        return array('deliveries' => array(), 'aliases' => array(), 'updatedAt' => null);
    }
    $contents = @file_get_contents($path);
    $value = $contents === false ? null : json_decode($contents, true);
    if (!is_array($value) || !isset($value['deliveries']) || !is_array($value['deliveries'])) {
        throw new RuntimeException('Delivery data unavailable');
    }
    foreach ($value['deliveries'] as $delivery) {
        if (!is_array($delivery) || !isset($delivery['id'], $delivery['imageUrl'])
            || !is_string($delivery['id']) || $delivery['id'] === '' || !is_string($delivery['imageUrl'])) {
            throw new RuntimeException('Invalid delivery data');
        }
    }
    return $value;
}

function entregas_public_delivery($delivery)
{
    $allowed = array('id', 'name', 'imageUrl', 'previewImageUrl', 'previewSrcSet',
        'imagePosition', 'date', 'year', 'month', 'caption', 'source', 'publishedAt',
        'sourceUrl', 'sourceLabel', 'cardCrop', 'photoCrop', 'imageKind');
    $public = array_intersect_key($delivery, array_flip($allowed));
    $public['imageKind'] = isset($delivery['imageKind']) ? $delivery['imageKind'] : 'story_card';
    if ($public['imageKind'] === 'photo') {
        $public['cardCrop'] = null;
    }
    $public['photoCrop'] = entregas_safe_photo_crop($delivery);
    return $public;
}

function entregas_sort($items)
{
    // Keep seed order on tied dates; live entries have a publication timestamp.
    foreach ($items as $index => &$item) {
        $item['_order'] = $index;
    }
    unset($item);
    usort($items, function ($a, $b) {
        $date = strcmp(isset($b['date']) ? (string) $b['date'] : '', isset($a['date']) ? (string) $a['date'] : '');
        if ($date === 0 && !empty($a['publishedAt']) && !empty($b['publishedAt'])) {
            $date = strtotime($b['publishedAt']) - strtotime($a['publishedAt']);
        }
        return $date !== 0 ? $date : $a['_order'] - $b['_order'];
    });
    foreach ($items as &$item) {
        unset($item['_order']);
    }
    unset($item);
    return $items;
}

function entregas_all_deliveries()
{
    $seed = entregas_json_read(entregas_data_dir() . '/seed.json', false);
    $live = entregas_json_read(entregas_data_dir() . '/live.json');
    $byId = array();
    foreach (array_merge($live['deliveries'], $seed['deliveries']) as $delivery) {
        if (isset($delivery['id']) && !isset($byId[$delivery['id']])) {
            $byId[$delivery['id']] = entregas_public_delivery($delivery);
        }
    }
    return entregas_sort(array_values($byId));
}

function entregas_atomic_json($path, $value)
{
    $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        throw new RuntimeException('Cannot encode delivery data');
    }
    $temp = tempnam(dirname($path), '.entregas-');
    if ($temp === false) {
        throw new RuntimeException('Cannot create delivery data');
    }
    try {
        if (file_put_contents($temp, $encoded . "\n") === false || !chmod($temp, 0644) || !rename($temp, $path)) {
            throw new RuntimeException('Cannot save delivery data');
        }
    } finally {
        if (is_file($temp)) {
            unlink($temp);
        }
    }
}

function entregas_publish_token()
{
    $token = getenv('NETCAR_ENTREGAS_PUBLISH_TOKEN');
    if ($token !== false && $token !== '') {
        return strlen($token) >= 32 ? $token : null;
    }
    $home = getenv('HOME');
    if (!$home && function_exists('posix_getpwuid')) {
        $owner = posix_getpwuid(fileowner(__FILE__));
        $home = isset($owner['dir']) ? $owner['dir'] : null;
    }
    $path = getenv('NETCAR_ENTREGAS_CONFIG_FILE') ?: ($home ? $home . '/.netcar-entregas-config.php' : null);
    $realPath = $path ? realpath($path) : false;
    // A config accidentally copied below the public root is never accepted.
    $publicRoot = realpath(entregas_public_root());
    if (!$realPath || !$publicRoot || strpos($realPath, $publicRoot . DIRECTORY_SEPARATOR) === 0 || !is_readable($realPath)) {
        return null;
    }
    $config = include $realPath;
    return is_array($config) && isset($config['token']) && is_string($config['token']) && strlen($config['token']) >= 32
        ? $config['token'] : null;
}

function entregas_authorization_header()
{
    foreach (array('HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION') as $key) {
        if (!empty($_SERVER[$key])) {
            return $_SERVER[$key];
        }
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $key => $value) {
            if (strcasecmp($key, 'Authorization') === 0) {
                return $value;
            }
        }
    }
    return '';
}

function entregas_require_publish_auth()
{
    $token = entregas_publish_token();
    if (!$token) {
        entregas_json_response(array('ok' => false, 'error' => 'Publishing is not configured'), 503);
    }
    if (!preg_match('/^Bearer (\S+)$/iD', entregas_authorization_header(), $matches) || !hash_equals($token, $matches[1])) {
        header('WWW-Authenticate: Bearer');
        entregas_json_response(array('ok' => false, 'error' => 'Unauthorized'), 401);
    }
}

function entregas_ini_bytes($value)
{
    $value = trim((string) $value);
    if ($value === '-1') {
        return null;
    }
    $multiplier = array('g' => 1073741824, 'm' => 1048576, 'k' => 1024);
    $suffix = strtolower(substr($value, -1));
    return (int) ((float) $value * (isset($multiplier[$suffix]) ? $multiplier[$suffix] : 1));
}

function entregas_directory_writable($path)
{
    while (!is_dir($path) && dirname($path) !== $path) {
        $path = dirname($path);
    }
    return is_dir($path) && is_writable($path);
}

function entregas_validate_crop($crop, $field)
{
    if ($crop === null) {
        return null;
    }
    if (!is_array($crop) || array_keys($crop) !== array(0, 1, 2, 3)) {
        throw new InvalidArgumentException($field . ' must be null or [x, y, width, height]');
    }
    foreach ($crop as $value) {
        if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < 0 || $value > 1) {
            throw new InvalidArgumentException($field . ' coordinates must be finite numbers between 0 and 1');
        }
    }
    if ($crop[2] <= 0 || $crop[3] <= 0 || $crop[0] + $crop[2] > 1.000001 || $crop[1] + $crop[3] > 1.000001) {
        throw new InvalidArgumentException($field . ' must fit inside the complete image');
    }
    $rounded = array_map(function ($value) { return round((float) $value, 6); }, $crop);
    if ($rounded[2] <= 0 || $rounded[3] <= 0) {
        throw new InvalidArgumentException($field . ' dimensions are too small');
    }
    return $rounded;
}

function entregas_validate_card_crop($crop)
{
    return entregas_validate_crop($crop, 'card_crop');
}

function entregas_validate_crop_pixels($crop, $width, $height, $field)
{
    if ($crop !== null && (min($crop[2] * $width, $crop[3] * $height) < 1
        || abs($crop[2] * $width - $crop[3] * $height) > 1)) {
        throw new InvalidArgumentException($field . ' must describe a square in image pixels');
    }
    return $crop;
}

/** A stored photo crop is usable only with its own validated image dimensions. */
function entregas_safe_photo_crop($delivery)
{
    if (!isset($delivery['imageKind']) || $delivery['imageKind'] !== 'photo'
        || !isset($delivery['photoCrop'], $delivery['imageWidth'], $delivery['imageHeight'])
        || !is_int($delivery['imageWidth']) || !is_int($delivery['imageHeight'])
        || min($delivery['imageWidth'], $delivery['imageHeight']) < 32
        || max($delivery['imageWidth'], $delivery['imageHeight']) > 8192
        || $delivery['imageWidth'] * $delivery['imageHeight'] > 16000000) {
        return null;
    }
    try {
        return entregas_validate_crop_pixels(entregas_validate_crop($delivery['photoCrop'], 'photo_crop'),
            $delivery['imageWidth'], $delivery['imageHeight'], 'photo_crop');
    } catch (InvalidArgumentException $error) {
        return null;
    }
}

/** Never carry coordinates across image bytes or between photo and Story spaces. */
function entregas_resolve_framing($fields, $previous, $sameImage, $info)
{
    $previousKind = $previous && isset($previous['imageKind']) ? $previous['imageKind'] : 'story_card';
    $kind = isset($fields['imageKind']) ? $fields['imageKind'] : ($sameImage ? $previousKind : 'story_card');
    if ($kind !== 'photo' && isset($fields['photoCrop'])) {
        throw new InvalidArgumentException('photo_crop requires image_kind photo');
    }
    $sameSpace = $sameImage && $kind === $previousKind;
    $fields['imageKind'] = $kind;
    $fields['cardCrop'] = $kind === 'photo' ? null : (array_key_exists('cardCrop', $fields)
        ? $fields['cardCrop'] : ($sameSpace && isset($previous['cardCrop']) ? $previous['cardCrop'] : null));
    $fields['photoCrop'] = $kind !== 'photo' ? null : (array_key_exists('photoCrop', $fields)
        ? $fields['photoCrop'] : ($sameSpace ? entregas_safe_photo_crop($previous) : null));
    $fields['imageWidth'] = $info[0];
    $fields['imageHeight'] = $info[1];
    return $fields;
}

function entregas_validate_metadata($metadata)
{
    if (!is_array($metadata)) {
        throw new InvalidArgumentException('metadata must be a JSON object');
    }
    $externalId = isset($metadata['delivery_id']) ? $metadata['delivery_id'] : null;
    if (!$externalId && isset($metadata['instagram_media_id']) && is_string($metadata['instagram_media_id'])) {
        $externalId = 'instagram:' . $metadata['instagram_media_id'];
    }
    if (!is_string($externalId) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/D', $externalId)) {
        throw new InvalidArgumentException('A stable delivery_id or instagram_media_id is required');
    }
    $publishedAt = isset($metadata['published_at']) ? $metadata['published_at'] : null;
    if (!is_string($publishedAt) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $publishedAt)) {
        throw new InvalidArgumentException('published_at must include an ISO 8601 timezone');
    }
    try {
        $date = new DateTimeImmutable($publishedAt);
        $errors = DateTimeImmutable::getLastErrors();
        if ($errors && ($errors['warning_count'] || $errors['error_count'])) {
            throw new Exception('Invalid date');
        }
    } catch (Exception $error) {
        throw new InvalidArgumentException('Invalid published_at');
    }
    if ($date->getTimestamp() > time() + 86400 || $date->format('Y') < 2000) {
        throw new InvalidArgumentException('published_at is outside the supported range');
    }
    $localDate = $date->setTimezone(new DateTimeZone('America/Sao_Paulo'));
    $fields = array(
        'id' => 'delivery-' . substr(hash('sha256', $externalId), 0, 24),
        'publishedAt' => $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),
        'date' => $localDate->format('Y-m-d'),
        'year' => $localDate->format('Y'),
        'month' => $localDate->format('m'),
    );
    if (array_key_exists('expected_content_sha256', $metadata)) {
        if (!is_string($metadata['expected_content_sha256']) || !preg_match('/^[a-f0-9]{64}$/D', $metadata['expected_content_sha256'])) {
            throw new InvalidArgumentException('expected_content_sha256 must be a lowercase SHA-256 digest');
        }
        $fields['expectedContentSha256'] = $metadata['expected_content_sha256'];
    }
    if (array_key_exists('image_kind', $metadata)) {
        if (!is_string($metadata['image_kind']) || !in_array($metadata['image_kind'], array('photo', 'story_card'), true)) {
            throw new InvalidArgumentException('image_kind must be photo or story_card');
        }
        $fields['imageKind'] = $metadata['image_kind'];
    }
    // Missing means preserve an existing crop for unchanged bytes; explicit null resets it.
    if (array_key_exists('card_crop', $metadata)) {
        $fields['cardCrop'] = entregas_validate_card_crop($metadata['card_crop']);
    }
    if (array_key_exists('photo_crop', $metadata)) {
        $fields['photoCrop'] = entregas_validate_crop($metadata['photo_crop'], 'photo_crop');
    }
    if (isset($fields['imageKind']) && $fields['imageKind'] === 'photo') {
        $fields['cardCrop'] = null;
    }
    return $fields;
}

function entregas_validate_image($path, $size)
{
    if ($size < 1 || $size > 12 * 1024 * 1024) {
        throw new InvalidArgumentException('Image must be between 1 byte and 12 MB');
    }
    $image = @getimagesize($path);
    $allowed = array(IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP);
    if (!$image || !in_array($image[2], $allowed, true) || $image[0] < 32 || $image[1] < 32
        || $image[0] > 8192 || $image[1] > 8192 || $image[0] * $image[1] > 16000000) {
        throw new InvalidArgumentException('Upload a JPG, PNG or WebP image of at most 16 megapixels');
    }
    return $image;
}

function entregas_write_webp($source, $sourceWidth, $sourceHeight, $width, $height, $path, $quality)
{
    $canvas = imagecreatetruecolor($width, $height);
    if (!$canvas) {
        throw new RuntimeException('Cannot allocate image');
    }
    $temp = tempnam(dirname($path), '.entregas-');
    try {
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        if (!imagecopyresampled($canvas, $source, 0, 0, 0, 0, $width, $height, $sourceWidth, $sourceHeight)
            || $temp === false || !imagewebp($canvas, $temp, $quality) || !filesize($temp)
            || !chmod($temp, 0644) || !rename($temp, $path)) {
            throw new RuntimeException('Cannot write optimized image');
        }
    } finally {
        imagedestroy($canvas);
        if ($temp && is_file($temp)) {
            unlink($temp);
        }
    }
}

function entregas_optimize_image($path, $info, $id, $hash)
{
    if (!extension_loaded('gd') || !function_exists('imagewebp')) {
        throw new RuntimeException('Server requires GD with WebP support');
    }
    $loader = array(IMAGETYPE_JPEG => 'imagecreatefromjpeg', IMAGETYPE_PNG => 'imagecreatefrompng', IMAGETYPE_WEBP => 'imagecreatefromwebp');
    $loadImage = $loader[$info[2]];
    $source = @$loadImage($path);
    if (!$source) {
        throw new InvalidArgumentException('Image cannot be decoded');
    }
    $dir = entregas_media_dir();
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        imagedestroy($source);
        throw new RuntimeException('Cannot create media directory');
    }
    // Immutable names keep corrected cards fresh through long-lived image caches.
    $base = $id . '-' . substr($hash, 0, 16);
    $prefix = '/entregas-media/live/' . $base;
    try {
        $scale = min(1, 2400 / max($info[0], $info[1]));
        entregas_write_webp($source, $info[0], $info[1], max(1, (int) round($info[0] * $scale)), max(1, (int) round($info[1] * $scale)), $dir . '/' . $base . '.webp', 88);
        $srcSet = array();
        foreach (array(320, 640, 960) as $target) {
            $width = min($target, $info[0]);
            $height = max(1, (int) round($info[1] * $width / $info[0]));
            entregas_write_webp($source, $info[0], $info[1], $width, $height, $dir . '/' . $base . '-' . $target . '.webp', 82);
            $srcSet[$width] = $prefix . '-' . $target . '.webp ' . $width . 'w';
        }
        return array('imageUrl' => $prefix . '.webp', 'previewImageUrl' => $prefix . '-640.webp', 'previewSrcSet' => implode(', ', $srcSet));
    } finally {
        imagedestroy($source);
    }
}

/** Lock covers read, dedup, image generation and atomic manifest replacement. */
function entregas_publish($metadata, $imagePath, $imageSize)
{
    $fields = entregas_validate_metadata($metadata);
    $expectedHash = isset($fields['expectedContentSha256']) ? $fields['expectedContentSha256'] : null;
    unset($fields['expectedContentSha256']);
    $info = entregas_validate_image($imagePath, $imageSize);
    foreach (array('cardCrop' => 'card_crop', 'photoCrop' => 'photo_crop') as $key => $field) {
        if (isset($fields[$key])) {
            entregas_validate_crop_pixels($fields[$key], $info[0], $info[1], $field);
        }
    }
    $hash = hash_file('sha256', $imagePath);
    $dir = entregas_data_dir();
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        throw new RuntimeException('Cannot create data directory');
    }
    $lock = fopen($dir . '/.publish.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Cannot lock delivery data');
    }
    try {
        $data = entregas_json_read($dir . '/live.json');
        $aliases = isset($data['aliases']) && is_array($data['aliases']) ? $data['aliases'] : array();
        $requestedId = $fields['id'];
        if (isset($aliases[$requestedId])) {
            $fields['id'] = $aliases[$requestedId];
        }
        $existingIndex = null;
        foreach ($data['deliveries'] as $index => $item) {
            if ($item['id'] === $fields['id']) {
                $existingIndex = $index;
                break;
            }
        }
        $guardRetry = false;
        if ($expectedHash !== null) {
            if ($existingIndex === null) {
                throw new EntregasPublishConflict('Repair target no longer exists');
            }
            $target = $data['deliveries'][$existingIndex];
            $currentHash = isset($target['contentSha256']) && is_string($target['contentSha256']) ? $target['contentSha256'] : '';
            if (!hash_equals($currentHash, $expectedHash)) {
                if (!hash_equals($currentHash, $hash)) {
                    throw new EntregasPublishConflict('Repair target changed; inspect before retrying');
                }
                // A lost response may be retried only as a strict no-op below.
                $guardRetry = true;
            }
            if ($target['publishedAt'] !== $fields['publishedAt']) {
                throw new EntregasPublishConflict('Repair cannot change the original publication date');
            }
        }
        // Same bytes received under a new event ID remain one gallery photo.
        if ($existingIndex === null) {
            foreach ($data['deliveries'] as $index => $item) {
                if (isset($item['contentSha256']) && hash_equals($item['contentSha256'], $hash)) {
                    $aliases[$requestedId] = $item['id'];
                    $data['aliases'] = $aliases;
                    $action = 'duplicate';
                    $framing = entregas_resolve_framing($fields, $item, true, $info);
                    if ($framing['cardCrop'] != (isset($item['cardCrop']) ? $item['cardCrop'] : null)
                        || $framing['photoCrop'] != (isset($item['photoCrop']) ? $item['photoCrop'] : null)
                        || $framing['imageKind'] !== (isset($item['imageKind']) ? $item['imageKind'] : 'story_card')) {
                        foreach (array('cardCrop', 'photoCrop', 'imageKind', 'imageWidth', 'imageHeight') as $key) {
                            $item[$key] = $framing[$key];
                        }
                        $data['deliveries'][$index] = $item;
                        $data['updatedAt'] = gmdate('Y-m-d\TH:i:s\Z');
                        $action = 'updated';
                    }
                    entregas_atomic_json($dir . '/live.json', $data);
                    return array('action' => $action, 'delivery' => entregas_public_delivery($item));
                }
            }
        }
        $previous = $existingIndex === null ? null : $data['deliveries'][$existingIndex];
        $sameImage = $previous && isset($previous['contentSha256']) && hash_equals($previous['contentSha256'], $hash);
        if ($sameImage && $requestedId !== $fields['id']) {
            // A retry through a deduplicated event must retain the original date too.
            foreach (array('publishedAt', 'date', 'year', 'month') as $key) {
                $fields[$key] = $previous[$key];
            }
        }
        $fields = entregas_resolve_framing($fields, $previous, $sameImage, $info);
        $filesExist = false;
        if ($sameImage) {
            $filesExist = true;
            foreach (array('', '-320', '-640', '-960') as $suffix) {
                $filesExist = $filesExist && is_file(entregas_media_dir() . '/' . $fields['id'] . '-' . substr($hash, 0, 16) . $suffix . '.webp');
            }
            if ($filesExist && $previous['publishedAt'] === $fields['publishedAt']
                && (isset($previous['cardCrop']) ? $previous['cardCrop'] : null) == $fields['cardCrop']
                && (isset($previous['photoCrop']) ? $previous['photoCrop'] : null) == $fields['photoCrop']
                && (isset($previous['imageKind']) ? $previous['imageKind'] : 'story_card') === $fields['imageKind']) {
                return array('action' => 'unchanged', 'delivery' => entregas_public_delivery($previous));
            }
        }
        if ($guardRetry) {
            throw new EntregasPublishConflict('Repair retry differs from the completed publication');
        }
        // A crop-only enrichment keeps the original and every immutable variant intact.
        $images = $filesExist ? array_intersect_key($previous, array_flip(array('imageUrl', 'previewImageUrl', 'previewSrcSet')))
            : entregas_optimize_image($imagePath, $info, $fields['id'], $hash);
        $delivery = array_merge($fields, $images, array(
            'name' => '',
            'caption' => 'Entrega Netcar',
            'source' => 'marketing',
            'sourceLabel' => 'Entregas Netcar',
            'imagePosition' => 'center 40%',
            'contentSha256' => $hash,
        ));
        if ($existingIndex === null) {
            array_unshift($data['deliveries'], $delivery);
        } else {
            $data['deliveries'][$existingIndex] = $delivery;
        }
        $data['deliveries'] = entregas_sort($data['deliveries']);
        $data['updatedAt'] = gmdate('Y-m-d\TH:i:s\Z');
        $data['aliases'] = $aliases;
        entregas_atomic_json($dir . '/live.json', $data);
        return array('action' => $previous ? 'updated' : 'created', 'delivery' => entregas_public_delivery($delivery));
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function entregas_json_response($value, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
    echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
