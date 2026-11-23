<?php
/**
 * Feed ao vivo do estoque Netcar → Google Merchant Center (Vehicle Ads).
 *
 * Lê a API JSON do site na hora com cache de 5 minutos (mesmo padrão de whatsapp-catalog.php).
 * Exclui veículos vendidos (valor <= 0) e anúncios sem foto real.
 *
 * URLs:
 *   /feeds/google-vehicle-ads.tsv           → Feed primário de veículos (TSV)
 *   /feeds/google-vehicle-stores.tsv        → POS Store Feed das lojas físicas (TSV)
 *   /feeds/google-vehicle-ads.php?store_code=netcar_loja_1
 */

declare(strict_types=1);

const NETCAR_VLA_SITE_URL = 'https://www.netcarmultimarcas.com.br';
const NETCAR_VLA_API_URL = NETCAR_VLA_SITE_URL . '/api/v1/veiculos.php?limit=500';
const NETCAR_VLA_HTTP_TIMEOUT = 20;
const NETCAR_VLA_CACHE_TTL = 300;
const NETCAR_VLA_CACHE_DIR = __DIR__ . '/.cache';
const NETCAR_VLA_DEFAULT_STORE_CODE = 'netcar_loja_1';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: public, max-age=300');

$type = strtolower(trim((string) ($_GET['type'] ?? 'vehicles')));
$storeCode = netcar_vla_resolve_store_code((string) ($_GET['store_code'] ?? NETCAR_VLA_DEFAULT_STORE_CODE));

if ($type === 'store' || $type === 'stores') {
    header('Content-Type: text/tab-separated-values; charset=UTF-8');
    header('Content-Disposition: inline; filename="google-vehicle-stores.tsv"');
    echo netcar_vla_store_feed_tsv($storeCode);
    exit;
}

try {
    $vehicles = netcar_vla_fetch_vehicles();
    $rows = [];
    foreach ($vehicles as $vehicle) {
        if (!is_array($vehicle)) {
            continue;
        }
        $row = netcar_vla_to_row($vehicle, $storeCode);
        if ($row !== null) {
            $rows[] = $row;
        }
    }

    header('Content-Type: text/tab-separated-values; charset=UTF-8');
    header('Content-Disposition: inline; filename="google-vehicle-ads.tsv"');
    echo netcar_vla_rows_to_tsv($rows);
} catch (Throwable $e) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Feed indisponível: ' . $e->getMessage();
}

function netcar_vla_resolve_store_code(string $raw): string
{
    $clean = trim($raw);
    if ($clean !== '' && preg_match('/^[A-Za-z0-9_-]{1,64}$/', $clean)) {
        return $clean;
    }
    return NETCAR_VLA_DEFAULT_STORE_CODE;
}

function netcar_vla_fetch_vehicles(): array
{
    if (!is_dir(NETCAR_VLA_CACHE_DIR)) {
        @mkdir(NETCAR_VLA_CACHE_DIR, 0755, true);
    }

    $cacheFile = NETCAR_VLA_CACHE_DIR . '/veiculos.json';
    if (is_readable($cacheFile) && (time() - filemtime($cacheFile)) < NETCAR_VLA_CACHE_TTL) {
        $cached = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($cached) && !empty($cached['data']) && is_array($cached['data'])) {
            return $cached['data'];
        }
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => NETCAR_VLA_HTTP_TIMEOUT,
            'header' => "Accept: application/json\r\n",
        ],
    ]);

    $raw = @file_get_contents(NETCAR_VLA_API_URL, false, $ctx);
    if ($raw === false || $raw === '') {
        throw new RuntimeException('Falha ao ler API de veículos');
    }

    $json = json_decode($raw, true);
    if (!is_array($json) || empty($json['success']) || !isset($json['data']) || !is_array($json['data'])) {
        throw new RuntimeException('Resposta da API inválida');
    }

    @file_put_contents($cacheFile, $raw, LOCK_EX);
    return $json['data'];
}

