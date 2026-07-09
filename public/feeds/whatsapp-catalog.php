<?php
/**
 * Feed ao vivo do estoque Netcar → Meta Commerce / WhatsApp Catalog.
 *
 * Lê a API JSON do site na hora (não precisa rebuild nem copiar XML na mão).
 *
 * URLs:
 *   /feeds/whatsapp-catalog.php          → CSV (padrão)
 *   /feeds/whatsapp-catalog.php?format=csv
 *   /feeds/whatsapp-catalog.php?format=xml
 *
 * Atalhos (via .htaccess):
 *   /feeds/whatsapp-catalog.csv
 *   /feeds/whatsapp-catalog.xml
 */

declare(strict_types=1);

const NETCAR_SITE_URL = 'https://www.netcarmultimarcas.com.br';
const NETCAR_API_URL = NETCAR_SITE_URL . '/api/v1/veiculos.php?limit=500';
const NETCAR_HTTP_TIMEOUT = 20;
const NETCAR_CACHE_TTL = 300; // 5 min — Meta pode puxar com frequência
const NETCAR_CACHE_DIR = __DIR__ . '/.cache';

header('X-Robots-Tag: noindex');

$format = strtolower((string) ($_GET['format'] ?? 'csv'));
if (!in_array($format, ['csv', 'xml'], true)) {
    $format = 'csv';
}

try {
    $vehicles = netcar_fetch_vehicles();
    $rows = [];
    foreach ($vehicles as $vehicle) {
        if (!is_array($vehicle)) {
            continue;
        }
        $row = netcar_to_catalog_row($vehicle);
        if ($row !== null) {
            $rows[] = $row;
        }
    }

    if ($format === 'xml') {
        header('Content-Type: application/xml; charset=UTF-8');
        header('Content-Disposition: inline; filename="whatsapp-catalog.xml"');
        echo netcar_rows_to_xml($rows);
    } else {
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: inline; filename="whatsapp-catalog.csv"');
        echo netcar_rows_to_csv($rows);
    }
} catch (Throwable $e) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Feed indisponível: ' . $e->getMessage();
}

function netcar_fetch_vehicles(): array
{
    if (!is_dir(NETCAR_CACHE_DIR)) {
        @mkdir(NETCAR_CACHE_DIR, 0755, true);
    }

    $cacheFile = NETCAR_CACHE_DIR . '/veiculos.json';
    if (is_readable($cacheFile) && (time() - filemtime($cacheFile)) < NETCAR_CACHE_TTL) {
        $cached = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($cached) && !empty($cached['data']) && is_array($cached['data'])) {
            return $cached['data'];
        }
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => NETCAR_HTTP_TIMEOUT,
            'header' => "Accept: application/json\r\n",
        ],
    ]);

    $raw = @file_get_contents(NETCAR_API_URL, false, $ctx);
    if ($raw === false || $raw === '') {
        throw new RuntimeException('Falha ao ler API de veículos');
    }

    $json = json_decode($raw, true);
    if (!is_array($json) || empty($json['success']) || !isset($json['data']) || !is_array($json['data'])) {
        throw new RuntimeException('Resposta da API inválida');
    }

    @file_put_contents($cacheFile, $raw);
    return $json['data'];
}

function netcar_is_available(array $v): bool
{
    if ((float) ($v['valor'] ?? 0) <= 0) {
        return false;
    }
    $fmt = strtolower(trim((string) ($v['valor_formatado'] ?? '')));
    return $fmt !== 'vendido';
}

function netcar_mask_plate(string $placa): string
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

function netcar_slugify_modelo(string $modelo, string $marca): string
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

function netcar_generate_slug(array $v): string
{
    $parts = [];
    $modelo = (string) ($v['modelo'] ?? '');
    $marca = (string) ($v['marca'] ?? '');
    if ($modelo !== '') {
        $slug = netcar_slugify_modelo($modelo, $marca);
        if ($slug !== '') {
            $parts[] = $slug;
        }
    }
    if (!empty($v['ano'])) {
        $parts[] = (string) $v['ano'];
    }
    if (!empty($v['placa'])) {
        $parts[] = netcar_mask_plate((string) $v['placa']);
    }
    $parts[] = (string) ($v['id'] ?? '');
    return implode('-', $parts);
}

function netcar_encode_url_path(string $absoluteUrl): string
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

function netcar_normalize_image_url(?string $url): string
{
    if ($url === null || trim($url) === '') {
        return '';
    }
    $normalized = str_replace('\\', '/', trim($url));
    $normalized = preg_replace('#^\./+#', '', $normalized) ?? $normalized;
    if ($normalized === '') {
        return '';
    }

    if (preg_match('#^https?://#i', $normalized)) {
        $absolute = $normalized;
    } elseif (str_starts_with($normalized, '/')) {
        $absolute = NETCAR_SITE_URL . $normalized;
    } else {
        $absolute = NETCAR_SITE_URL . '/' . $normalized;
    }

    return netcar_encode_url_path($absolute);
}

function netcar_is_meta_friendly_image(string $url): bool
{
    $path = strtolower(explode('?', $url, 2)[0]);
    return (bool) preg_match('/\.(jpe?g|png|gif)$/', $path);
}

