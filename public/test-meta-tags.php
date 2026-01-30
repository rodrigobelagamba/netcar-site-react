<?php
/**
 * Script de teste para verificar se as meta tags estão sendo geradas corretamente
 * 
 * Uso: http://localhost/site-react/test-meta-tags.php?slug=polo-highline-2023-jbt-xx40-19629
 * ou: http://localhost/site-react/test-meta-tags.php?id=19523
 */

// Simula uma requisição para detalhe-veiculo.php
$_GET['slug'] = $_GET['slug'] ?? $_GET['id'] ?? '19523';

// Inclui o arquivo PHP principal
ob_start();
include 'detalhe-veiculo.php';
$html = ob_get_clean();

// Extrai apenas as meta tags do <head>
preg_match('/<head>(.*?)<\/head>/is', $html, $matches);
$headContent = $matches[1] ?? '';

// Extrai todas as meta tags
preg_match_all('/<meta[^>]+>/i', $headContent, $metaMatches);
$metaTags = $metaMatches[0] ?? [];

?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teste de Meta Tags - Netcar</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .meta-tag {
            background: #f8f9fa;
            padding: 10px;
            margin: 5px 0;
            border-left: 4px solid #007bff;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
        }
        .meta-tag strong {
            color: #007bff;
        }
        .info {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .success {
            color: #28a745;
            font-weight: bold;
        }
        .error {
            color: #dc3545;
            font-weight: bold;
        }
        .count {
            font-size: 18px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Teste de Meta Tags Open Graph</h1>
        
        <div class="info">
            <strong>URL testada:</strong> 
            <?php 
            if (isset($_GET['slug'])) {
                echo '/veiculo/' . htmlspecialchars($_GET['slug']);
            } elseif (isset($_GET['id'])) {
                echo '/veiculo/' . htmlspecialchars($_GET['id']);
            }
            ?>
        </div>
        
        <div class="info">
            <strong>Total de meta tags encontradas:</strong> 
            <span class="count"><?php echo count($metaTags); ?></span>
        </div>
        
        <?php 
        // Extrai informações sobre a imagem
        $ogImage = '';
        $ogImageType = '';
        foreach ($metaTags as $tag) {
            if (preg_match('/property=["\']og:image["\']\s+content=["\']([^"\']+)["\']/', $tag, $matches)) {
                $ogImage = $matches[1];
            }
            if (preg_match('/property=["\']og:image:type["\']\s+content=["\']([^"\']+)["\']/', $tag, $matches)) {
                $ogImageType = $matches[1];
            }
        }
        ?>
        
        <?php if ($ogImage): ?>
            <div class="info" style="margin-bottom: 20px;">
                <h3>📸 Informações da Imagem:</h3>
                <p><strong>URL:</strong> <a href="<?php echo htmlspecialchars($ogImage); ?>" target="_blank"><?php echo htmlspecialchars($ogImage); ?></a></p>
                <p><strong>Tipo:</strong> <span class="<?php echo $ogImageType === 'image/png' ? 'success' : ''; ?>"><?php echo htmlspecialchars($ogImageType); ?></span></p>
                <p><strong>É PNG?</strong> <span class="<?php echo $ogImageType === 'image/png' ? 'success' : 'error'; ?>"><?php echo $ogImageType === 'image/png' ? '✅ SIM' : '❌ NÃO'; ?></span></p>
                <?php if (stripos($ogImage, '.png') !== false): ?>
                    <p class="success">✅ A URL contém ".png" - Imagem PNG detectada!</p>
                <?php else: ?>
                    <p class="error">⚠️ A URL NÃO contém ".png" - Pode não ser PNG</p>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        
        <?php if (count($metaTags) > 0): ?>
            <h2>Meta Tags Encontradas:</h2>
            <?php foreach ($metaTags as $tag): ?>
                <div class="meta-tag">
                    <?php echo htmlspecialchars($tag); ?>
                </div>
            <?php endforeach; ?>
            
            <div class="info success">
                ✅ Meta tags foram geradas com sucesso!
            </div>
            
            <h2>Próximos Passos:</h2>
            <ol>
                <li>Verifique se todas as meta tags necessárias estão presentes</li>
                <li>Para testar no WhatsApp/Facebook, você precisa de uma URL pública</li>
                <li>Use <strong>ngrok</strong> ou faça deploy em produção para testar compartilhamento</li>
                <li>Use o <a href="https://developers.facebook.com/tools/debug/" target="_blank">Facebook Sharing Debugger</a> para validar</li>
            </ol>
        <?php else: ?>
            <div class="info error">
                ❌ Nenhuma meta tag encontrada! Verifique se o PHP está funcionando corretamente.
            </div>
        <?php endif; ?>
        
        <h2>Testar Outro Veículo:</h2>
        <form method="GET" style="margin-top: 20px;">
            <label>
                Slug ou ID: 
                <input type="text" name="slug" placeholder="polo-highline-2023-jbt-xx40-19629" 
                       value="<?php echo htmlspecialchars($_GET['slug'] ?? $_GET['id'] ?? ''); ?>" 
                       style="padding: 8px; width: 300px;">
            </label>
            <button type="submit" style="padding: 8px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Testar
            </button>
        </form>
    </div>
</body>
</html>