function netcar_vla_is_available(array $v): bool
{
    if ((float) ($v['valor'] ?? 0) <= 0) {
        return false;
    }
    $fmt = strtolower(trim((string) ($v['valor_formatado'] ?? '')));
    return $fmt !== 'vendido';
}

function netcar_vla_mask_plate(string $placa): string
{
    $clean = strtoupper(str_replace([' ', '-'], '', $placa));
    if (strlen($clean) < 5) {
        return strtolower($clean);
    }
    $prefix = strtolower(substr($clean, 0, 3));
    preg_match_all('/\d/', $clean, $m);
    $digits = $m[0] ?? [];
    $suffix = count($digits) >= 2
        ? $digits[count($digits) - 2] . $digits[count($digits) - 1]
        : substr($clean, -2);
    return $prefix . '-xx' . $suffix;
}

function netcar_vla_slugify_modelo(string $modelo, string $marca): string
{
    $modelo = trim($modelo);
    if ($marca !== '' && stripos($modelo, $marca) === 0) {
        $modelo = trim(substr($modelo, strlen($marca)));
    }
    $modelo = mb_strtolower($modelo, 'UTF-8');
    $modelo = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $modelo) ?: $modelo;
    $modelo = preg_replace('/[^a-z0-9\s-]/', '', $modelo) ?? '';
    $modelo = preg_replace('/\s+/', '-', $modelo) ?? '';
    $modelo = preg_replace('/-+/', '-', $modelo) ?? '';
    return trim($modelo, '-');
}

function netcar_vla_generate_slug(array $v): string
{
    $parts = [];
    $modelo = (string) ($v['modelo'] ?? '');
    $marca = (string) ($v['marca'] ?? '');
    if ($modelo !== '') {
        $slug = netcar_vla_slugify_modelo($modelo, $marca);
        if ($slug !== '') {
            $parts[] = $slug;
        }
    }
    if (!empty($v['ano'])) {
        $parts[] = (string) $v['ano'];
    }
    if (!empty($v['placa'])) {
        $parts[] = netcar_vla_mask_plate((string) $v['placa']);
    }
    $parts[] = (string) ($v['id'] ?? '');
    return implode('-', $parts);
}

function netcar_vla_encode_url_path(string $absoluteUrl): string
{
    $parts = parse_url($absoluteUrl);
    if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
        return str_replace(' ', '%20', $absoluteUrl);
    }
    $path = $parts['path'] ?? '/';
    $segments = explode('/', $path);
    $encoded = array_map(static function ($segment) {
        if ($segment === '') {
            return '';
        }
        return rawurlencode(rawurldecode($segment));
    }, $segments);
    $out = $parts['scheme'] . '://' . $parts['host'];
    if (!empty($parts['port'])) {
        $out .= ':' . $parts['port'];
    }
    $out .= implode('/', $encoded);
    if (!empty($parts['query'])) {
        $out .= '?' . $parts['query'];
    }
    return $out;
}

function netcar_vla_normalize_image_url(?string $url): string
{
    if ($url === null || trim($url) === '') {
        return '';
    }
    $normalized = str_replace('\\', '/', trim($url));
    $normalized = preg_replace('#^\./+#', '', $normalized) ?? $normalized;
    if ($normalized === '' || stripos($normalized, 'CarroSemFoto') !== false) {
        return '';
    }

    if (preg_match('#^https?://#i', $normalized)) {
        $absolute = $normalized;
    } elseif (isset($normalized[0]) && $normalized[0] === '/') {
        $absolute = NETCAR_VLA_SITE_URL . $normalized;
    } else {
        $absolute = NETCAR_VLA_SITE_URL . '/' . $normalized;
    }

    return netcar_vla_encode_url_path($absolute);
}

function netcar_vla_is_google_image(string $url): bool
{
    $path = strtolower(explode('?', $url, 2)[0]);
    return (bool) preg_match('/\.(jpe?g|png|webp|gif)$/', $path);
}

