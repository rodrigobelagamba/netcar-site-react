<?php
/** Approved portal copy. Only OBSERVACAO may change in the supplier XML. */

function netcar_carclick_model_name($model)
{
    $model = trim(preg_replace('/\s+/u', ' ', (string) $model));
    if ($model === '' || strlen($model) > 160
        || preg_match('/[<>@\r\n]|https?:|www\./i', $model)) {
        throw new RuntimeException('Invalid vehicle model');
    }
    // Keep model acronyms readable without inferring a version or equipment.
    $acronyms = array('EX', 'EXL', 'LX', 'ELX', 'LT', 'LTZ', 'LS', 'GL', 'GLS',
        'GLX', 'XLT', 'XLS', 'XEI', 'XRE', 'XRS', 'XRV', 'XRX', 'SE', 'SEL',
        'CVT', 'TSI', 'TDI', 'THP', 'MSI', 'MPI', 'VVT', 'GT', 'GTI', 'RS',
        'SR', 'SRV', 'SRX', 'SL', 'SV', 'S', 'SE', 'XL', 'HRV', 'WRV', 'HR-V', 'WR-V');
    return implode(' ', array_map(function ($word) use ($acronyms) {
        if (preg_match('/[0-9]/', $word) || in_array(strtoupper($word), $acronyms, true)) return $word;
        return function_exists('mb_convert_case')
            ? mb_convert_case($word, MB_CASE_TITLE, 'UTF-8') : ucfirst(strtolower($word));
    }, explode(' ', $model)));
}

function netcar_carclick_description($row, $warranty = '')
{
    $model = netcar_carclick_model_name($row['modelo'] ?? '');
    $opening = $warranty !== ''
        ? 'Este ' . $model . ' ' . $warranty . ' E seu usado pode entrar na troca.'
        : 'Gostou deste ' . $model . '? Vamos avaliar seu usado na troca.';

    return $opening . "\n\n"
        . 'Uma boa compra começa pela procedência: este carro é de uso particular, foi comprado no Rio Grande do Sul e não tem origem de locadora nem histórico de leilão, sinistro, furto ou roubo.' . "\n\n"
        . 'Na Netcar, a confiança continua depois da entrega. Trabalhamos com seminovos desde 1997, com equipe própria para a preparação dos veículos e o Nethelp, nosso pós-venda para acompanhar você depois da compra.' . "\n\n"
        . 'Venha conhecer este ' . $model . ' e conversar com nossa equipe sobre as possibilidades de troca e financiamento.' . "\n\n"
        . 'Qual é o modelo e o ano do seu usado? Mande uma mensagem por aqui para começarmos a avaliação.';
}

function netcar_carclick_parse_source($raw)
{
    if (!is_string($raw) || $raw === '' || strlen($raw) > 20 * 1024 * 1024
        || preg_match('/<!DOCTYPE|<!ENTITY/i', $raw)) {
        throw new RuntimeException('Invalid supplier XML');
    }
    $previous = libxml_use_internal_errors(true);
    $document = new DOMDocument();
    $document->preserveWhiteSpace = true;
    $document->formatOutput = false;
    $loaded = $document->loadXML($raw, LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    if (!$loaded || !$document->documentElement
        || $document->documentElement->tagName !== 'dataroot'
        || $document->doctype !== null
        || ($document->encoding !== null && $document->encoding !== ''
            && strcasecmp($document->encoding, 'UTF-8') !== 0)) {
        throw new RuntimeException('Invalid supplier XML');
    }
    $seen = array();
    $records = array();
    foreach ($document->documentElement->childNodes as $vehicle) {
        if (!($vehicle instanceof DOMElement)) continue;
        if ($vehicle->tagName !== 'veiculo') throw new RuntimeException('Unexpected supplier record');
        $row = array();
        $observation = null;
        foreach ($vehicle->childNodes as $field) {
            if (!($field instanceof DOMElement)) continue;
            if (array_key_exists($field->tagName, $row)) throw new RuntimeException('Duplicate supplier field');
            $row[$field->tagName] = $field->textContent;
            if ($field->tagName === 'OBSERVACAO') $observation = $field;
        }
        $id = trim($row['codigo_anuncio_revenda'] ?? '');
        if (!preg_match('/^[1-9][0-9]*$/D', $id) || isset($seen[$id]) || $observation === null) {
            throw new RuntimeException('Incomplete supplier record');
        }
        netcar_carclick_model_name($row['modelo'] ?? '');
        $seen[$id] = true;
        $records[] = array('row' => $row, 'observation' => $observation);
    }
    if (count($records) === 0 || count($records) > 5000) throw new RuntimeException('Incomplete supplier stock');
    return array('document' => $document, 'records' => $records);
}

/** Keep all original fields, records, attributes and IDs; no stock filtering. */
function netcar_carclick_transform($parsed, $warrantyForRow = null)
{
    $document = $parsed['document'];
    $warrantyCount = 0;
    foreach ($parsed['records'] as $record) {
        $warranty = '';
        if ($warrantyForRow !== null) {
            $result = call_user_func($warrantyForRow, $record['row']);
            if (is_string($result)) $warranty = $result;
        }
        if ($warranty !== '') $warrantyCount++;
        $observation = $record['observation'];
        while ($observation->firstChild) $observation->removeChild($observation->firstChild);
        $observation->appendChild($document->createTextNode(netcar_carclick_description($record['row'], $warranty)));
    }
    $xml = $document->saveXML();
    if (!is_string($xml) || $xml === '') throw new RuntimeException('Could not create feed');
    return array('xml' => $xml, 'vehicles' => count($parsed['records']), 'warranties' => $warrantyCount);
}

function netcar_carclick_read_source($path)
{
    $handle = @fopen($path, 'rb');
    if ($handle === false) throw new RuntimeException('Supplier feed unavailable');
    try {
        if (!flock($handle, LOCK_SH)) throw new RuntimeException('Supplier feed busy');
        $before = fstat($handle);
        $raw = stream_get_contents($handle, 20 * 1024 * 1024 + 1);
        $after = fstat($handle);
        if (!is_array($before) || !is_array($after) || $before['size'] !== $after['size']
            || $before['mtime'] !== $after['mtime'] || !is_string($raw)
            || strlen($raw) !== $after['size']) throw new RuntimeException('Supplier feed changed during read');
        return $raw;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
