<?php
/**
 * Arquivo PHP para retornar HTML com meta tags Open Graph corretas
 * Necessário para que o WhatsApp e outras redes sociais leiam as meta tags corretamente
 * 
 * Exemplo de uso: 
 * - detalhe-veiculo.php?id=19523
 * - detalhe-veiculo.php?slug=compass-serie-s-2022-19526
 */

// Função para extrair ID do slug (mesma lógica do JavaScript)
function extractVehicleIdFromSlug($slug) {
    if (!$slug || trim($slug) === '') {
        return '';
    }
    
    $cleanSlug = trim($slug);
    
    // Remove "/veiculo/" do início se presente
    $cleanSlug = preg_replace('/^\/?veiculo\//', '', $cleanSlug);
    
    // Se for apenas um número, retorna ele mesmo
    $numericId = intval($cleanSlug);
    if ($numericId > 0 && $cleanSlug === strval($numericId)) {
        return strval($numericId);
    }
    
    // Tenta extrair o ID do final do slug (último segmento após o último hífen)
    $parts = explode('-', $cleanSlug);
    
    if (count($parts) > 0) {
        // Procura de trás para frente e pega o primeiro número válido encontrado
        // (que será o último número no slug, que é o ID)
        for ($i = count($parts) - 1; $i >= 0; $i--) {
            $part = $parts[$i];
            $partNum = intval($part);
            
            // Verifica se é um número válido e se o segmento é exatamente esse número
            // IDs geralmente são números grandes (mais de 4 dígitos), mas aceitamos qualquer número válido
            if ($partNum > 0 && $part === strval($partNum)) {
                return strval($partNum);
            }
        }
    }
    
    // Se não conseguir extrair, retorna o slug original (pode ser um ID string)
    return $cleanSlug;
}

// Obtém o ID do veículo (pode vir como 'id' ou extraído do 'slug')
$vehicleId = 0;

if (isset($_GET['id'])) {
    // Se veio como 'id', usa diretamente
    $vehicleId = intval($_GET['id']);
} elseif (isset($_GET['slug'])) {
    // Se veio como 'slug', extrai o ID
    $slug = $_GET['slug'];
    
    // Se o slug é apenas um número (ex: "19523"), usa diretamente
    $numericSlug = intval($slug);
    if ($numericSlug > 0 && $slug === strval($numericSlug)) {
        $vehicleId = $numericSlug;
    } else {
        // Caso contrário, extrai o ID do slug (ex: "polo-highline-2023-jbt-xx40-19629" -> "19629")
        $extractedId = extractVehicleIdFromSlug($slug);
        $vehicleId = intval($extractedId);
    }
}

if (!$vehicleId) {
    // Redireciona para página inicial se não houver ID
    header('Location: /');
    exit;
}

// Busca dados do veículo na API
$apiUrl = 'https://www.netcarmultimarcas.com.br/api/v1/veiculos/id/' . $vehicleId;
$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 3); // Timeout curto para não bloquear
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
// curl_close() é no-op desde o PHP 8.0 e emite Deprecated no 8.5 — o aviso
// conta como output e derruba todo header()/http_response_code() seguinte.
if (PHP_VERSION_ID < 80000) {
    curl_close($ch);
}

/**
 * Nome legível a partir do slug, para quando a API já não tem o veículo.
 * Ex.: "onix-lt-2021-jal-xx10-19803" -> "Onix Lt 2021"
 */
function humanizeVehicleSlug($slug) {
    $s = preg_replace('/^\/?veiculo\//', '', trim((string) $slug));
    $s = preg_replace('/-\d{3,}$/', '', $s);              // id no fim
    $s = preg_replace('/-[a-z]{3}-xx\w{1,3}$/i', '', $s); // placa mascarada
    $s = preg_replace('/-[a-z]{3}\d[a-z0-9]{2,}$/i', '', $s); // placa legada
    $s = str_replace('-', ' ', $s);
    $s = trim(preg_replace('/\s+/', ' ', $s));
    if ($s === '') {
        return 'Este seminovo';
    }
    return function_exists('mb_convert_case')
        ? mb_convert_case($s, MB_CASE_TITLE, 'UTF-8')
        : ucwords($s);
}

function netcarNormalizeLandingValue($value) {
    $value = strtoupper(trim((string) $value));
    if (function_exists('iconv')) {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($ascii !== false) $value = $ascii;
    }
    return trim(preg_replace('/[^A-Z0-9]+/', ' ', $value));
}

function netcarVehicleMatchesLanding($vehicle, $filters) {
    if (!is_array($vehicle) || !is_array($filters)) return false;

    $brand = netcarNormalizeLandingValue($vehicle['marca'] ?? '');
    $model = str_replace(' ', '', netcarNormalizeLandingValue($vehicle['modelo'] ?? ''));
    $category = netcarNormalizeLandingValue($vehicle['categoria'] ?? '');
    $gearbox = netcarNormalizeLandingValue($vehicle['cambio'] ?? '');
    $fuel = netcarNormalizeLandingValue($vehicle['combustivel'] ?? '');
    $price = floatval($vehicle['valor'] ?? 0);

    if (isset($filters['marca']) && $brand !== netcarNormalizeLandingValue($filters['marca'])) return false;
    if (isset($filters['modelo'])) {
        $wantedModel = str_replace(' ', '', netcarNormalizeLandingValue($filters['modelo']));
        if ($wantedModel === '' || strpos($model, $wantedModel) === false) return false;
    }
    if (isset($filters['categoria']) && $category !== netcarNormalizeLandingValue($filters['categoria'])) return false;
    if (isset($filters['cambio']) && $gearbox !== netcarNormalizeLandingValue($filters['cambio'])) return false;
    if (isset($filters['combustivel']) && $fuel !== netcarNormalizeLandingValue($filters['combustivel'])) return false;
    if (isset($filters['precoMin']) && $price < floatval($filters['precoMin'])) return false;
    if (isset($filters['precoMax']) && $price > floatval($filters['precoMax'])) return false;
    return true;
}

