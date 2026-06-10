<?php

const SEO_SITE_URL = 'https://www.netcarmultimarcas.com.br';
const SEO_API_VEHICLES = SEO_SITE_URL . '/api/v1/veiculos.php?limit=500';

function seo_h($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function seo_fetch_json($url)
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null;
    }

    $data = json_decode($response, true);
    return is_array($data) ? $data : null;
}

function seo_mask_plate($placa)
{
    if (!$placa) {
        return '';
    }

    $clean = strtoupper(str_replace([' ', '-'], '', trim($placa)));
    if (strlen($clean) < 5) {
        return strtolower($clean);
    }

    $prefix = substr($clean, 0, 3);
    preg_match_all('/\d/', $clean, $matches);
    $digits = isset($matches[0]) ? $matches[0] : array();
    $suffix = count($digits) >= 2 ? implode('', array_slice($digits, -2)) : substr($clean, -2);

    return strtolower($prefix) . '-xx' . $suffix;
}

function seo_generate_vehicle_slug($vehicle)
{
    $parts = [];

    if (!empty($vehicle['modelo'])) {
        $modelo = trim($vehicle['modelo']);
        if (!empty($vehicle['marca']) && stripos($modelo, $vehicle['marca']) === 0) {
            $modelo = trim(substr($modelo, strlen($vehicle['marca'])));
        }

        $modeloSlug = strtolower($modelo);
        $modeloSlug = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $modeloSlug);
        $modeloSlug = preg_replace('/[^a-z0-9\s-]/', '', $modeloSlug);
        $modeloSlug = preg_replace('/\s+/', '-', $modeloSlug);
        $modeloSlug = preg_replace('/-+/', '-', $modeloSlug);
        $modeloSlug = trim($modeloSlug, '-');

        if ($modeloSlug !== '') {
            $parts[] = $modeloSlug;
        }
    }

    if (!empty($vehicle['ano'])) {
        $parts[] = (string) $vehicle['ano'];
    }

    if (!empty($vehicle['placa'])) {
        $placaSlug = seo_mask_plate($vehicle['placa']);
        if ($placaSlug !== '') {
            $parts[] = $placaSlug;
        }
    }

    $parts[] = (string) $vehicle['id'];

    return implode('-', $parts);
}

function seo_fetch_available_vehicles()
{
    $data = seo_fetch_json(SEO_API_VEHICLES);
    if (!$data || empty($data['success']) || empty($data['data']) || !is_array($data['data'])) {
        return [];
    }

    return array_values(array_filter($data['data'], function ($vehicle) {
        $valor = isset($vehicle['valor']) ? intval($vehicle['valor']) : 0;
        return $valor > 0;
    }));
}

function seo_format_price($vehicle)
{
    $formatted = strip_tags((string) (isset($vehicle['valor_formatado']) ? $vehicle['valor_formatado'] : ''));
    if ($formatted !== '') {
        return $formatted;
    }

    $value = isset($vehicle['valor']) ? intval($vehicle['valor']) : 0;
    return $value > 0 ? 'R$ ' . number_format($value, 0, ',', '.') : '';
}

function seo_vehicle_url($vehicle)
{
    return SEO_SITE_URL . '/veiculo/' . seo_generate_vehicle_slug($vehicle);
}

function seo_resolve_page()
{
    $requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
    $path = parse_url($requestUri, PHP_URL_PATH);
    $path = trim((string) $path, '/');

    if ($path === '') {
        return 'home';
    }

    $allowed = ['seminovos', 'sobre', 'contato', 'compra', 'blog'];
    return in_array($path, $allowed, true) ? $path : null;
}