function netcar_collect_images(array $v): array
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

    $friendly = [];
    $fallback = [];
    foreach ($candidates as $candidate) {
        $absolute = netcar_normalize_image_url(is_string($candidate) ? $candidate : null);
        if ($absolute === '') {
            continue;
        }
        if (netcar_is_meta_friendly_image($absolute)) {
            if (!in_array($absolute, $friendly, true)) {
                $friendly[] = $absolute;
            }
        } elseif (!in_array($absolute, $fallback, true)) {
            $fallback[] = $absolute;
        }
    }

    $urls = [];
    foreach (array_merge($friendly, $fallback) as $absolute) {
        if (!in_array($absolute, $urls, true)) {
            $urls[] = $absolute;
        }
        if (count($urls) >= 10) {
            break;
        }
    }
    return $urls;
}

function netcar_format_price($valor): string
{
    $n = (float) $valor;
    if ($n <= 0) {
        return '';
    }
    return number_format($n, 2, '.', '') . ' BRL';
}

function netcar_build_title(array $v): string
{
    $parts = [];
    foreach (['marca', 'modelo', 'ano'] as $key) {
        if (isset($v[$key]) && trim((string) $v[$key]) !== '') {
            $parts[] = trim((string) $v[$key]);
        }
    }
    return preg_replace('/\s+/', ' ', implode(' ', $parts)) ?? '';
}

function netcar_build_description(array $v): string
{
    $bits = [];
    $km = isset($v['km']) ? (int) $v['km'] : -1;
    if ($km >= 0) {
        $bits[] = number_format($km, 0, ',', '.') . ' km';
    }
    if (!empty($v['motor'])) {
        $bits[] = 'Motor ' . trim((string) $v['motor']);
    }
    if (!empty($v['cambio'])) {
        $bits[] = trim((string) $v['cambio']);
    }
    if (!empty($v['combustivel'])) {
        $bits[] = trim((string) $v['combustivel']);
    }
    if (!empty($v['cor'])) {
        $bits[] = 'Cor ' . trim((string) $v['cor']);
    }

    $base = 'Seminovo vistoriado na Netcar Multimarcas (Esteio/RS). Financiamento e avaliação na troca.';
    if ($bits === []) {
        return $base;
    }
    return implode(' · ', $bits) . '. ' . $base;
}

function netcar_to_catalog_row(array $v): ?array
{
    if (!netcar_is_available($v)) {
        return null;
    }

    $title = netcar_build_title($v);
    $description = netcar_build_description($v);
    $price = netcar_format_price($v['valor'] ?? 0);
    $images = netcar_collect_images($v);
    $imageLink = $images[0] ?? '';

    if ($title === '' || $description === '' || $price === '' || $imageLink === '') {
        return null;
    }

    $additional = array_slice($images, 1, 9);

    return [
        'id' => (string) ($v['id'] ?? ''),
        'title' => $title,
        'description' => $description,
        'availability' => 'in stock',
        'condition' => 'used',
        'price' => $price,
        'link' => NETCAR_SITE_URL . '/veiculo/' . netcar_generate_slug($v),
        'image_link' => $imageLink,
        'brand' => trim((string) ($v['marca'] ?? '')),
        'additional_image_link' => implode(',', $additional),
    ];
}

function netcar_escape_csv($value): string
{
    $str = (string) $value;
    if (preg_match('/[",\n\r]/', $str)) {
        return '"' . str_replace('"', '""', $str) . '"';
    }
    return $str;
}

function netcar_rows_to_csv(array $rows): string
{
    $headers = [
        'id',
        'title',
        'description',
        'availability',
        'condition',
        'price',
        'link',
        'image_link',
        'brand',
        'additional_image_link',
    ];
    $lines = [implode(',', $headers)];
    foreach ($rows as $row) {
        $cells = [];
        foreach ($headers as $key) {
            $cells[] = netcar_escape_csv($row[$key] ?? '');
        }
        $lines[] = implode(',', $cells);
    }
    return implode("\n", $lines) . "\n";
}

function netcar_escape_xml($value): string
{
    return htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function netcar_rows_to_xml(array $rows): string
{
    $items = '';
    foreach ($rows as $row) {
        $extra = '';
        $adds = array_filter(array_map('trim', explode(',', (string) ($row['additional_image_link'] ?? ''))));
        foreach ($adds as $url) {
            $extra .= '      <g:additional_image_link>' . netcar_escape_xml($url) . "</g:additional_image_link>\n";
        }
        $items .= "    <item>\n";
        $items .= '      <g:id>' . netcar_escape_xml($row['id']) . "</g:id>\n";
        $items .= '      <g:title>' . netcar_escape_xml($row['title']) . "</g:title>\n";
        $items .= '      <g:description>' . netcar_escape_xml($row['description']) . "</g:description>\n";
        $items .= '      <g:availability>' . netcar_escape_xml($row['availability']) . "</g:availability>\n";
        $items .= '      <g:condition>' . netcar_escape_xml($row['condition']) . "</g:condition>\n";
        $items .= '      <g:price>' . netcar_escape_xml($row['price']) . "</g:price>\n";
        $items .= '      <g:link>' . netcar_escape_xml($row['link']) . "</g:link>\n";
        $items .= '      <g:image_link>' . netcar_escape_xml($row['image_link']) . "</g:image_link>\n";
        $items .= '      <g:brand>' . netcar_escape_xml($row['brand']) . "</g:brand>\n";
        $items .= $extra;
        $items .= "    </item>\n";
    }

    return '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">' . "\n"
        . "  <channel>\n"
        . "    <title>Netcar Seminovos</title>\n"
        . '    <link>' . netcar_escape_xml(NETCAR_SITE_URL) . "</link>\n"
        . "    <description>Estoque de seminovos Netcar Multimarcas para WhatsApp Catalog</description>\n"
        . $items
        . "  </channel>\n"
        . "</rss>\n";
}