/** Atalhos comerciais da ficha para páginas que têm outras ofertas reais. */
function netcarVehicleDiscoveryLandings($vehicle) {
    $file = __DIR__ . '/seo/landings.json';
    if (!is_readable($file) || !is_array($vehicle)) return array();
    $landings = json_decode((string) @file_get_contents($file), true);
    if (!is_array($landings)) return array();

    $matching = array();
    foreach ($landings as $landing) {
        if (
            !is_array($landing) ||
            empty($landing['indexable']) ||
            intval($landing['count'] ?? 0) <= 1
        ) continue;
        $filters = isset($landing['filters']) && is_array($landing['filters'])
            ? $landing['filters']
            : array();
        if (netcarVehicleMatchesLanding($vehicle, $filters)) $matching[] = $landing;
    }

    $selected = array();
    foreach (array('modelo', 'marca', 'categoria') as $type) {
        foreach ($matching as $landing) {
            if (($landing['type'] ?? '') === $type) {
                $selected[] = $landing;
                break;
            }
        }
    }

    $priceLandings = array_values(array_filter($matching, function($landing) {
        return ($landing['type'] ?? '') === 'faixa';
    }));
    usort($priceLandings, function($left, $right) {
        $leftFilters = $left['filters'] ?? array();
        $rightFilters = $right['filters'] ?? array();
        $leftWidth = floatval($leftFilters['precoMax'] ?? PHP_INT_MAX) - floatval($leftFilters['precoMin'] ?? 0);
        $rightWidth = floatval($rightFilters['precoMax'] ?? PHP_INT_MAX) - floatval($rightFilters['precoMin'] ?? 0);
        return $leftWidth <=> $rightWidth;
    });
    if (!empty($priceLandings)) {
        $selected[] = $priceLandings[0];
    }

    return $selected;
}

// Há somente três estados seguros:
// - 200 + JSON válido + success=true + veículo: ficha encontrada;
// - 404 + JSON válido + success=false: ausência confirmada pela API;
// - qualquer outra combinação: falha transitória ou contrato inválido.
// Em especial, um 200 vazio/malformado nunca pode virar 410 e retirar do índice
// um carro que ainda pode estar à venda.
$data = null;
$jsonValid = false;
if ($response !== false && is_string($response) && trim($response) !== '') {
    $data = json_decode($response, true);
    $jsonValid = json_last_error() === JSON_ERROR_NONE && is_array($data);
}

$vehicleFound = (
    $httpCode === 200
    && $jsonValid
    && isset($data['success'])
    && $data['success'] === true
    && isset($data['data'])
    && is_array($data['data'])
    && isset($data['data'][0])
    && is_array($data['data'][0])
);
$vehicleMissing = (
    $httpCode === 404
    && $jsonValid
    && array_key_exists('success', $data)
    && $data['success'] === false
);

if (!$vehicleFound && !$vehicleMissing) {
    // Falha transitória: 503 mantém a URL no índice e pede nova tentativa.
    http_response_code(503);
    header('Retry-After: 3600');
    header('Cache-Control: no-store');
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">'
        . '<title>Estoque temporariamente indisponível | Netcar Multimarcas</title>'
        . '<meta name="robots" content="noindex, follow"></head><body>'
        . '<h1>Estoque temporariamente indisponível</h1>'
        . '<p>Não foi possível carregar este seminovo agora. Tente novamente em alguns minutos.</p>'
        . '<p><a href="/seminovos">Ver todos os seminovos</a></p>'
        . '</body></html>';
    exit;
}

if ($vehicleMissing) {
    $goneName = humanizeVehicleSlug(isset($_GET['slug']) ? $_GET['slug'] : (string) $vehicleId);
    http_response_code(410);
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: public, max-age=86400');
    ?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?php echo htmlspecialchars($goneName . ' já foi vendido | Netcar Multimarcas', ENT_QUOTES, 'UTF-8'); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($goneName . ' já foi vendido. Veja seminovos similares disponíveis agora na Netcar Multimarcas, em Esteio/RS.', ENT_QUOTES, 'UTF-8'); ?>" />
    <meta name="robots" content="noindex, follow" />
    <meta property="og:site_name" content="Netcar Multimarcas" />
    <meta property="og:title" content="<?php echo htmlspecialchars($goneName . ' já foi vendido', ENT_QUOTES, 'UTF-8'); ?>" />
    <meta property="og:description" content="Veja seminovos similares disponíveis na Netcar Multimarcas, Esteio/RS." />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
</head>
<body>
    <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1><?php echo htmlspecialchars($goneName, ENT_QUOTES, 'UTF-8'); ?> já foi vendido</h1>
        <p>Este seminovo saiu do estoque da Netcar Multimarcas, em Esteio/RS. O estoque
        muda toda semana e provavelmente temos opções parecidas disponíveis agora.</p>
        <ul>
            <li><a href="/seminovos">Ver todos os seminovos em estoque</a></li>
            <li><a href="/comprar-suv">SUVs seminovos</a></li>
            <li><a href="/comprar-hatch">Hatches seminovos</a></li>
            <li><a href="/comprar-sedan">Sedãs seminovos</a></li>
            <li><a href="/seminovos-automaticos">Seminovos automáticos</a></li>
            <li><a href="/financiamento">Financiamento de seminovos</a></li>
            <li><a href="/regioes-atendidas">Regiões atendidas</a></li>
        </ul>
    </div>
</body>
</html>
    <?php
    exit;
}

