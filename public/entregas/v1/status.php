<?php
require_once __DIR__ . '/lib.php';
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    entregas_json_response(array('ok' => false, 'error' => 'Method not allowed'), 405);
}
entregas_require_publish_auth();
$upload = entregas_ini_bytes(ini_get('upload_max_filesize'));
$post = entregas_ini_bytes(ini_get('post_max_size'));
$memory = entregas_ini_bytes(ini_get('memory_limit'));
$gdWebp = extension_loaded('gd') && function_exists('imagewebp') && !empty(gd_info()['WebP Support']);
$storage = entregas_directory_writable(entregas_data_dir()) && entregas_directory_writable(entregas_media_dir());
entregas_json_response(array(
    'ok' => true,
    'ready' => $gdWebp && $storage && $upload >= 12 * 1024 * 1024 && ($post === 0 || $post >= 13 * 1024 * 1024) && ($memory === null || $memory >= 128 * 1024 * 1024),
    'sapi' => PHP_SAPI,
    'gdWebp' => $gdWebp,
    'uploadMaxBytes' => $upload,
    'postMaxBytes' => $post,
    'memoryLimitBytes' => $memory,
    'storageWritable' => $storage,
));