function netcar_vla_collect_images(array $v): array
{
    $site = is_array($v['imagens_site'] ?? null) ? $v['imagens_site'] : [];
    $imagens = is_array($v['imagens'] ?? null) ? $v['imagens'] : [];

    $candidates = [];
    foreach (['capa', 'capa_opengraph'] as $key) {
        if (!empty($site[$key])) {
            $candidates[] = $site[$key];
        }
    }
    foreach (['full', 'thumb'] as $key) {
        if (!empty($imagens[$key]) && is_array($imagens[$key])) {
            foreach ($imagens[$key] as $img) {
                $candidates[] = $img;
            }
        }
    }
    if (!empty($site['galeria']) && is_array($site['galeria'])) {
        foreach ($site['galeria'] as $img) {
            $candidates[] = $img;
        }
    }

    $urls = [];
    foreach ($candidates as $candidate) {
        $absolute = netcar_vla_normalize_image_url(is_string($candidate) ? $candidate : null);
        if ($absolute === '' || !netcar_vla_is_google_image($absolute)) {
            continue;
        }
        if (!in_array($absolute, $urls, true)) {
            $urls[] = $absolute;
        }
        if (count($urls) >= 6) {
            break;
        }
    }
    return $urls;
}

function netcar_vla_normalize_transmission(string $raw): string
{
    $low = mb_strtolower(trim($raw), 'UTF-8');
    if (preg_match('/auto|cvt|dsg|tiptronic|powershift|dct|at\b/', $low)) {
        return 'Automatic';
    }
    return 'Manual';
}

function netcar_vla_normalize_fuel(string $raw): string
{
    $low = mb_strtolower(trim($raw), 'UTF-8');
    if (strpos($low, 'hibrid') !== false || strpos($low, 'híbrid') !== false) {
        return 'Hybrid';
    }
    if (strpos($low, 'eletr') !== false || strpos($low, 'elétr') !== false) {
        return 'Electric';
    }
    if (strpos($low, 'diesel') !== false) {
        return 'Diesel';
    }
    if (strpos($low, 'flex') !== false) {
        return 'Flex Fuel';
    }
    return 'Gasoline';
}

function netcar_vla_normalize_body_style(string $raw): string
{
    $low = mb_strtolower(trim($raw), 'UTF-8');
    if (strpos($low, 'suv') !== false) {
        return 'SUV';
    }
    if (strpos($low, 'sedan') !== false || strpos($low, 'sedã') !== false) {
        return 'Sedan';
    }
    if (strpos($low, 'hatch') !== false) {
        return 'Hatchback';
    }
    if (strpos($low, 'picape') !== false || strpos($low, 'pickup') !== false || strpos($low, 'caminhonete') !== false) {
        return 'Truck';
    }
    if (strpos($low, 'van') !== false || strpos($low, 'minivan') !== false) {
        return 'Minivan';
    }
    return '';
}