$vehicle = $data['data'][0];
$discoveryLandings = netcarVehicleDiscoveryLandings($vehicle);
$brandLanding = null;
foreach ($discoveryLandings as $candidateLanding) {
    if (($candidateLanding['type'] ?? '') === 'marca') {
        $brandLanding = $candidateLanding;
        break;
    }
}

// Prepara dados para meta tags
$marca = isset($vehicle['marca']) ? $vehicle['marca'] : '';
$modelo = isset($vehicle['modelo']) ? $vehicle['modelo'] : '';
$ano = isset($vehicle['ano']) ? $vehicle['ano'] : ''; // Ano modelo
$anoFabricacao = isset($vehicle['ano_fabricacao']) && $vehicle['ano_fabricacao'] ? $vehicle['ano_fabricacao'] : null; // Ano de fabricação
$placa = isset($vehicle['placa']) ? $vehicle['placa'] : '';
$cor = isset($vehicle['cor']) ? $vehicle['cor'] : '';
$preco = isset($vehicle['valor']) ? $vehicle['valor'] : 0;
$km = isset($vehicle['km']) ? $vehicle['km'] : 0;
$combustivel = isset($vehicle['combustivel']) ? $vehicle['combustivel'] : '';
$cambio = isset($vehicle['cambio']) ? $vehicle['cambio'] : '';
$valorFormatado = isset($vehicle['valor_formatado']) ? $vehicle['valor_formatado'] : '';

$isSold = intval($preco) <= 0;

// Função para mascarar placa na exibição do título (ex: ABC1234 -> abc-21)
function maskPlate($placa) {
    if (!$placa) return '';
    $placaLower = strtolower(trim($placa));
    if (strlen($placaLower) >= 7) {
        return substr($placaLower, 0, 3) . '-' . substr($placaLower, -2);
    }
    return $placaLower;
}

/**
 * Máscara de placa no slug — espelha src/lib/slug.ts (maskPlate).
 * Ex.: JCO1D21 → jco-xx21
 */
function maskPlateForSlug($placa) {
    if (!$placa) return '';
    $clean = strtoupper(preg_replace('/\s+/', '', $placa));
    $clean = str_replace('-', '', $clean);
    if (strlen($clean) < 5) {
        return strtolower($clean);
    }
    $prefix = substr($clean, 0, 3);
    preg_match_all('/\d/', $clean, $digitMatches);
    $digits = $digitMatches[0] ?? [];
    if (count($digits) >= 2) {
        $suffix = $digits[count($digits) - 2] . $digits[count($digits) - 1];
    } else {
        $suffix = substr($clean, -2);
    }
    return strtolower($prefix . '-xx' . $suffix);
}

/**
 * Slug canônico — espelha src/lib/slug.ts (generateVehicleSlug).
 * Formato: {modelo}-{ano}-{placa-mascarada}-{id}
 */
function generateVehicleSlug($vehicle, $id) {
    $parts = [];
    $modelo = isset($vehicle['modelo']) ? trim((string) $vehicle['modelo']) : '';
    $marca = isset($vehicle['marca']) ? trim((string) $vehicle['marca']) : '';

    if ($modelo !== '' && $marca !== '' && stripos($modelo, $marca) === 0) {
        $modelo = trim(substr($modelo, strlen($marca)));
    }

    if ($modelo !== '') {
        $modeloSlug = strtolower($modelo);
        if (function_exists('iconv')) {
            $transliterated = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $modeloSlug);
            if ($transliterated !== false) {
                $modeloSlug = $transliterated;
            }
        }
        $modeloSlug = preg_replace('/[^a-z0-9\s-]/', '', $modeloSlug);
        $modeloSlug = preg_replace('/\s+/', '-', $modeloSlug);
        $modeloSlug = preg_replace('/-+/', '-', $modeloSlug);
        $modeloSlug = trim($modeloSlug, '-');
        if ($modeloSlug !== '') {
            $parts[] = $modeloSlug;
        }
    }

    $ano = isset($vehicle['ano']) ? $vehicle['ano'] : '';
    if ($ano) {
        $parts[] = (string) $ano;
    }

    $placa = isset($vehicle['placa']) ? $vehicle['placa'] : '';
    if ($placa) {
        $placaSlug = maskPlateForSlug($placa);
        if ($placaSlug !== '') {
            $parts[] = $placaSlug;
        }
    }

    $parts[] = (string) $id;
    return implode('-', $parts);
}

/** Title Case preservando UTF-8. */
function titleCase($text) {
    $text = trim((string) $text);
    if ($text === '') return '';
    return function_exists('mb_convert_case')
        ? mb_convert_case(mb_strtolower($text, 'UTF-8'), MB_CASE_TITLE, 'UTF-8')
        : ucwords(strtolower($text));
}