function seo_render_head($title, $description, $canonical, $extraHead = '')
{
    ?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?php echo seo_h($title); ?></title>
    <meta name="description" content="<?php echo seo_h($description); ?>" />
    <link rel="canonical" href="<?php echo seo_h($canonical); ?>" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Netcar Multimarcas" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:title" content="<?php echo seo_h($title); ?>" />
    <meta property="og:description" content="<?php echo seo_h($description); ?>" />
    <meta property="og:url" content="<?php echo seo_h($canonical); ?>" />
    <meta property="og:image" content="<?php echo SEO_SITE_URL; ?>/images/loja1.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="<?php echo seo_h($title); ?>" />
    <meta name="twitter:description" content="<?php echo seo_h($description); ?>" />
    <meta name="twitter:image" content="<?php echo SEO_SITE_URL; ?>/images/loja1.jpg" />
    <?php echo $extraHead; ?>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
        h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
        h2 { font-size: 1.25rem; margin-top: 2rem; }
        p, li { font-size: 1rem; }
        .intro { color: #444; margin-bottom: 1.5rem; }
        .vehicles { list-style: none; padding: 0; margin: 0; }
        .vehicles li { padding: 12px 0; border-bottom: 1px solid #e5e5e5; }
        .vehicles a { color: #0f766e; font-weight: 600; text-decoration: none; }
        .vehicles a:hover { text-decoration: underline; }
        .meta { color: #666; font-size: 0.95rem; margin-top: 4px; }
        nav { margin: 1.5rem 0 2rem; }
        nav a { margin-right: 16px; color: #0f766e; }
        address { font-style: normal; margin-top: 1rem; }
    </style>
</head>
<body>
    <header>
        <p><strong>Netcar Multimarcas</strong> — Seminovos em Esteio/RS</p>
        <nav>
            <a href="<?php echo SEO_SITE_URL; ?>/">Home</a>
            <a href="<?php echo SEO_SITE_URL; ?>/seminovos">Seminovos</a>
            <a href="<?php echo SEO_SITE_URL; ?>/sobre">Sobre</a>
            <a href="<?php echo SEO_SITE_URL; ?>/contato">Contato</a>
        </nav>
    </header>
    <main>
<?php
}

function seo_render_foot()
{
    ?>
    </main>
    <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e5e5; color: #666; font-size: 0.9rem;">
        <p>Netcar Multimarcas · Av. Getúlio Vargas, 740 e 1106 — Centro, Esteio/RS</p>
        <p>Tel: (51) 3473-7900 · WhatsApp: (51) 99887-9281 · contato@netcarmultimarcas.com.br</p>
    </footer>
</body>
</html>
<?php
}

function seo_render_vehicle_list($vehicles, $limit = null)
{
    if ($limit !== null) {
        $vehicles = array_slice($vehicles, 0, $limit);
    }

    if (count($vehicles) === 0) {
        echo '<p>Nenhum veículo disponível no momento.</p>';
        return;
    }

    echo '<ul class="vehicles">';
    foreach ($vehicles as $vehicle) {
        $marca = isset($vehicle['marca']) ? $vehicle['marca'] : '';
        $modelo = isset($vehicle['modelo']) ? $vehicle['modelo'] : '';
        $name = trim($marca . ' ' . $modelo);
        $url = seo_vehicle_url($vehicle);
        $price = seo_format_price($vehicle);
        $km = isset($vehicle['km']) ? intval($vehicle['km']) : 0;
        $ano = isset($vehicle['ano']) ? $vehicle['ano'] : '';
        $cambio = isset($vehicle['cambio']) ? $vehicle['cambio'] : '';

        echo '<li>';
        echo '<a href="' . seo_h($url) . '">' . seo_h($name) . ' ' . seo_h($ano) . '</a>';
        echo '<div class="meta">' . seo_h($price);
        if ($km > 0) {
            echo ' · ' . seo_h(number_format($km, 0, ',', '.')) . ' km';
        }
        if ($cambio !== '') {
            echo ' · ' . seo_h($cambio);
        }
        echo '</div>';
        echo '</li>';
    }
    echo '</ul>';
}
