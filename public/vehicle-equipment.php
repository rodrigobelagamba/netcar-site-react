<?php
// The resolver lives in TypeScript. PHP only verifies a build snapshot against
// the current API input. Reviewed units fail closed when stale so the raw API
// cannot restore equipment denied by a unit-specific confirmation.
function netcarEquipmentScalar($value) {
    if ($value === null) return '';
    if (is_string($value) || is_int($value)) return (string) $value;
    if (is_bool($value)) return $value ? 'true' : 'false';
    if (is_float($value) && is_finite($value)) return (string) $value;
    return null;
}

function netcarEquipmentFingerprint($vehicle) {
    if (!is_array($vehicle) || !isset($vehicle['opcionais']) || !is_array($vehicle['opcionais'])) return null;
    $input = array('netcar-equipment-v1');
    foreach (array('id', 'marca', 'modelo', 'ano', 'ano_fabricacao', 'motor', 'cambio', 'lugares') as $field) {
        $value = netcarEquipmentScalar($vehicle[$field] ?? null);
        if ($value === null) return null;
        $input[] = base64_encode($value);
    }
    $options = array();
    foreach ($vehicle['opcionais'] as $optional) {
        if (is_string($optional)) $options[] = array('s', base64_encode($optional));
        elseif (is_array($optional)) {
            $fields = array('o');
            foreach (array('tag', 'descricao', 'nome') as $key) {
                $value = netcarEquipmentScalar($optional[$key] ?? null);
                if ($value === null) return null;
                $fields[] = base64_encode($value);
            }
            $options[] = $fields;
        } else return null;
    }
    $input[] = $options;
    $json = json_encode($input, JSON_UNESCAPED_SLASHES);
    return $json === false ? null : hash('sha256', $json);
}

function netcarRawEquipmentDescriptions($vehicle) {
    $descriptions = array();
    if (!is_array($vehicle) || !isset($vehicle['opcionais']) || !is_array($vehicle['opcionais'])) return $descriptions;
    foreach ($vehicle['opcionais'] as $optional) {
        $raw = is_array($optional)
            ? (isset($optional['descricao']) && $optional['descricao'] !== '' ? $optional['descricao'] : ($optional['nome'] ?? ''))
            : $optional;
        if (!is_string($raw)) continue;
        // Formatting cleanup and exact deduplication only. No aliases, ranking,
        // feature additions or model/year guesses in the fallback path.
        $description = trim(ltrim(trim($raw), '.'));
        if ($description !== '' && !in_array($description, $descriptions, true)) $descriptions[] = $description;
    }
    return $descriptions;
}

function netcarEquipmentDescriptions($vehicle, $manifestFile = null) {
    if (!is_array($vehicle)) return array();
    $file = $manifestFile === null ? __DIR__ . '/seo/vehicle-equipment.json' : $manifestFile;
    // Without a valid reviewed-ID list, no raw fallback is safe: even a missing
    // build artifact must not silently reintroduce a known incorrect claim.
    if (!is_readable($file)) return array();
    $manifest = json_decode((string) @file_get_contents($file), true);
    if (!is_array($manifest) || ($manifest['schemaVersion'] ?? null) !== 2 || !is_array($manifest['vehicles'] ?? null) || !is_array($manifest['confirmedVehicleIds'] ?? null)) return array();
    foreach ($manifest['confirmedVehicleIds'] as $confirmedId) {
        if (!is_string($confirmedId) || !preg_match('/^\d+$/', $confirmedId)) return array();
    }
    $id = netcarEquipmentScalar($vehicle['id'] ?? null);
    if ($id === null || !preg_match('/^\d+$/', $id)) return array();
    $fallback = in_array($id, $manifest['confirmedVehicleIds'], true)
        ? array()
        : netcarRawEquipmentDescriptions($vehicle);
    $fingerprint = netcarEquipmentFingerprint($vehicle);
    if ($fingerprint === null) return $fallback;
    $entry = $manifest['vehicles'][$id] ?? null;
    if (!is_array($entry) || !is_string($entry['fingerprint'] ?? null) || !hash_equals($fingerprint, $entry['fingerprint'])) return $fallback;
    if (!isset($entry['descriptions']) || !is_array($entry['descriptions'])) return $fallback;
    foreach ($entry['descriptions'] as $description) {
        if (!is_string($description) || trim($description) === '') return $fallback;
    }
    return array_values($entry['descriptions']);
}