// Nome comercial do veículo: marca + modelo + ano ("Hyundai Creta Prestige 2018").
// A placa saiu do título — quem busca digita a marca, não o fragmento da placa.
$modeloSemMarca = trim((string) $modelo);
if ($modeloSemMarca !== '' && $marca !== '' && stripos($modeloSemMarca, $marca) === 0) {
    $modeloSemMarca = trim(substr($modeloSemMarca, strlen($marca)));
}
$nomeParts = [];
if ($marca) {
    $nomeParts[] = titleCase($marca);
}
if ($modeloSemMarca !== '') {
    $nomeParts[] = titleCase($modeloSemMarca);
}
if ($ano) {
    $nomeParts[] = $ano;
}
$vehicleName = !empty($nomeParts) ? implode(' ', $nomeParts) : 'Seminovo';

// Preço e km em formatos curtos, reaproveitados no title, og e corpo.
$precoCurto = intval($preco) > 0 ? 'R$ ' . number_format($preco, 0, ',', '.') : '';
$kmCurto = '';
if ($km > 0) {
    $kmCurto = $km >= 1000
        ? number_format($km / 1000, 0, ',', '.') . ' mil km'
        : number_format($km, 0, ',', '.') . ' km';
}

// og:title (WhatsApp, Facebook): nome + preço.
$ogTitle = $vehicleName;
if ($isSold) {
    $ogTitle .= ' — vendido';
} elseif ($precoCurto) {
    $ogTitle .= ' — ' . $precoCurto;
}

// <title> do Google: nome + km + preço + loja. Km diferencia dois carros iguais.
$pageTitleParts = [$vehicleName];
if (!$isSold && $kmCurto) {
    $pageTitleParts[] = '· ' . $kmCurto;
}
if ($isSold) {
    $pageTitleParts[] = '— vendido';
} elseif ($precoCurto) {
    $pageTitleParts[] = '— ' . $precoCurto;
}
$pageTitle = implode(' ', $pageTitleParts) . ' | Netcar Multimarcas Esteio';

// Formata descrição detalhada: "2018 / 2019 - 135.000km • Flex • MANUAL • MARROM"
$descriptionParts = [];
// Formata ano: se tem ambos, mostra "ano_fabricacao / ano_modelo", senão só o ano modelo
$anoDisplay = '';
if ($anoFabricacao && $ano) {
    $anoDisplay = $anoFabricacao . ' / ' . $ano;
} elseif ($ano) {
    $anoDisplay = $ano;
}

// Ano e KM juntos com " - " entre eles
if ($anoDisplay && $km > 0) {
    $kmFormatado = number_format($km, 0, '.', '.');
    $descriptionParts[] = $anoDisplay . ' - ' . $kmFormatado . 'km';
} elseif ($anoDisplay) {
    $descriptionParts[] = $anoDisplay;
} elseif ($km > 0) {
    $kmFormatado = number_format($km, 0, '.', '.');
    $descriptionParts[] = $kmFormatado . 'km';
}
// Combustível, câmbio e cor separados por " • "
if ($combustivel) {
    $descriptionParts[] = strtoupper($combustivel);
}
if ($cambio) {
    $descriptionParts[] = strtoupper($cambio);
}
if ($cor) {
    $descriptionParts[] = strtoupper($cor);
}
$ogDescription = implode(' • ', $descriptionParts);

// Se não tiver descrição, tenta construir uma descrição básica
if (empty($ogDescription)) {
    // Tenta construir descrição mínima com o que tiver
    $minParts = [];
    if ($ano) {
        $minParts[] = $ano;
    }
    if ($marca && $modelo) {
        $minParts[] = strtoupper($marca . ' ' . $modelo);
    }
    if (!empty($minParts)) {
        $ogDescription = implode(' • ', $minParts);
    } else {
        $ogDescription = 'Seminovo é na Netcar';
    }
}

// Meta description do Google: frase completa com nome, km, preço e cidade.
// A versão com bullets (og) serve para preview de link, não para snippet.
$metaParts = [$vehicleName];
if ($kmCurto) {
    $metaParts[] = 'com ' . $kmCurto;
}
$detalhe = [];
if ($cambio) {
    $detalhe[] = 'câmbio ' . mb_strtolower($cambio, 'UTF-8');
}
if ($combustivel) {
    $detalhe[] = mb_strtolower($combustivel, 'UTF-8');
}
if ($cor) {
    $detalhe[] = mb_strtolower($cor, 'UTF-8');
}
$metaDescription = implode(' ', $metaParts);
if (!empty($detalhe)) {
    $metaDescription .= ', ' . implode(', ', $detalhe);
}
$metaDescription .= '. ';
$metaDescription .= $isSold
    ? 'Este seminovo foi vendido — veja similares disponíveis na Netcar Multimarcas, em Esteio/RS.'
    : ($precoCurto ? $precoCurto . ' na Netcar Multimarcas, em Esteio/RS. ' : 'Na Netcar Multimarcas, em Esteio/RS. ')
        . 'Laudo de vistoria, garantia e financiamento com análise no mesmo dia.';

// Busca imagem para Open Graph - USA APENAS imagens_site.capa_opengraph (sem fallback)
// IMPORTANTE: WhatsApp precisa de pelo menos 300px de largura para mostrar imagem grande em cima
$imagem = '';

// USA APENAS imagens_site.capa_opengraph (sem fallback)
if (!empty($vehicle['imagens_site']['capa_opengraph']) && is_string($vehicle['imagens_site']['capa_opengraph'])) {
    $imagem = trim($vehicle['imagens_site']['capa_opengraph']);
    
    // Se a imagem estiver em 'small/', substitui por 'big/' para garantir imagem grande
    // Isso garante que a imagem apareça grande em cima no WhatsApp/Facebook
    if (strpos($imagem, '/small/') !== false) {
        $imagem = str_replace('/small/', '/big/', $imagem);
    }
}

