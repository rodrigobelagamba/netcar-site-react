<?php
/**
 * HTML com conteúdo real para crawlers/bots nas rotas principais da SPA.
 * Usuários normais continuam no React (index.html).
 */

require_once __DIR__ . '/seo/helpers.php';

function netcar_render_demand_links($limit = null)
{
    $file = __DIR__ . '/seo/landings.json';
    $items = is_readable($file)
        ? json_decode((string) @file_get_contents($file), true)
        : array();
    echo '<ul>';
    echo '<li><a href="' . SEO_SITE_URL . '/comparar">Comparar carros seminovos lado a lado</a></li>';
    echo '<li><a href="' . SEO_SITE_URL . '/seminovos-automaticos">Seminovos automáticos</a></li>';
    $rendered = 0;
    if (is_array($items)) {
        $typeOrder = array('modelo' => 0, 'faixa' => 1, 'combustivel' => 2, 'categoria' => 3, 'marca' => 4);
        usort($items, function ($left, $right) use ($typeOrder) {
            $leftType = isset($left['type']) ? (string) $left['type'] : '';
            $rightType = isset($right['type']) ? (string) $right['type'] : '';
            $leftOrder = isset($typeOrder[$leftType]) ? $typeOrder[$leftType] : 99;
            $rightOrder = isset($typeOrder[$rightType]) ? $typeOrder[$rightType] : 99;
            if ($leftOrder !== $rightOrder) return $leftOrder <=> $rightOrder;
            $leftPriority = empty($left['footerPriority']) ? 1 : 0;
            $rightPriority = empty($right['footerPriority']) ? 1 : 0;
            if ($leftPriority !== $rightPriority) return $leftPriority <=> $rightPriority;
            return strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? ''));
        });
        foreach ($items as $landing) {
            if (
                ($limit !== null && $rendered >= $limit) ||
                empty($landing['indexable']) ||
                empty($landing['slug']) ||
                empty($landing['name'])
            ) {
                continue;
            }
            echo '<li><a href="' . SEO_SITE_URL . '/comprar-'
                . rawurlencode((string) $landing['slug']) . '">'
                . htmlspecialchars((string) $landing['name'], ENT_QUOTES, 'UTF-8')
                . '</a></li>';
            $rendered++;
        }
    }
    echo '</ul>';
}

$page = seo_resolve_page();
if ($page === null) {
    header('Location: /');
    exit;
}

$vehicles = in_array($page, ['home', 'seminovos'], true) ? seo_fetch_available_vehicles() : [];

