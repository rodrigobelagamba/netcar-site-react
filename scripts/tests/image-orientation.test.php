<?php
// Run with PHP 7.4+, GD/WebP and EXIF: php scripts/tests/image-orientation.test.php
// Exercises the real endpoint in subprocesses, using generated asymmetric JPEGs.
$checks = 0;
function check_orientation($value, $message)
{
    global $checks;
    $checks++;
    if (!$value) {
        throw new RuntimeException('FAIL: ' . $message);
    }
}

foreach (array('imagejpeg', 'imagewebp', 'imageflip', 'imagerotate', 'exif_read_data', 'proc_open') as $required) {
    check_orientation(function_exists($required), $required . ' available');
}
$endpoint = realpath(__DIR__ . '/../../public/img.php');
token_get_all(file_get_contents($endpoint), TOKEN_PARSE);
$temp = sys_get_temp_dir() . '/netcar-image-orientation-' . bin2hex(random_bytes(6));
mkdir($temp . '/imagens', 0700, true);

function request_orientation_image($source, $width = 200, $orientation = '1', $disabled = '')
{
    global $temp, $endpoint;
    $query = array('src' => $source, 'w' => $width);
    if ($orientation !== null) {
        $query['orient'] = $orientation;
    }
    $code = 'parse_str($argv[1], $_GET); $_SERVER["DOCUMENT_ROOT"] = $argv[2]; require $argv[3];';
    $process = proc_open(array(PHP_BINARY, '-d', 'display_errors=stderr', '-d', 'disable_functions=' . $disabled,
        '-r', $code, http_build_query($query), $temp, $endpoint),
        array(0 => array('pipe', 'r'), 1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes);
    check_orientation(is_resource($process), 'endpoint subprocess starts');
    fclose($pipes[0]);
    $bytes = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $status = proc_close($process);
    check_orientation($status === 0 && $errors === '', 'endpoint succeeds without warnings: ' . $errors);
    return $bytes;
}

function verify_orientation_pixels($bytes, $width, $height, $expected, $label)
{
    global $colors;
    $info = getimagesizefromstring($bytes);
    check_orientation($info !== false && $info[0] === $width && $info[1] === $height, $label . ' dimensions');
    check_orientation($info[2] === IMAGETYPE_WEBP, $label . ' optimized to WebP');
    $image = imagecreatefromstring($bytes);
    $actual = array();
    foreach (array(array(.25, .25), array(.75, .25), array(.25, .75), array(.75, .75)) as $point) {
        $pixel = imagecolorat($image, (int) ($width * $point[0]), (int) ($height * $point[1]));
        $rgb = array(($pixel >> 16) & 255, ($pixel >> 8) & 255, $pixel & 255);
        $closest = null;
        $distance = INF;
        foreach ($colors as $name => $color) {
            $candidate = ($rgb[0] - $color[0]) ** 2 + ($rgb[1] - $color[1]) ** 2 + ($rgb[2] - $color[2]) ** 2;
            if ($candidate < $distance) {
                $closest = $name;
                $distance = $candidate;
            }
        }
        $actual[] = $closest;
    }
    imagedestroy($image);
    check_orientation($actual === $expected, $label . ' corner positions');
}

function remove_orientation_test_directory($path)
{
    foreach (scandir($path) as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $child = $path . '/' . $item;
        is_dir($child) ? remove_orientation_test_directory($child) : unlink($child);
    }
    rmdir($path);
}

try {
    $colors = array('R' => array(230, 40, 35), 'G' => array(30, 200, 70),
        'B' => array(30, 70, 220), 'Y' => array(240, 210, 30));
    $fixture = imagecreatetruecolor(600, 400);
    $index = 0;
    foreach ($colors as $color) {
        $x = ($index % 2) * 300;
        $y = (int) floor($index / 2) * 200;
        imagefilledrectangle($fixture, $x, $y, $x + 299, $y + 199,
            imagecolorallocate($fixture, $color[0], $color[1], $color[2]));
        $index++;
    }
    ob_start();
    imagejpeg($fixture, null, 100);
    $jpeg = ob_get_clean();
    imagepng($fixture, $temp . '/imagens/plain.png');
    imagedestroy($fixture);

    // Literal corner expectations are independent of the endpoint's operations.
    $corners = array(1 => 'RGBY', 2 => 'GRYB', 3 => 'YBGR', 4 => 'BYRG',
        5 => 'RBGY', 6 => 'BRYG', 7 => 'YGBR', 8 => 'GYRB');
    for ($orientation = 1; $orientation <= 9; $orientation++) {
        $exif = "Exif\0\0II" . pack('vVv', 42, 8, 1)
            . pack('vvVv', 0x0112, 3, 1, $orientation) . "\0\0" . pack('V', 0);
        $bytes = substr($jpeg, 0, 2) . "\xff\xe1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2);
        file_put_contents($temp . '/imagens/orientation-' . $orientation . '.jpg', $bytes);
    }

    // Warm the legacy cache first: opt-in requests must never use its sideways pixels.
    $legacy = request_orientation_image('/imagens/orientation-6.jpg', 200, null);
    verify_orientation_pixels($legacy, 200, 133, str_split($corners[1]), 'legacy request');
    $legacyKey = md5('/imagens/orientation-6.jpg|200|q74|' . filemtime($temp . '/imagens/orientation-6.jpg'));
    check_orientation(is_file($temp . '/cache/img/' . $legacyKey . '.webp'), 'legacy cache key retained');

    for ($orientation = 1; $orientation <= 8; $orientation++) {
        $output = request_orientation_image('/imagens/orientation-' . $orientation . '.jpg');
        verify_orientation_pixels($output, 200, $orientation >= 5 ? 300 : 133,
            str_split($corners[$orientation]), 'EXIF ' . $orientation);
    }
    $oriented = request_orientation_image('/imagens/orientation-6.jpg');
    check_orientation($oriented !== $legacy, 'oriented and legacy caches are distinct');
    check_orientation(request_orientation_image('/imagens/orientation-6.jpg', 200, null) === $legacy,
        'oriented requests do not change legacy response');
    check_orientation(request_orientation_image('/imagens/orientation-6.jpg', 200, '0') === $legacy,
        'orient=0 keeps legacy behavior');
    verify_orientation_pixels(request_orientation_image('/imagens/orientation-6.jpg', 800), 400, 600,
        str_split($corners[6]), 'portrait is never upscaled');

    foreach (array('exif_read_data', 'imagerotate', 'imagewebp') as $disabled) {
        // A fresh width avoids existing caches and exercises missing capability fallbacks.
        $source = '/imagens/orientation-6.jpg';
        check_orientation(request_orientation_image($source, 333, '1', $disabled) === file_get_contents($temp . $source),
            'missing ' . $disabled . ' preserves original JPEG with EXIF');
    }
    $mirrored = '/imagens/orientation-5.jpg';
    check_orientation(request_orientation_image($mirrored, 333, '1', 'imageflip') === file_get_contents($temp . $mirrored),
        'missing imageflip preserves original mirrored JPEG');
    $invalid = '/imagens/orientation-9.jpg';
    check_orientation(request_orientation_image($invalid) === file_get_contents($temp . $invalid),
        'invalid EXIF orientation preserves original');
    verify_orientation_pixels(request_orientation_image('/imagens/plain.png', 200, '1', 'exif_read_data'),
        200, 133, str_split($corners[1]), 'PNG does not require EXIF');
    echo 'PASS: ' . $checks . " image orientation checks\n";
} finally {
    remove_orientation_test_directory($temp);
}