// Normaliza URL da imagem
// SEMPRE usa o domínio de produção para garantir URLs corretas nas meta tags
$baseUrl = 'https://www.netcarmultimarcas.com.br';
if ($imagem) {
    // Remove prefixos relativos
    $imagem = trim($imagem);
    $imagem = preg_replace('/^\.\/+/', '', $imagem);
    $imagem = preg_replace('/^\.\\\\+/', '', $imagem); // Remove também barras invertidas
    
    // Verifica se já está codificada (contém % seguido de 2 dígitos hexadecimais)
    // Se não estiver codificada, codifica apenas espaços e caracteres especiais
    $isEncoded = preg_match('/%[0-9A-Fa-f]{2}/', $imagem);
    
    if (!$isEncoded) {
        // Não está codificada, codifica apenas espaços e caracteres especiais
        // Mas preserva as barras do caminho
        $imagem = str_replace(' ', '%20', $imagem);
        $imagem = str_replace('(', '%28', $imagem);
        $imagem = str_replace(')', '%29', $imagem);
    }
    // Se já contém %, assume que já está codificada e não codifica novamente
    
    // Se já é URL absoluta, usa diretamente (mas força HTTPS)
    if (strpos($imagem, 'http://') === 0 || strpos($imagem, 'https://') === 0) {
        $imagemUrl = $imagem;
        // Força HTTPS se for HTTP
        if (strpos($imagemUrl, 'http://') === 0) {
            $imagemUrl = str_replace('http://', 'https://', $imagemUrl);
        }
    } 
    // Se começa com /, adiciona apenas o domínio
    elseif (strpos($imagem, '/') === 0) {
        $imagemUrl = $baseUrl . $imagem;
    } 
    // Caso contrário, adiciona / antes
    else {
        $imagemUrl = $baseUrl . '/' . ltrim($imagem, '/');
    }
    
    // Garante que a URL está correta (remove duplicação de barras, exceto após http:// ou https://)
    // Usa uma abordagem mais simples que funciona em todas as versões do PHP
    if (strpos($imagemUrl, 'http://') === 0) {
        $imagemUrl = 'http://' . preg_replace('#//+#', '/', substr($imagemUrl, 7));
    } elseif (strpos($imagemUrl, 'https://') === 0) {
        $imagemUrl = 'https://' . preg_replace('#//+#', '/', substr($imagemUrl, 8));
    } else {
        $imagemUrl = preg_replace('#//+#', '/', $imagemUrl);
    }
} else {
    $imagemUrl = $baseUrl . '/images/semcapa.png';
}

// Detecta se é bot/crawler (lista mais completa)
// Detecta se é bot/crawler (lista mais completa)
// Se chegou aqui pelo .htaccess, já foi filtrado para ser bot, mas vamos garantir
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isBot = preg_match('/(facebookexternalhit|WhatsApp|WhatsAppBot|Twitterbot|LinkedInBot|Slackbot|SkypeUriPreview|Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|curl|wget|facebook|Facebot|Slurp|ia_archiver|Mediapartners|Applebot|BingPreview|Slackbot-LinkExpanding|Slack-ImgProxy|Slackbot|SkypeUriPreview|LinkedInBot|Twitterbot|WhatsApp|facebookexternalhit|Facebot|Google-Structured-Data-Testing-Tool|bot|crawler|spider|scraper)/i', $userAgent);

// Se chegou aqui pelo PHP (tem parâmetro 'slug'), é porque foi interceptado pelo .htaccess
// Isso significa que é bot/crawler, então sempre mostrar meta tags
// Mas se por algum motivo não for detectado como bot, ainda assim mostra as meta tags (fallback)
if (!$isBot && isset($_GET['slug'])) {
    // Se veio pelo PHP com slug, é porque foi interceptado pelo .htaccess como bot
    // Nesse caso, sempre mostrar meta tags
    $isBot = true;
}

// Slug canônico oficial (com placa mascarada). URLs curtas sem placa → 301.
$requestSlug = isset($_GET['slug']) ? trim((string) $_GET['slug']) : '';
$canonicalSlug = generateVehicleSlug($vehicle, $vehicleId);
$canonicalPath = '/veiculo/' . $canonicalSlug;

if ($requestSlug !== '' && $requestSlug !== $canonicalSlug) {
    http_response_code(301);
    header('Location: ' . $baseUrl . $canonicalPath);
    header('Cache-Control: public, max-age=86400');
    exit;
}

$redirectUrl = $canonicalPath;
$pageUrl = $baseUrl . $canonicalPath;

