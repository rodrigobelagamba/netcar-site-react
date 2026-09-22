<?php
// Executa o renderizador real (sem API/rede) para as duas rotas corrigidas.
// Uso: php scripts/tests/seo-page-content.php /compra (ou /blog).
$route = $argv[1] ?? '';
if (!in_array($route, ['/compra', '/blog'], true)) {
    fwrite(STDERR, "Informe /compra ou /blog\n");
    exit(1);
}
$_SERVER['REQUEST_URI'] = $route;
ob_start();
require __DIR__ . '/../../public/seo-pagina.php';
$html = ob_get_clean();
$errors = [];
function check_content($condition, $message)
{
    global $errors;
    if (!$condition) $errors[] = $message;
}
check_content(substr_count($html, '<h1>') === 1, 'H1 único');
check_content(strpos($html, 'rel="canonical" href="' . SEO_SITE_URL . $route . '"') !== false, 'Canônica preservada');
check_content(stripos($html, 'noindex') === false, 'Página não deve receber noindex');
if ($route === '/compra') {
    foreach ([
        'Quer vender ou trocar seu carro?',
        'calculamos a quitação dentro da negociação.',
        'Quais veículos compramos diretamente?',
        'No máximo 6 anos de uso',
        'Até 80.000 km rodados',
        'Primeiro emplacamento no Rio Grande do Sul',
        'Sem origem de locadora',
        'Sem passagem por leilão, sinistro, furto ou roubo',
        'Na troca, esses limites não se aplicam.',
        'conforme vistoria e documentação.',
    ] as $text) {
        check_content(strpos($html, $text) !== false, 'Conteúdo ausente: ' . $text);
    }
    check_content(strpos($html, '<ol>') !== false, 'Etapas da avaliação ausentes');
    check_content(strpos($html, 'valores justos') === false, 'Promessa genérica antiga permanece');
    check_content(strpos($html, 'https://wa.me/5551997293118?text=') !== false, 'Contato ausente');
} else {
    $posts = json_decode(file_get_contents(__DIR__ . '/../../public/seo/blog-index.json'), true);
    check_content(is_array($posts) && count($posts) > 0, 'Índice de artigos vazio');
    $previousPosition = -1;
    foreach ($posts as $post) {
        $link = 'href="' . SEO_SITE_URL . '/blog/' . rawurlencode($post['slug']) . '"';
        check_content(substr_count($html, $link) === 1, 'Link ausente ou duplicado: ' . $post['slug']);
        $position = strpos($html, $link);
        check_content($position !== false && $position > $previousPosition, 'Ordem de publicação divergente');
        $previousPosition = $position;
        check_content(strpos($html, seo_h($post['title'])) !== false, 'Título escapado ausente');
        check_content(strpos($html, seo_h($post['description'])) !== false, 'Resumo escapado ausente');
        check_content(strpos($html, 'datetime="' . seo_h($post['publishedAt']) . '"') !== false, 'Data ausente');
    }
}
if ($errors) {
    fwrite(STDERR, implode("\n", $errors) . "\n");
    exit(1);
}
echo "Render PHP validado: " . $route . "\n";
