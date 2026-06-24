<?php
/**
 * HTML com conteúdo real para crawlers/bots nas rotas principais da SPA.
 * Usuários normais continuam no React (index.html).
 */

require_once __DIR__ . '/seo/helpers.php';

$page = seo_resolve_page();
if ($page === null) {
    header('Location: /');
    exit;
}

$vehicles = in_array($page, ['home', 'seminovos'], true) ? seo_fetch_available_vehicles() : [];

switch ($page) {
    case 'home':
        $title = 'Seminovos em Esteio/RS | Netcar Multimarcas';
        $description = 'Seminovos vistoriados com garantia e financiamento em Esteio/RS. 2 lojas na Av. Presidente Vargas. Veja o estoque da Netcar Multimarcas.';
        $canonical = SEO_SITE_URL . '/';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Seminovos em Esteio/RS com Garantia</h1>';
        echo '<p class="intro">A Netcar Multimarcas vende seminovos vistoriados em Esteio/RS desde 1997. ';
        echo 'Duas lojas na Av. Presidente Vargas (740 e 1106), financiamento facilitado, Fábrica de Valor e pós-venda Nethelp.</p>';
        echo '<h2>Destaques do estoque</h2>';
        seo_render_vehicle_list($vehicles, 12);
        echo '<p><a href="' . SEO_SITE_URL . '/seminovos">Ver todos os seminovos disponíveis</a></p>';
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
        break;

    case 'sobre':
        $title = 'Sobre a Netcar · Seminovos desde 1997 | Netcar Multimarcas';
        $description = 'Conheça a Netcar Multimarcas: Fábrica de Valor, garantia GestAuto e 20+ anos vendendo seminovos com procedência em Esteio/RS.';
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
        $description = 'WhatsApp (51) 99887-9281. Av. Presidente Vargas 740 e 1106, Esteio/RS.';
        $canonical = SEO_SITE_URL . '/contato';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Fale com a Netcar Multimarcas</h1>';
        echo '<p class="intro">Entre em contato para comprar, vender ou financiar seu seminovo em Esteio/RS.</p>';
        echo '<h2>Nossas lojas</h2>';
        echo '<address>';
        echo '<p><strong>Matriz</strong><br />Av. Presidente Vargas, 740 — Centro — Esteio/RS — CEP 93260-048<br />Tel: (51) 3473-7900</p>';
        echo '<p><strong>Filial</strong><br />Av. Presidente Vargas, 1106 — Centro — Esteio/RS — CEP 93260-001<br />Tel: (51) 3033-3900</p>';
        echo '</address>';
        echo '<p>WhatsApp: (51) 99887-9281<br />E-mail: contato@netcarmultimarcas.com.br</p>';
        echo '<p>Horário: Seg–Sex 9h–18h · Sáb 9h–16h30</p>';
        break;

    case 'compra':
        $title = 'Venda seu Carro | Netcar Multimarcas Esteio';
        $description = 'Venda seu carro para a Netcar Multimarcas em Esteio/RS. Avaliação gratuita e valores justos.';
        $canonical = SEO_SITE_URL . '/compra';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Venda seu carro para a Netcar</h1>';
        echo '<p class="intro">Avaliamos e compramos seu veículo em Esteio/RS. Processo rápido, seguro e sem complicações.</p>';
        echo '<p>WhatsApp: (51) 99887-9281</p>';
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
