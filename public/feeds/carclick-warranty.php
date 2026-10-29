<?php
/** Text-only PHP7 runtime guard over a projection of the canonical TS resolver. */
function netcar_carclick_warranty_normalize($value)
{
    if (!is_string($value)) return '';
    $value = strtr($value, array('á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','Á'=>'A','À'=>'A','Â'=>'A','Ã'=>'A','Ä'=>'A','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','É'=>'E','È'=>'E','Ê'=>'E','Ë'=>'E','í'=>'i','ì'=>'i','î'=>'i','ï'=>'i','Í'=>'I','Ì'=>'I','Î'=>'I','Ï'=>'I','ó'=>'o','ò'=>'o','ô'=>'o','õ'=>'o','ö'=>'o','Ó'=>'O','Ò'=>'O','Ô'=>'O','Õ'=>'O','Ö'=>'O','ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u','Ú'=>'U','Ù'=>'U','Û'=>'U','Ü'=>'U','ç'=>'c','Ç'=>'C'));
    return strtoupper(trim(preg_replace('/\s+/u', ' ', $value)));
}

function netcar_carclick_warranty_number($value)
{
    if ((!is_int($value) && !is_float($value) && !is_string($value))
        || !preg_match('/^[0-9]+(?:\.[0-9]+)?$/D', (string) $value)) return null;
    $number = (float) $value;
    return is_finite($number) ? $number : null;
}

function netcar_carclick_warranty_date($value)
{
    if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $m)) return false;
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}

/** Compare only the reviewed identifier namespace; never expose raw identifiers. */
function netcar_carclick_warranty_unit_matches($row, $unitKey, $xml = false)
{
    if (!is_string($unitKey) || !preg_match('/^(vin|plate)-sha256:([a-f0-9]{64})$/D', $unitKey, $m)) return false;
    // The canonical API adapter prefers VIN and never falls back after invalid VIN.
    if (!$xml && $m[1] === 'plate' && array_key_exists('chassi', $row)
        && $row['chassi'] !== null && (!is_string($row['chassi']) || trim($row['chassi']) !== '')) return false;
    $field = $m[1] === 'vin' ? ($xml ? 'chassis' : 'chassi') : 'placa';
    $raw = isset($row[$field]) && is_string($row[$field]) ? strtoupper(trim($row[$field])) : '';
    $pattern = $m[1] === 'vin' ? '/^[A-HJ-NPR-Z0-9]{17}$/D' : '/^(?:[A-Z]{3}-?[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$/D';
    if (!preg_match($pattern, $raw)) return false;
    return hash_equals($m[2], hash('sha256', str_replace('-', '', $raw)));
}

/**
 * $liveVehicle is a current raw row from the existing stock API reader.
 * API unavailable, changed registry, missing identity or uncertainty => no claim.
 * This helper performs no I/O and never prints prices, km, IDs or expiry estimates.
 * Month/year wording exists only for an actual confirmed date/month in authority.
 */