// Mascara placa para product:retailer_item_id (em MAIÚSCULAS)
$placaRetailer = '';
if ($placa) {
    $placaUpper = strtoupper(trim($placa));
    if (strlen($placaUpper) >= 7) {
        $placaRetailer = substr($placaUpper, 0, 3) . '-' . substr($placaUpper, -2);
    } else {
        $placaRetailer = $placaUpper;
    }
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Meta tags básicas -->
    <title><?php echo htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8'); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8'); ?>" />
    <?php if ($isSold): ?>
    <meta name="robots" content="noindex, follow" />
    <?php endif; ?>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:site_name" content="Netcar Multimarcas" />
    <meta property="og:title" content="<?php echo htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta property="og:description" content="<?php echo htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta property="og:image" content="<?php echo htmlspecialchars($imagemUrl, ENT_QUOTES, 'UTF-8'); ?>" />
    <?php
    // IMPORTANTE: Para imagem aparecer GRANDE EM CIMA no WhatsApp:
    // - Largura mínima: 300px (recomendado: 1200px)
    // - Proporção recomendada: 1.91:1 (1200x630px) para imagem grande em cima
    // - Tamanho máximo: 600KB
    // - WhatsApp mostra imagem grande em cima quando tem pelo menos 300px de largura
    ?>
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="<?php echo htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8'); ?>" />
    <?php 
    // Detecta o tipo de imagem baseado na extensão da URL final
    $imageType = 'image/jpeg'; // padrão (JPG)
    if (stripos($imagemUrl, '.jpg') !== false || stripos($imagemUrl, '.jpeg') !== false) {
        $imageType = 'image/jpeg';
    } elseif (stripos($imagemUrl, '.png') !== false) {
        $imageType = 'image/png';
    } elseif (stripos($imagemUrl, '.avif') !== false) {
        $imageType = 'image/avif';
    } elseif (stripos($imagemUrl, '.webp') !== false) {
        $imageType = 'image/webp';
    }
    ?>
    <meta property="og:image:type" content="<?php echo htmlspecialchars($imageType, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta property="og:image:secure_url" content="<?php echo htmlspecialchars($imagemUrl, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta property="og:url" content="<?php echo htmlspecialchars($pageUrl, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="pt_BR" />
    
    <!-- Product tags -->
    <meta property="product:brand" content="Netcar" />
    <meta property="product:availability" content="<?php echo $isSold ? 'out of stock' : 'in stock'; ?>" />
    <meta property="product:condition" content="used_like_new" />
    <meta property="product:price:amount" content="<?php echo intval($preco); ?>" />
    <meta property="product:price:currency" content="BRL" />
    <?php if ($placaRetailer): ?>
    <meta property="product:retailer_item_id" content="<?php echo htmlspecialchars($placaRetailer, ENT_QUOTES, 'UTF-8'); ?>" />
    <?php endif; ?>
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="<?php echo htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta name="twitter:description" content="<?php echo htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta name="twitter:image" content="<?php echo htmlspecialchars($imagemUrl, ENT_QUOTES, 'UTF-8'); ?>" />
    
    <!-- Canonical URL -->
    <link rel="canonical" href="<?php echo htmlspecialchars($pageUrl, ENT_QUOTES, 'UTF-8'); ?>" />
    
    <!-- JSON-LD Schema.org para SEO (Google) -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Car",
      "name": "<?php echo htmlspecialchars($vehicleName, ENT_QUOTES, 'UTF-8'); ?>",
      "brand": {
        "@type": "Brand",
        "name": "<?php echo htmlspecialchars(titleCase($marca), ENT_QUOTES, 'UTF-8'); ?>"
      },
      "model": "<?php echo htmlspecialchars(titleCase($modeloSemMarca !== '' ? $modeloSemMarca : $modelo), ENT_QUOTES, 'UTF-8'); ?>",
      <?php if ($anoFabricacao): ?>
      "productionDate": "<?php echo htmlspecialchars($anoFabricacao, ENT_QUOTES, 'UTF-8'); ?>",
      <?php endif; ?>
      <?php if (!empty($vehicle['portas'])): ?>
      "numberOfDoors": <?php echo intval($vehicle['portas']); ?>,
      <?php endif; ?>
      <?php if (!empty($vehicle['motor'])): ?>
      "vehicleEngine": {
        "@type": "EngineSpecification",
        "engineDisplacement": {
          "@type": "QuantitativeValue",
          "value": "<?php echo htmlspecialchars($vehicle['motor'], ENT_QUOTES, 'UTF-8'); ?>",
          "unitCode": "LTR"
        }<?php if (!empty($vehicle['potencia'])): ?>,
        "enginePower": {
          "@type": "QuantitativeValue",
          "value": <?php echo intval($vehicle['potencia']); ?>,
          "unitCode": "N12"
        }<?php endif; ?>
      },
      <?php endif; ?>
      "vehicleModelDate": "<?php echo htmlspecialchars($ano, ENT_QUOTES, 'UTF-8'); ?>",
      <?php if ($km > 0): ?>
      "mileageFromOdometer": {
        "@type": "QuantitativeValue",
        "value": <?php echo intval($km); ?>,
        "unitCode": "KMT"
      },
      <?php endif; ?>
      <?php if ($combustivel): ?>
      "fuelType": "<?php echo htmlspecialchars($combustivel, ENT_QUOTES, 'UTF-8'); ?>",
      <?php endif; ?>
      <?php if ($cambio): ?>
      "vehicleTransmission": "<?php echo htmlspecialchars($cambio, ENT_QUOTES, 'UTF-8'); ?>",
      <?php endif; ?>
      <?php if ($cor): ?>
      "color": "<?php echo htmlspecialchars($cor, ENT_QUOTES, 'UTF-8'); ?>",
      <?php endif; ?>
      "image": [
        <?php 
        // Adiciona todas as imagens full (limitado a 5 primeiras para não ficar muito grande)
        // $imagensFull vinha indefinido: o schema saía sempre com 1 imagem só.
        $imagensFull = [];
        foreach ([
            isset($vehicle['imagens_site']['galeria']) ? $vehicle['imagens_site']['galeria'] : null,
            isset($vehicle['imagens']['full']) ? $vehicle['imagens']['full'] : null,
            isset($vehicle['imagens']['thumb']) ? $vehicle['imagens']['thumb'] : null,
        ] as $candidate) {
            if (!empty($candidate) && is_array($candidate)) {
                $imagensFull = $candidate;
                break;
            }
        }
        $imageList = [];
        if (!empty($imagensFull)) {
            $count = 0;
            foreach ($imagensFull as $img) {
                if ($count >= 5) break; // Limita a 5 imagens
                if ($img && is_string($img)) {
                    $imgClean = trim($img);
                    $imgClean = preg_replace('/^\.\/+/', '', $imgClean);
                    
                    // Codifica apenas se necessário
                    $isEncoded = preg_match('/%[0-9A-Fa-f]{2}/', $imgClean);
                    if (!$isEncoded) {
                        $imgClean = str_replace(' ', '%20', $imgClean);
                        $imgClean = str_replace('(', '%28', $imgClean);
                        $imgClean = str_replace(')', '%29', $imgClean);
                    }
                    
                    if (strpos($imgClean, '/') === 0) {
                        $imageList[] = $baseUrl . $imgClean;
                    } else {
                        $imageList[] = $baseUrl . '/' . ltrim($imgClean, '/');
                    }
                    $count++;
                }
            }
        }
        // Se não tiver imagens, adiciona pelo menos a imagem principal
        if (empty($imageList) && !empty($imagemUrl)) {
            $imageList[] = $imagemUrl;
        }
        echo '"' . implode('", "', array_map(function($url) {
            return htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        }, $imageList)) . '"';
        ?>
      ],
      "offers": {
        "@type": "Offer",
        "price": <?php echo intval($preco); ?>,
        "priceCurrency": "BRL",
        "itemCondition": "https://schema.org/UsedCondition",
        "availability": "<?php echo $isSold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'; ?>",
        "url": "<?php echo htmlspecialchars($pageUrl, ENT_QUOTES, 'UTF-8'); ?>",
        "seller": {
          "@type": "AutoDealer",
          "name": "Netcar Multimarcas",
          "url": "https://www.netcarmultimarcas.com.br"
        }
      }
      <?php if ($placaRetailer): ?>
      ,
      "sku": "<?php echo htmlspecialchars($placaRetailer, ENT_QUOTES, 'UTF-8'); ?>"
      <?php endif; ?>
    }
    </script>

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": "<?php echo htmlspecialchars($pageUrl, ENT_QUOTES, 'UTF-8'); ?>#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Início",
          "item": "https://www.netcarmultimarcas.com.br/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Seminovos",
          "item": "https://www.netcarmultimarcas.com.br/seminovos"
        }<?php if (is_array($brandLanding) && !empty($brandLanding['slug'])): ?>,
        {
          "@type": "ListItem",
          "position": 3,
          "name": "<?php echo htmlspecialchars((string) $brandLanding['name'], ENT_QUOTES, 'UTF-8'); ?>",
          "item": "https://www.netcarmultimarcas.com.br/comprar-<?php echo rawurlencode((string) $brandLanding['slug']); ?>"
        }<?php endif; ?>,
        {
          "@type": "ListItem",
          "position": <?php echo is_array($brandLanding) ? 4 : 3; ?>,
          "name": "<?php echo htmlspecialchars($vehicleName, ENT_QUOTES, 'UTF-8'); ?>",
          "item": "<?php echo htmlspecialchars($pageUrl, ENT_QUOTES, 'UTF-8'); ?>"
        }
      ]
    }
    </script>
    
    <?php if (!$isBot): ?>
    <!-- Redireciona para React app após carregar meta tags (apenas para usuários normais) -->
    <!-- IMPORTANTE: Aguarda 500ms para garantir que bots/crawlers leiam as meta tags antes do redirecionamento -->
    <script>
        setTimeout(function() {
            window.location.href = '<?php echo $redirectUrl; ?>';
        }, 500);
    </script>
    
    <!-- Fallback: redireciona imediatamente se JS estiver desabilitado -->
    <noscript>
        <meta http-equiv="refresh" content="0;url=<?php echo $redirectUrl; ?>" />
    </noscript>
    <?php endif; ?>