switch ($page) {
    case 'home':
        $title = 'Carros Seminovos em Esteio | Netcar Multimarcas';
        $description = 'Encontre carros seminovos em Esteio, com estoque selecionado, financiamento, garantia e o pós-venda Nethelp. Consulte a equipe da Netcar.';
        $canonical = SEO_SITE_URL . '/';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Seminovos em Esteio/RS com Garantia</h1>';
        echo '<p class="intro">A Netcar Multimarcas vende seminovos vistoriados em Esteio/RS desde 1997. ';
        echo 'Duas lojas na Av. Presidente Vargas (740 e 1106), financiamento facilitado, Fábrica de Valor e pós-venda Nethelp.</p>';
        echo '<h2>Destaques do estoque</h2>';
        seo_render_vehicle_list($vehicles, 12);
        echo '<p><a href="' . SEO_SITE_URL . '/seminovos">Ver todos os seminovos disponíveis</a></p>';
        echo '<h2>Encontre por modelo, perfil ou orçamento</h2>';
        netcar_render_demand_links(14);
        echo '<h2>Atendimento regional</h2>';
        echo '<p>Consulte estoque e pré-avaliação antes de viajar. As lojas físicas ficam somente na Av. Presidente Vargas, em Esteio.</p>';
        echo '<p><a href="' . SEO_SITE_URL . '/regioes-atendidas">Ver regiões atendidas</a></p>';
        echo '<ul>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-canoas">Seminovos para Canoas</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-sapucaia-do-sul">Seminovos para Sapucaia do Sul</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-sao-leopoldo">Seminovos para São Leopoldo</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-novo-hamburgo">Seminovos para Novo Hamburgo</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-cachoeirinha">Seminovos para Cachoeirinha</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-gravatai">Seminovos para Gravataí</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-porto-alegre">Seminovos para Porto Alegre</a></li>';
        echo '</ul>';
        break;

    case 'seminovos':
        $title = 'Carros Seminovos à Venda em Esteio/RS | Netcar Multimarcas';
        $description = 'Confira o estoque de seminovos da Netcar em Esteio. Filtre por marca, modelo, ano e preço. Vistoriados e com garantia.';
        $canonical = SEO_SITE_URL . '/seminovos';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Carros Seminovos à Venda em Esteio/RS</h1>';
        echo '<p class="intro">Estoque atualizado de seminovos na Netcar Multimarcas. Veículos vistoriados, com garantia e financiamento. ';
        echo count($vehicles) . ' veículos disponíveis.</p>';
        seo_render_vehicle_list($vehicles);
        echo '<h2>Outras formas de encontrar seu carro</h2>';
        netcar_render_demand_links();
        break;

    case 'sobre':
        $title = 'Sobre a Netcar Multimarcas | Revenda em Esteio';
        $description = 'Conheça a Netcar Multimarcas em Esteio/RS: Fábrica de Valor, garantia, Nethelp e duas lojas. Seminovos com procedência desde 1997.';
        $canonical = SEO_SITE_URL . '/sobre';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Sobre a Netcar Multimarcas</h1>';
        echo '<p class="intro">Desde 1997, a Netcar seleciona seminovos com histórico, qualidade e transparência em Esteio/RS.</p>';
        echo '<h2>Nossa história</h2>';
        echo '<p>Somos uma revenda multimarcas com duas lojas no Centro de Esteio, na Av. Presidente Vargas. ';
        echo 'Cada veículo passa pela Fábrica de Valor, com mais de 60 itens verificados antes da venda.</p>';
        echo '<h2>Diferenciais</h2>';
        echo '<ul>';
        echo '<li>Fábrica de Valor — vistoria completa</li>';
        echo '<li>Garantia e procedência</li>';
        echo '<li>Financiamento facilitado</li>';
        echo '<li>Nethelp — pós-venda exclusivo</li>';
        echo '</ul>';
        echo '<p><a href="' . SEO_SITE_URL . '/seminovos">Ver estoque de seminovos</a></p>';
        break;

    case 'contato':
        $title = 'Contato | Netcar Multimarcas — 2 Lojas Esteio';
        $description = 'WhatsApp (51) 99729-3118. Av. Presidente Vargas 740 e 1106, Esteio/RS.';
        $canonical = SEO_SITE_URL . '/contato';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Fale com a Netcar Multimarcas</h1>';
        echo '<p class="intro">Entre em contato para comprar, vender ou financiar seu seminovo em Esteio/RS.</p>';
        echo '<h2>Nossas lojas</h2>';
        echo '<address>';
        echo '<p><strong>Matriz</strong><br />Av. Presidente Vargas, 740 — Centro — Esteio/RS — CEP 93260-048<br /><a href="tel:+555134737900">Tel: (51) 3473-7900</a></p>';
        echo '<p><strong>Filial</strong><br />Av. Presidente Vargas, 1106 — Centro — Esteio/RS — CEP 93260-001<br /><a href="tel:+555130333900">Tel: (51) 3033-3900</a></p>';
        echo '</address>';
        echo '<p><a href="https://wa.me/5551997293118?text=Ol%C3%A1%21%20Vim%20pelo%20site%20da%20Netcar%20e%20quero%20mais%20informa%C3%A7%C3%B5es.">WhatsApp: (51) 99729-3118</a><br /><a href="mailto:contato@netcarmultimarcas.com.br">E-mail: contato@netcarmultimarcas.com.br</a></p>';
        echo '<p>Horário: Seg–Sex 9h–18h · Sáb 9h–16h30</p>';
        break;

    case 'compra':
        $title = 'Venda seu Carro | Netcar Multimarcas Esteio';
        $description = 'Venda seu carro para a Netcar Multimarcas em Esteio/RS. Avaliação gratuita e valores justos.';
        $canonical = SEO_SITE_URL . '/compra';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Venda seu carro para a Netcar</h1>';
        echo '<p class="intro">Avaliamos e compramos seu veículo em Esteio/RS. Processo rápido, seguro e sem complicações.</p>';
        echo '<p><a href="https://wa.me/5551997293118?text=Ol%C3%A1%21%20Quero%20avaliar%20meu%20carro%20para%20venda%20ou%20troca%20na%20Netcar.">Avaliar pelo WhatsApp: (51) 99729-3118</a></p>';
        break;

    case 'blog':
        $title = 'Blog | Netcar Multimarcas';
        $description = 'Notícias e dicas sobre seminovos, mercado automotivo e a Netcar Multimarcas em Esteio/RS.';
        $canonical = SEO_SITE_URL . '/blog';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Blog Netcar Multimarcas</h1>';
        echo '<p class="intro">Conteúdo sobre seminovos, dicas de compra e novidades da Netcar em Esteio/RS.</p>';
        break;
}

seo_render_foot();
