<?php
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

function netcarSanitizeVehicleImages($vehicle) {
    if (!is_array($vehicle)) return $vehicle;
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
