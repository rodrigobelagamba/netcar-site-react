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
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    // Se não encontrar, redireciona para React app (que vai buscar os dados)
    header('Location: /veiculo/' . $vehicleId);
    exit;
}

$data = json_decode($response, true);

if (!$data || !$data['success'] || empty($data['data'])) {
    header('Location: /veiculo/' . $vehicleId);
    exit;
}

$vehicle = $data['data'][0];

// Prepara dados para meta tags
$marca = isset($vehicle['marca']) ? $vehicle['marca'] : '';
$modelo = isset($vehicle['modelo']) ? $vehicle['modelo'] : '';
$ano = isset($vehicle['ano']) ? $vehicle['ano'] : '';
$placa = isset($vehicle['placa']) ? $vehicle['placa'] : '';
$cor = isset($vehicle['cor']) ? $vehicle['cor'] : '';
$preco = isset($vehicle['valor']) ? $vehicle['valor'] : 0;
$km = isset($vehicle['km']) ? $vehicle['km'] : 0;
$combustivel = isset($vehicle['combustivel']) ? $vehicle['combustivel'] : '';
$cambio = isset($vehicle['cambio']) ? $vehicle['cambio'] : '';
$valorFormatado = isset($vehicle['valor_formatado']) ? $vehicle['valor_formatado'] : '';

// Função para mascarar placa (ex: ABC1234 -> abc-xx34)
function maskPlate($placa) {
    if (!$placa) return '';
    $placaLower = strtolower(trim($placa));
    if (strlen($placaLower) >= 7) {
        return substr($placaLower, 0, 3) . '-' . substr($placaLower, -2);
    }
    return $placaLower;
}

// Formata título completo: "HYUNDAI HB20 UNIQUE 1.0 2019"
$titleParts = [];
if ($marca) {
    $titleParts[] = strtoupper($marca);
}
if ($modelo) {
    $titleParts[] = strtoupper($modelo);
}
if ($ano) {
    $titleParts[] = $ano;
}
$ogTitle = implode(' ', $titleParts);

