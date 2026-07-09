<?php
/**
 * Resizer de imagens do estoque (LCP fix).
 * Uso: /img.php?src=/imagens/veiculos_automacar/FOO.png&w=1600
 * - Só serve arquivos locais em /imagens/ ou /images/ (sem traversal)
 * - Nunca faz upscale (se original <= w, serve original)
 * - WebP q82 com alpha preservado; cache em disco + headers 1 ano
 */

$src = isset($_GET['src']) ? $_GET['src'] : '';
$w   = isset($_GET['w']) ? (int) $_GET['w'] : 1600;

$w = max(200, min($w, 2400));

// Segurança: path relativo à raiz do site, sem traversal, só pastas de imagem
$src = str_replace('\\', '/', rawurldecode($src));
if ($src === '' || strpos($src, '..') !== false || $src[0] !== '/') {
    http_response_code(400);
    exit;
}
if (!preg_match('#^/(imagens|images)/#', $src)) {
    http_response_code(403);
    exit;
}
if (!preg_match('/\.(png|jpe?g|webp)$/i', $src)) {
    http_response_code(415);
    exit;
}

$docroot = rtrim($_SERVER['DOCUMENT_ROOT'], '/');
$file = realpath($docroot . $src);
if ($file === false || strpos($file, $docroot . '/') !== 0 || !is_file($file)) {
    http_response_code(404);
    exit;
}

$cacheDir = $docroot . '/cache/img';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
$cacheKey  = md5($src . '|' . $w . '|' . filemtime($file));
$cacheFile = $cacheDir . '/' . $cacheKey . '.webp';

$serve = function ($path, $type) {
    header('Content-Type: ' . $type);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: public, max-age=31536000, immutable');
    readfile($path);
    exit;
};

if (is_file($cacheFile)) {
    $serve($cacheFile, 'image/webp');
}

$info = @getimagesize($file);
if ($info === false || !function_exists('imagewebp')) {
    // Sem GD/WebP: entrega original (melhor que quebrar)
    $serve($file, $info ? $info['mime'] : 'application/octet-stream');
}

list($ow, $oh) = $info;

switch ($info[2]) {
    case IMAGETYPE_PNG:
        $img = @imagecreatefrompng($file);
        break;
    case IMAGETYPE_JPEG:
        $img = @imagecreatefromjpeg($file);
        break;
    case IMAGETYPE_WEBP:
        $img = @imagecreatefromwebp($file);
        break;
    default:
        $img = false;
}
if ($img === false) {
    $serve($file, $info['mime']);
}

// Nunca upscale: preserva nitidez do original
if ($ow > $w) {
    $nh = (int) round($oh * ($w / $ow));
    $dst = imagecreatetruecolor($w, $nh);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefill($dst, 0, 0, $transparent);
    imagecopyresampled($dst, $img, 0, 0, 0, 0, $w, $nh, $ow, $oh);
    imagedestroy($img);
    $img = $dst;
} else {
    imagealphablending($img, false);
    imagesavealpha($img, true);
}

imagewebp($img, $cacheFile, 82);
imagedestroy($img);

if (is_file($cacheFile) && filesize($cacheFile) > 0) {
    $serve($cacheFile, 'image/webp');
}

// Encode falhou: original
$serve($file, $info['mime']);