function netcar_carclick_warranty_claim($row, $manifest, $registryHash, $liveVehicle = null, $today = null)
{
    if ($today === null) $today = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
    if (!is_array($row) || !is_array($manifest) || !is_string($registryHash) || !is_array($liveVehicle)
        || array_key_exists('factoryWarrantyVehicle', $liveVehicle)
        || !netcar_carclick_warranty_date($today) || ($manifest['schemaVersion'] ?? null) !== 1
        || !is_string($manifest['authoritySha256'] ?? null)
        || !preg_match('/^[a-f0-9]{64}$/D', $registryHash)
        || !hash_equals($registryHash, $manifest['authoritySha256'])
        || !netcar_carclick_warranty_date($manifest['generatedForDay'] ?? null)
        || $manifest['generatedForDay'] > $today || !is_array($manifest['claims'] ?? null)) return '';
    $id = $row['codigo_anuncio_revenda'] ?? null;
    if (!is_string($id) || !preg_match('/^[1-9][0-9]*$/D', $id) || (string) ($liveVehicle['id'] ?? '') !== $id) return '';
    $candidates = array_values(array_filter($manifest['claims'], function ($claim) use ($id) {
        return is_array($claim) && ($claim['id'] ?? null) === $id;
    }));
    if (count($candidates) !== 1) return '';
    $claim = $candidates[0];
    foreach (array('brand'=>'marca', 'rawModel'=>'modelo', 'engine'=>'motor', 'transmission'=>'cambio') as $expected=>$field) {
        if (!is_string($claim[$expected] ?? null) || $claim[$expected] === ''
            || netcar_carclick_warranty_normalize($row[$field] ?? null) !== $claim[$expected]) return '';
    }
    foreach (array('brand'=>'marca', 'canonicalModel'=>'modelo', 'engine'=>'motor', 'transmission'=>'cambio') as $expected=>$field) {
        if (!is_string($claim[$expected] ?? null) || $claim[$expected] === ''
            || netcar_carclick_warranty_normalize($liveVehicle[$field] ?? null) !== $claim[$expected]) return '';
    }
    foreach (array('manufactureYear'=>array('ano_fabricacao','ano_fabricacao'), 'modelYear'=>array('ano_modelo','ano')) as $expected=>$fields) {
        if (!is_int($claim[$expected] ?? null)
            || netcar_carclick_warranty_number($row[$fields[0]] ?? null) !== (float) $claim[$expected]
            || netcar_carclick_warranty_number($liveVehicle[$fields[1]] ?? null) !== (float) $claim[$expected]) return '';
    }
    if (!netcar_carclick_warranty_unit_matches($row, $claim['unitKey'] ?? null, true)
        || !netcar_carclick_warranty_unit_matches($liveVehicle, $claim['unitKey'] ?? null)) return '';
    $xmlPrice = netcar_carclick_warranty_number($row['preco'] ?? null);
    $apiPrice = netcar_carclick_warranty_number($liveVehicle['valor'] ?? null);
    $km = netcar_carclick_warranty_number($row['quilometragem'] ?? null);
    if ($xmlPrice === null || $xmlPrice <= 0 || $apiPrice === null || $apiPrice <= 0 || $km === null
        || $km !== netcar_carclick_warranty_number($liveVehicle['km'] ?? null)
        || !is_bool($claim['requiresWarrantyFlag'] ?? null) || !is_array($liveVehicle['diferenciais'] ?? null)) return '';
    $flag = false;
    foreach ($liveVehicle['diferenciais'] as $item) if (is_array($item) && ($item['tag'] ?? null) === 'garantia_fabrica') $flag = true;
    if ($claim['requiresWarrantyFlag'] && !$flag) return '';
    if (!is_array($claim['coverages'] ?? null)) return '';
    $scopes = array();
    $seenScopes = array();
    foreach ($claim['coverages'] as $coverage) {
        if (!is_array($coverage)) return '';
        $scope = $coverage['scope'] ?? null;
        if (!in_array($scope, array('basic-vehicle','powertrain','traction-battery'), true) || isset($seenScopes[$scope])) return '';
        $seenScopes[$scope] = true;
        if (!netcar_carclick_warranty_date($coverage['validBefore'] ?? null) || $today >= $coverage['validBefore']) continue;
        $minimum = netcar_carclick_warranty_number($coverage['minimumMileageKm'] ?? null);
        if ($minimum === null || $km < $minimum || !is_array($coverage['mileage'] ?? null)) continue;
        $kind = $coverage['mileage']['kind'] ?? null;
        if ($kind === 'limited') {
            $limit = netcar_carclick_warranty_number($coverage['mileage']['limitKm'] ?? null);
            if ($limit === null || $limit <= 0 || $km >= $limit) continue;
        } elseif ($kind === 'unknown') {
            if ($scope !== 'powertrain' || $km !== netcar_carclick_warranty_number($coverage['exactMileageKm'] ?? null)) continue;
        } elseif ($kind !== 'unlimited') continue;
        if (isset($coverage['advertisedExpiryMonth']) && (!is_string($coverage['advertisedExpiryMonth'])
            || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D', $coverage['advertisedExpiryMonth'])
            || $coverage['advertisedExpiryMonth'] < substr($today, 0, 7))) continue;
        $scopes[$scope] = $coverage;
    }
    if (isset($scopes['basic-vehicle']) && isset($scopes['powertrain'])) return '';
    foreach (array('basic-vehicle'=>'', 'powertrain'=>' para motor e câmbio', 'traction-battery'=>' para a bateria de tração') as $scope=>$label) {
        if (!isset($scopes[$scope])) continue;
        $month = $scopes[$scope]['advertisedExpiryMonth'] ?? null;
        if ($month !== null) return 'tem garantia de fábrica'.$label.' até '.substr($month, 5, 2).'/'.substr($month, 0, 4).', conforme as condições do fabricante.';
        return 'tem garantia de fábrica vigente'.$label.', conforme as condições do fabricante.';
    }
    return '';
}