function netcar_vla_to_row(array $v, string $storeCode): ?array
{
    if (!netcar_vla_is_available($v)) {
        return null;
    }

    $id = trim((string) ($v['id'] ?? ''));
    $brand = trim((string) ($v['marca'] ?? ''));
    $model = trim((string) ($v['modelo'] ?? ''));
    $year = preg_replace('/[^\d]/', '', (string) ($v['ano'] ?? '')) ?? '';
    $year = substr($year, 0, 4);
    $priceNum = (float) ($v['valor'] ?? 0);
    $images = netcar_vla_collect_images($v);

    if ($id === '' || $brand === '' || $model === '' || strlen($year) !== 4 || $priceNum <= 0 || $images === []) {
        return null;
    }

    $km = max(0, (int) ($v['km'] ?? 0));
    $color = trim((string) ($v['cor'] ?? ''));
    $transmission = netcar_vla_normalize_transmission((string) ($v['cambio'] ?? ''));
    $fuel = netcar_vla_normalize_fuel((string) ($v['combustivel'] ?? ''));
    $bodyStyle = netcar_vla_normalize_body_style((string) ($v['categoria'] ?? ''));
    $link = NETCAR_VLA_SITE_URL . '/veiculo/' . netcar_vla_generate_slug($v);
    $title = preg_replace('/\s+/', ' ', trim($year . ' ' . $brand . ' ' . $model)) ?? '';

    $descParts = [
        "{$brand} {$model} {$year} disponível na Netcar Multimarcas em Esteio/RS (Grande Porto Alegre).",
        'Quilometragem: ' . number_format($km, 0, ',', '.') . ' km.',
    ];
    if (!empty($v['cambio'])) {
        $descParts[] = 'Câmbio: ' . trim((string) $v['cambio']) . '.';
    }
    if (!empty($v['combustivel'])) {
        $descParts[] = 'Combustível: ' . trim((string) $v['combustivel']) . '.';
    }
    $descParts[] = 'Seminovo vistoriado sem passagem por locadora ou leilão. Consulte fotos, troca e financiamento.';

    return [
        'id' => $id,
        'store_code' => $storeCode,
        'google_product_category' => '916',
        'vehicle_fulfillment' => 'in_store:' . $storeCode,
        'title' => mb_substr($title, 0, 150, 'UTF-8'),
        'description' => mb_substr(implode(' ', $descParts), 0, 500, 'UTF-8'),
        'link' => $link,
        'link_template' => $link . '?store={store_code}',
        'image_link' => $images[0],
        'additional_image_link' => implode(',', array_slice($images, 1, 5)),
        'price' => number_format($priceNum, 2, '.', '') . ' BRL',
        'condition' => 'used',
        'brand' => $brand,
        'make' => $brand,
        'model' => $model,
        'year' => $year,
        'mileage' => $km . ' km',
        'color' => mb_substr($color, 0, 40, 'UTF-8'),
        'transmission' => $transmission,
        'fuel_type' => $fuel,
        'body_style' => $bodyStyle,
        'availability' => 'in_stock',
    ];
}

function netcar_vla_escape_tsv($value): string
{
    $str = (string) $value;
    return trim(str_replace(["\t", "\r", "\n"], ' ', $str));
}

function netcar_vla_rows_to_tsv(array $rows): string
{
    $headers = [
        'id',
        'store_code',
        'google_product_category',
        'vehicle_fulfillment',
        'title',
        'description',
        'link',
        'link_template',
        'image_link',
        'additional_image_link',
        'price',
        'condition',
        'brand',
        'make',
        'model',
        'year',
        'mileage',
        'color',
        'transmission',
        'fuel_type',
        'body_style',
        'availability',
    ];

    $lines = [implode("\t", $headers)];
    foreach ($rows as $row) {
        $cells = [];
        foreach ($headers as $key) {
            $cells[] = netcar_vla_escape_tsv($row[$key] ?? '');
        }
        $lines[] = implode("\t", $cells);
    }
    return implode("\n", $lines) . "\n";
}

function netcar_vla_store_feed_tsv(string $primaryStoreCode): string
{
    $headers = ['store_code', 'store_address', 'store_name', 'phone_number', 'website_url'];
    $stores = [
        [
            'store_code' => $primaryStoreCode,
            'store_address' => 'Av. Presidente Vargas, 740, Centro, Esteio, RS, 93260-490, Brazil',
            'store_name' => 'Netcar Multimarcas',
            'phone_number' => '+555134737900',
            'website_url' => NETCAR_VLA_SITE_URL,
        ],
        [
            'store_code' => 'netcar_loja_2',
            'store_address' => 'Av. Presidente Vargas, 1106, Centro, Esteio, RS, 93260-048, Brazil',
            'store_name' => 'Netcar Multimarcas - Loja 2',
            'phone_number' => '+555130333900',
            'website_url' => NETCAR_VLA_SITE_URL,
        ],
    ];

    $lines = [implode("\t", $headers)];
    foreach ($stores as $store) {
        $cells = [];
        foreach ($headers as $key) {
            $cells[] = netcar_vla_escape_tsv($store[$key] ?? '');
        }
        $lines[] = implode("\t", $cells);
    }
    return implode("\n", $lines) . "\n";
}
