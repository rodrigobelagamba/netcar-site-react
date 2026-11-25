<?php
/** Add missing views to the portal's existing, consecutively numbered JPEG gallery. */
require_once dirname(__DIR__) . '/vehicle-images.php';

function netcar_carclick_gallery_jpeg($url)
{
    if (!is_string($url)) return null;
    // Only filenames from our stock directory can be used for filesystem lookups.
    $pattern = '~^(?:https://www\.netcarmultimarcas\.com\.br|\.)?/imagens/veiculos_automacar/([\p{L}\p{M}\p{N} _().-]+)\.avif$~iuD';
    if (!preg_match($pattern, rawurldecode($url), $match) || $match[1][0] === '.') return null;
    return $match[1] . '.jpg';
}

function netcar_carclick_photo_unit_matches($row, $live)
{
    if (!is_array($live) || (string) ($live['id'] ?? '') !== trim($row['codigo_anuncio_revenda'])) return false;
    $plate = strtoupper(str_replace('-', '', trim($row['placa'] ?? '')));
    $livePlate = is_string($live['placa'] ?? null) ? strtoupper(str_replace('-', '', trim($live['placa']))) : '';
    $vin = strtoupper(trim($row['chassis'] ?? ''));
    $liveVin = is_string($live['chassi'] ?? null) ? strtoupper(trim($live['chassi'])) : '';
    return preg_match('/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/D', $plate) && $plate === $livePlate
        && ($vin === '' || $liveVin === '' || $vin === $liveVin);
}

function netcar_carclick_complete_photos($parsed, $liveById, $publicRoot)
{
    $added = 0;
    foreach ($parsed['records'] as $record) {
        $row = $record['row'];
        $live = $liveById[trim($row['codigo_anuncio_revenda'])] ?? null;
        if (!netcar_carclick_photo_unit_matches($row, $live)) continue;
        $vehicle = netcarSanitizeVehicleImages($live);
        $images = $vehicle['imagens_site'] ?? array();
        if (empty($images['tem_fotos']) || !is_array($images['galeria'] ?? null) || empty($row['foto1'])
            || strcasecmp(basename(trim($row['foto1'])), 'CarroSemFoto.jpg') === 0) continue;

        $element = $record['observation']->parentNode;
        $slots = array();
        $present = array();
        $lastPhoto = 0;
        foreach ($element->childNodes as $field) {
            if (!($field instanceof DOMElement) || !preg_match('/^foto([1-9][0-9]*)$/D', $field->tagName, $number)) continue;
            $index = (int) $number[1];
            $slots[$index] = $field;
            if (trim($field->textContent) === '') continue;
            $present[netcarVehicleImageStem($field->textContent)] = true;
            $lastPhoto = max($lastPhoto, $index);
        }
        if (!$lastPhoto) continue;
        foreach ($images['galeria'] as $source) {
            $filename = netcar_carclick_gallery_jpeg($source);
            if ($filename === null) continue;
            $stem = netcarVehicleImageStem($filename);
            if (isset($present[$stem])) continue;
            // Apache serves the native file first, even if it was supplied after this release.
            $path = $publicRoot . '/imagens/veiculos_automacar/' . $filename;
            if (!file_exists($path)) $path = $publicRoot . '/images/carclick-gallery/' . $filename;
            $info = @getimagesize($path);
            if (($info[2] ?? null) !== IMAGETYPE_JPEG) continue;

            $index = $lastPhoto + 1;
            if (!isset($slots[$index])) {
                $slots[$index] = $parsed['document']->createElement('foto' . $index);
                $element->insertBefore($slots[$index], $slots[$lastPhoto]->nextSibling);
            }
            $slots[$index]->textContent = $filename;
            $lastPhoto = $index;
            $present[$stem] = true;
            $added++;
        }
    }
    return $added;
}