</head>
<body>
    <?php if (!$isBot): ?>
    <p>Carregando...</p>
    <script>
        window.location.href = '<?php echo $redirectUrl; ?>';
    </script>
    <?php else: ?>
    <!-- Bot/crawler: conteúdo real da ficha (antes eram 4 linhas, tratadas como
         página vazia pelo Google) + links internos para estoque e cidades. -->
    <div style="padding: 20px; font-family: Arial, sans-serif;">
        <nav aria-label="Navegação estrutural">
            <a href="/">Início</a> &rsaquo;
            <a href="/seminovos">Seminovos</a> &rsaquo;
            <?php if (is_array($brandLanding) && !empty($brandLanding['slug'])): ?>
            <a href="/comprar-<?php echo rawurlencode((string) $brandLanding['slug']); ?>"><?php echo htmlspecialchars((string) $brandLanding['name'], ENT_QUOTES, 'UTF-8'); ?></a> &rsaquo;
            <?php endif; ?>
            <span><?php echo htmlspecialchars($vehicleName, ENT_QUOTES, 'UTF-8'); ?></span>
        </nav>
        <h1><?php echo htmlspecialchars($vehicleName, ENT_QUOTES, 'UTF-8'); ?></h1>
        <?php if ($isSold): ?>
        <p><strong>Este veículo já foi vendido.</strong> Veja abaixo outras opções
        disponíveis no estoque da Netcar Multimarcas, em Esteio/RS.</p>
        <?php else: ?>
        <p><strong><?php echo htmlspecialchars($precoCurto !== '' ? $precoCurto : 'Consulte o valor', ENT_QUOTES, 'UTF-8'); ?></strong>
        — seminovo à venda na Netcar Multimarcas, Av. Presidente Vargas, Esteio/RS.</p>
        <?php endif; ?>

        <h2>Ficha técnica</h2>
        <ul>
            <?php if ($anoDisplay): ?><li>Ano: <?php echo htmlspecialchars($anoDisplay, ENT_QUOTES, 'UTF-8'); ?></li><?php endif; ?>
            <?php if ($km > 0): ?><li>Quilometragem: <?php echo number_format($km, 0, ',', '.'); ?> km</li><?php endif; ?>
            <?php if ($cambio): ?><li>Câmbio: <?php echo htmlspecialchars(titleCase($cambio), ENT_QUOTES, 'UTF-8'); ?></li><?php endif; ?>
            <?php if ($combustivel): ?><li>Combustível: <?php echo htmlspecialchars(titleCase($combustivel), ENT_QUOTES, 'UTF-8'); ?></li><?php endif; ?>
            <?php if ($cor): ?><li>Cor: <?php echo htmlspecialchars(titleCase($cor), ENT_QUOTES, 'UTF-8'); ?></li><?php endif; ?>
            <?php if (!empty($vehicle['motor'])): ?><li>Motor: <?php echo htmlspecialchars($vehicle['motor'], ENT_QUOTES, 'UTF-8'); ?></li><?php endif; ?>
            <?php if (!empty($vehicle['potencia'])): ?><li>Potência: <?php echo htmlspecialchars($vehicle['potencia'], ENT_QUOTES, 'UTF-8'); ?> cv</li><?php endif; ?>
            <?php if (!empty($vehicle['portas'])): ?><li>Portas: <?php echo intval($vehicle['portas']); ?></li><?php endif; ?>
            <?php if ($placa): ?><li>Referência do veículo: <?php echo htmlspecialchars(strtoupper(maskPlate($placa)), ENT_QUOTES, 'UTF-8'); ?></li><?php endif; ?>
        </ul>

        <?php
        $opcionais = [];
        if (!empty($vehicle['opcionais']) && is_array($vehicle['opcionais'])) {
            foreach ($vehicle['opcionais'] as $opcional) {
                $descricao = is_array($opcional)
                    ? (isset($opcional['descricao']) ? $opcional['descricao'] : '')
                    : $opcional;
                $descricao = trim(ltrim((string) $descricao, '.'));
                if ($descricao !== '') {
                    $opcionais[] = $descricao;
                }
            }
        }
        ?>
        <?php if (!empty($opcionais)): ?>
        <h2>Itens e opcionais</h2>
        <ul>
            <?php foreach (array_slice($opcionais, 0, 30) as $opcional): ?>
            <li><?php echo htmlspecialchars($opcional, ENT_QUOTES, 'UTF-8'); ?></li>
            <?php endforeach; ?>
        </ul>
        <?php endif; ?>

        <h2>Como a Netcar prepara este seminovo</h2>
        <p>Todo carro do nosso estoque passa pela Fábrica de Valor: avaliação mecânica,
        revisão dos itens de segurança e correção do que for necessário antes de entrar
        na vitrine. Você recebe laudo de vistoria e garantia, e pode comparar condições
        de financiamento entre bancos e financeiras parceiras — com entrada mínima de
        20% e possibilidade de dar seu usado na troca, sujeito à análise de crédito.</p>

        <h2>Onde ver este carro</h2>
        <p>Netcar Multimarcas — Av. Presidente Vargas, Esteio/RS. Duas lojas na mesma
        avenida, a poucos minutos de Sapucaia do Sul, Canoas, São Leopoldo e Gravataí,
        atendendo toda a Região Metropolitana de Porto Alegre.</p>

        <h2>Continue navegando</h2>
        <ul>
            <li><a href="<?php echo htmlspecialchars($redirectUrl, ENT_QUOTES, 'UTF-8'); ?>">Ficha completa com todas as fotos</a></li>
            <?php foreach ($discoveryLandings as $landing): ?>
            <li><a href="/comprar-<?php echo rawurlencode((string) $landing['slug']); ?>">Ver <?php echo htmlspecialchars((string) $landing['name'], ENT_QUOTES, 'UTF-8'); ?></a></li>
            <?php endforeach; ?>
            <li><a href="/comparar">Comparar carros seminovos lado a lado</a></li>
            <li><a href="/seminovos">Estoque completo de seminovos</a></li>
            <li><a href="/seminovos-automaticos">Seminovos automáticos</a></li>
            <li><a href="/financiamento">Financiamento de seminovos</a></li>
            <li><a href="/compra">Vender ou dar meu carro na troca</a></li>
            <li><a href="/seminovos-canoas">Seminovos para Canoas</a></li>
            <li><a href="/seminovos-sapucaia-do-sul">Seminovos para Sapucaia do Sul</a></li>
            <li><a href="/seminovos-sao-leopoldo">Seminovos para São Leopoldo</a></li>
            <li><a href="/seminovos-porto-alegre">Seminovos para Porto Alegre</a></li>
            <li><a href="/seminovos-novo-hamburgo">Seminovos para Novo Hamburgo</a></li>
            <li><a href="/seminovos-gravatai">Seminovos para Gravataí</a></li>
            <li><a href="/regioes-atendidas">Todas as regiões atendidas</a></li>
        </ul>
    </div>
    <?php endif; ?>
</body>
</html>
