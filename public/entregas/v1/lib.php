<?php
/** Shared delivery feed and publishing primitives. No network requests. */

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
        'sourceUrl', 'sourceLabel', 'cardCrop');
    return array_intersect_key($delivery, array_flip($allowed));
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

function entregas_validate_card_crop($crop)
{
    if ($crop === null) {
        return null;
    }
    if (!is_array($crop) || array_keys($crop) !== array(0, 1, 2, 3)) {
        throw new InvalidArgumentException('card_crop must be null or [x, y, width, height]');
    }
    foreach ($crop as $value) {
        if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < 0 || $value > 1) {
            throw new InvalidArgumentException('card_crop coordinates must be finite numbers between 0 and 1');
        }
    }
    if ($crop[2] <= 0 || $crop[3] <= 0 || $crop[0] + $crop[2] > 1.000001 || $crop[1] + $crop[3] > 1.000001) {
        throw new InvalidArgumentException('card_crop must fit inside the complete image');
    }
    $rounded = array_map(function ($value) { return round((float) $value, 6); }, $crop);
    if ($rounded[2] <= 0 || $rounded[3] <= 0) {
        throw new InvalidArgumentException('card_crop dimensions are too small');
    }
    return $rounded;
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
    // Missing means preserve an existing crop for unchanged bytes; explicit null resets it.
    if (array_key_exists('card_crop', $metadata)) {
        $fields['cardCrop'] = entregas_validate_card_crop($metadata['card_crop']);
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
    $info = entregas_validate_image($imagePath, $imageSize);
    if (isset($fields['cardCrop']) && abs($fields['cardCrop'][2] * $info[0] - $fields['cardCrop'][3] * $info[1]) > 1) {
        throw new InvalidArgumentException('card_crop must describe a square in image pixels');
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
        // Same bytes received under a new event ID remain one gallery photo.
        if ($existingIndex === null) {
            foreach ($data['deliveries'] as $index => $item) {
                if (isset($item['contentSha256']) && hash_equals($item['contentSha256'], $hash)) {
                    $aliases[$requestedId] = $item['id'];
                    $data['aliases'] = $aliases;
                    $action = 'duplicate';
                    if (array_key_exists('cardCrop', $fields) && $fields['cardCrop'] != (isset($item['cardCrop']) ? $item['cardCrop'] : null)) {
                        $item['cardCrop'] = $fields['cardCrop'];
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
        if (!array_key_exists('cardCrop', $fields)) {
            $fields['cardCrop'] = $sameImage && isset($previous['cardCrop']) ? $previous['cardCrop'] : null;
        }
        $filesExist = false;
        if ($sameImage) {
            $filesExist = true;
            foreach (array('', '-320', '-640', '-960') as $suffix) {
                $filesExist = $filesExist && is_file(entregas_media_dir() . '/' . $fields['id'] . '-' . substr($hash, 0, 16) . $suffix . '.webp');
            }
            if ($filesExist && $previous['publishedAt'] === $fields['publishedAt']
                && (isset($previous['cardCrop']) ? $previous['cardCrop'] : null) == $fields['cardCrop']) {
                return array('action' => 'unchanged', 'delivery' => entregas_public_delivery($previous));
            }
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