// Formata descrição detalhada: "2019 - 135.000km • Flex • MANUAL • MARROM"
$descriptionParts = [];
// Ano e KM juntos com " - " entre eles
if ($ano && $km > 0) {
    $kmFormatado = number_format($km, 0, '.', '.');
    $descriptionParts[] = $ano . ' - ' . $kmFormatado . 'km';
} elseif ($ano) {
    $descriptionParts[] = $ano;
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

// Busca primeira imagem JPG nas imagens full (alta resolução) para aparecer GRANDE EM CIMA
// IMPORTANTE: WhatsApp precisa de pelo menos 300px de largura para mostrar imagem grande em cima
// Thumbnails são muito pequenas e aparecem ao lado, não em cima
$imagem = '';
$imagensFull = !empty($vehicle['imagens']['full']) && is_array($vehicle['imagens']['full']) ? $vehicle['imagens']['full'] : [];
$imagensThumb = !empty($vehicle['imagens']['thumb']) && is_array($vehicle['imagens']['thumb']) ? $vehicle['imagens']['thumb'] : [];

// Função auxiliar para verificar se é JPG (case-insensitive)
function isJpgImage($img) {
    if (!$img || !is_string($img)) return false;
    $imgLower = strtolower(trim($img));
    // Verifica se termina com .jpg ou .jpeg ou contém no caminho
    return (substr($imgLower, -4) === '.jpg' || substr($imgLower, -5) === '.jpeg' || 
            (strpos($imgLower, '.jpg') !== false || strpos($imgLower, '.jpeg') !== false));
}

// PRIORIDADE 1: Busca primeira imagem JPG nas imagens full (alta resolução - aparece grande em cima)
if (!empty($imagensFull)) {
    foreach ($imagensFull as $img) {
        if ($img && is_string($img) && isJpgImage($img)) {
            $imagem = trim($img);
            break; // Para na primeira JPG encontrada nas imagens full
        }
    }
}

// PRIORIDADE 2: Se não encontrou JPG nas full, usa primeira imagem full disponível
if (empty($imagem) && !empty($imagensFull[0]) && is_string($imagensFull[0])) {
    $imagem = trim($imagensFull[0]);
}

// PRIORIDADE 3: Fallback - primeira JPG nas thumbnails (se não houver imagens full)
if (empty($imagem) && !empty($imagensThumb)) {
    foreach ($imagensThumb as $img) {
        if ($img && is_string($img) && isJpgImage($img)) {
            $imagem = trim($img);
            break;
        }
    }
}

// PRIORIDADE 4: Fallback final - primeira thumbnail disponível
if (empty($imagem) && !empty($imagensThumb[0]) && is_string($imagensThumb[0])) {
    $imagem = trim($imagensThumb[0]);
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

// Prepara URL de redirecionamento (preserva slug se disponível)
$redirectUrl = '/veiculo/' . $vehicleId;
if (isset($_GET['slug'])) {
    $redirectUrl = '/veiculo/' . $_GET['slug'];
}

// URL da página (usa slug se disponível, senão usa ID)
$pageUrl = $baseUrl . $redirectUrl;

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
    <title><?php echo htmlspecialchars($ogTitle . ' | Netcar', ENT_QUOTES, 'UTF-8'); ?></title>
    <meta name="description" content="<?php echo htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8'); ?>" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:site_name" content="Netcar" />
    <meta property="og:title" content="<?php echo htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8'); ?>" />
    <meta property="og:description" content="<?php echo htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8'); ?>" />
    <!-- DEBUG: Imagem selecionada: <?php echo htmlspecialchars($imagem ?: 'NENHUMA', ENT_QUOTES, 'UTF-8'); ?> -->
    <!-- DEBUG: URL final: <?php echo htmlspecialchars($imagemUrl, ENT_QUOTES, 'UTF-8'); ?> -->
    <!-- DEBUG: É JPG? <?php echo isJpgImage($imagem) ? 'SIM' : 'NÃO'; ?> -->
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
    // Detecta o tipo de imagem baseado na extensão
    // Verifica se a imagem selecionada é JPG
    $isJpgSelected = isJpgImage($imagem);
    $imageType = 'image/jpeg'; // padrão (JPG)
    if ($isJpgSelected || stripos($imagemUrl, '.jpg') !== false || stripos($imagemUrl, '.jpeg') !== false) {
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
    <meta property="product:availability" content="in stock" />
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
      "name": "<?php echo htmlspecialchars($marca . ' ' . $modelo . ' ' . $ano, ENT_QUOTES, 'UTF-8'); ?>",
      "brand": {
        "@type": "Brand",
        "name": "<?php echo htmlspecialchars($marca, ENT_QUOTES, 'UTF-8'); ?>"
      },
      "model": "<?php echo htmlspecialchars($modelo, ENT_QUOTES, 'UTF-8'); ?>",
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
        "availability": "https://schema.org/InStock",
        "url": "<?php echo htmlspecialchars($pageUrl, ENT_QUOTES, 'UTF-8'); ?>",
        "seller": {
          "@type": "AutoDealer",
          "name": "Netcar Multimarcas",
          "url": "https://www.netcarmultimarcas.com.br"
        }
      }
      <?php if ($placa): ?>
      ,
      "identifier": "<?php echo htmlspecialchars(strtoupper($placa), ENT_QUOTES, 'UTF-8'); ?>"
      <?php endif; ?>
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
    <!-- Bot detectado - mostra conteúdo básico para crawlers -->
    <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1><?php echo htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8'); ?></h1>
        <p>Seminovo é na Netcar</p>
        <p>Preço: R$ <?php echo number_format($preco, 0, ',', '.'); ?></p>
        <?php if ($marca && $modelo): ?>
        <p><?php echo htmlspecialchars($marca . ' ' . $modelo, ENT_QUOTES, 'UTF-8'); ?></p>
        <?php endif; ?>
        <p><a href="<?php echo $redirectUrl; ?>">Ver detalhes completos</a></p>
    </div>
    <?php endif; ?>
</body>
</html>
