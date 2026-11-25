<?php
/** Catalog image paths are relative to the site root, including on nested routes. */
function netcarNormalizeImagePath($url) {
    if (!is_string($url) || trim($url) === '') return null;
    $path = str_replace(array('\\', ' '), array('/', '%20'), trim($url));
    if (preg_match('#^(?:https?:)?//#i', $path)) return $path;
    return '/' . ltrim(preg_replace('#^(?:\./)+#', '', $path), '/');
}

// Unit-scoped quarantine, shared with React and the SEO build. Never delete
// source images: the same file may correctly belong to a different vehicle.
function netcarVehicleImageStem($value) {
    if (!is_string($value)) return '';
    $path = parse_url(str_replace('\\', '/', trim($value)), PHP_URL_PATH);
    if (!is_string($path)) return '';
    $name = strtolower(basename(rawurldecode($path)));
    $name = preg_replace('/\.(avif|webp|png|jpe?g)$/i', '', $name);
    return preg_replace('/_small$/i', '', $name);
}

// Match the live gallery before restoring a previously published cover.
function netcarRestoreVerifiedCover($vehicle) {
    $images = $vehicle['imagens_site'] ?? null;
    if (!is_array($images) || (int) ($images['tem_fotos'] ?? 0) !== 1
        || !empty($images['capa']) || !empty($images['capa_thumb']) || empty($images['galeria'])
        || !is_array($images['galeria'])) return $vehicle;
    static $covers = null;
    if ($covers === null) {
        $covers = json_decode((string) @file_get_contents(__DIR__ . '/vehicle-cover-recovery.json'), true) ?: array();
    }
    $files = $covers[(string) ($vehicle['id'] ?? '')] ?? null;
    if (!$files) return $vehicle;
    $stem = netcarVehicleImageStem($files['capa']);
    foreach ($images['galeria'] as $photo) {
        if (netcarVehicleImageStem($photo) !== $stem) continue;
        foreach ($files as $field => $filename) {
            if (empty($images[$field])) $vehicle['imagens_site'][$field] = '/imagens/veiculos_automacar/' . $filename;
        }
        break;
    }
    return $vehicle;
}

function netcarSanitizeVehicleImages($vehicle) {
    if (!is_array($vehicle)) return $vehicle;
    $vehicle = netcarRestoreVerifiedCover($vehicle);
    static $policy = null;
    if ($policy === null) {
        $policy = json_decode((string) @file_get_contents(__DIR__ . '/vehicle-image-exclusions.json'), true);
        if (!is_array($policy)) $policy = array();
    }
    $rule = $policy['vehicles'][(string) ($vehicle['id'] ?? '')] ?? null;
    if (!is_array($rule) || empty($rule['stems'])) return $vehicle;
    $stems = array_map('strtolower', $rule['stems']);
    $removed = false;
    $allowed = function ($url) use ($stems, &$removed) {
        if (is_string($url) && in_array(netcarVehicleImageStem($url), $stems, true)) {
            $removed = true;
            return false;
        }
        return true;
    };
    foreach (array('images', 'fullImages', 'fotos') as $key) {
        if (isset($vehicle[$key]) && is_array($vehicle[$key])) {
            $vehicle[$key] = array_values(array_filter($vehicle[$key], $allowed));
        }
    }
    foreach (array('thumb', 'full') as $key) {
        if (isset($vehicle['imagens'][$key]) && is_array($vehicle['imagens'][$key])) {
            $vehicle['imagens'][$key] = array_values(array_filter($vehicle['imagens'][$key], $allowed));
        }
    }
    if (isset($vehicle['imagens_site']) && is_array($vehicle['imagens_site'])) {
        if (isset($vehicle['imagens_site']['galeria']) && is_array($vehicle['imagens_site']['galeria'])) {
            $vehicle['imagens_site']['galeria'] = array_values(array_filter($vehicle['imagens_site']['galeria'], $allowed));
        }
        foreach (array('capa', 'capa_thumb', 'capa_opengraph') as $key) {
            if (isset($vehicle['imagens_site'][$key]) && !$allowed($vehicle['imagens_site'][$key])) {
                $vehicle['imagens_site'][$key] = null;
            }
        }
    }
    if (!$removed) return $vehicle;
    $remaining = array($vehicle['imagens_site']['capa'] ?? null, $vehicle['imagens_site']['capa_thumb'] ?? null, $vehicle['imagens_site']['capa_opengraph'] ?? null);
    foreach (array($vehicle['images'] ?? null, $vehicle['fullImages'] ?? null, $vehicle['fotos'] ?? null, $vehicle['imagens']['thumb'] ?? null, $vehicle['imagens']['full'] ?? null, $vehicle['imagens_site']['galeria'] ?? null) as $images) {
        if (is_array($images)) $remaining = array_merge($remaining, $images);
    }
    if (!count(array_filter($remaining, function ($url) { return is_string($url) && trim($url) !== ''; }))) {
        if (isset($vehicle['imagens_site']) && is_array($vehicle['imagens_site'])) $vehicle['imagens_site']['tem_fotos'] = 0;
        if (array_key_exists('have_galery', $vehicle)) $vehicle['have_galery'] = 0;
    }
    return $vehicle;
}
