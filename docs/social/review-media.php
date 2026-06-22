<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$id = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['id'] ?? ''));
if ($id === '') {
    http_response_code(400);
    exit('Missing id');
}

$path = SocialEnv::dataDir() . '/media/reviews/' . $id . '.jpg';
if (!is_file($path)) {
    http_response_code(404);
    exit('Not found');
}

header('Content-Type: image/jpeg');
header('Cache-Control: public, max-age=86400');
readfile($path);
