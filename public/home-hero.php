<?php
/** Regras do banner da Home, espelhadas no seletor compartilhado do frontend. */
function netcar_home_rotation_day()
{
    static $day = null;
    if ($day !== null) return $day;

    // Converte a data civil de São Paulo em um índice igual no PHP e no browser.
    try {
        $now = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
        $day = (int) floor(($now->getTimestamp() + $now->getOffset()) / 86400);
    } catch (Exception $error) {
        $day = (int) floor((time() - 10800) / 86400);
    }
    return $day;
}

function netcar_home_hero_number($value)
{
    if (is_string($value)) $value = trim($value);
    if ((!is_int($value) && !is_float($value) && !is_string($value)) || !is_numeric($value)) {
        return null;
    }
    $number = (float) $value;
    return is_finite($number) ? $number : null;
}

function netcar_is_home_hero_candidate($vehicle)
{
    if (!is_array($vehicle)) return false;
    $id = netcar_home_hero_number($vehicle['id'] ?? null);
    $price = netcar_home_hero_number($vehicle['price'] ?? null);
    $year = netcar_home_hero_number($vehicle['year'] ?? null);
    $km = netcar_home_hero_number($vehicle['km'] ?? null);
    $images = isset($vehicle['imagens_site']) && is_array($vehicle['imagens_site'])
        ? $vehicle['imagens_site']
        : array();
    $photos = netcar_home_hero_number($images['tem_fotos'] ?? null);
    $cover = $images['capa'] ?? null;

    return $id !== null && $id > 0
        && $price !== null && $price > 100000
        && $year !== null && $year >= 2021 && floor($year) === $year
        && $km !== null && $km > 0 && $km <= 70000
        && isset($vehicle['marca']) && is_string($vehicle['marca']) && trim($vehicle['marca']) !== ''
        && isset($vehicle['modelo']) && is_string($vehicle['modelo']) && trim($vehicle['modelo']) !== ''
        && $photos !== null && $photos > 0
        && is_string($cover) && preg_match('/\.png(?:$|[?#])/i', trim($cover)) === 1;
}

function netcar_select_home_hero_vehicles($vehicles, $day)
{
    if (!is_array($vehicles)) return array();
    $seen = array();
    $candidates = array();
    foreach ($vehicles as $vehicle) {
        if (!netcar_is_home_hero_candidate($vehicle)) continue;
        $id = trim((string) $vehicle['id']);
        if (isset($seen[$id])) continue;
        $seen[$id] = true;
        $candidates[] = $vehicle;
    }
    usort($candidates, function ($left, $right) {
        $leftId = (float) $left['id'];
        $rightId = (float) $right['id'];
        if ($leftId !== $rightId) return $leftId < $rightId ? 1 : -1;
        return strcmp(trim((string) $left['id']), trim((string) $right['id']));
    });

    $count = count($candidates);
    if ($count === 0) return array();
    $offset = (((int) $day * ($count > 4 ? 4 : 1)) % $count + $count) % $count;
    $selected = array();
    for ($index = 0; $index < min(4, $count); $index++) {
        $selected[] = $candidates[($offset + $index) % $count];
    }
    return $selected;
}
