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
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-nova-santa-rita">Seminovos para Nova Santa Rita</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-sao-leopoldo">Seminovos para São Leopoldo</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-novo-hamburgo">Seminovos para Novo Hamburgo</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-cachoeirinha">Seminovos para Cachoeirinha</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-gravatai">Seminovos para Gravataí</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-porto-alegre">Seminovos para Porto Alegre</a></li>';
        echo '<li><a href="' . SEO_SITE_URL . '/seminovos-estancia-velha">Seminovos para Estância Velha</a></li>';
        echo '</ul>';
        break;

    case 'seminovos':
        $title = 'Carros Seminovos e Usados em Esteio/RS | Netcar Multimarcas';
        $description = 'Veja carros seminovos e usados à venda na Netcar em Esteio/RS. Consulte fotos, preço e ano dos veículos disponíveis.';
        $canonical = SEO_SITE_URL . '/seminovos';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Carros seminovos e usados em Esteio/RS</h1>';
        echo '<p class="intro">Estoque disponível nas duas lojas da Netcar, na Av. Presidente Vargas, em Esteio. Veja fotos, preço e ano. ';
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
        echo '<p><strong>Matriz</strong><br />Av. Presidente Vargas, 740 — Centro — Esteio/RS — CEP 93260-490<br /><a href="tel:+555134737900">Tel: (51) 3473-7900</a></p>';
        echo '<p><strong>Filial</strong><br />Av. Presidente Vargas, 1106 — Centro — Esteio/RS — CEP 93260-048<br /><a href="tel:+555130333900">Tel: (51) 3033-3900</a></p>';
        echo '</address>';
        echo '<p><a href="https://wa.me/5551997293118?text=Ol%C3%A1%21%20Vim%20pelo%20site%20da%20Netcar%20e%20quero%20mais%20informa%C3%A7%C3%B5es.">WhatsApp: (51) 99729-3118</a><br /><a href="mailto:contato@netcarmultimarcas.com.br">E-mail: contato@netcarmultimarcas.com.br</a></p>';
        echo '<p>Horário: Seg–Sex 9h–18h · Sáb 9h–16h30</p>';
        break;

    case 'compra':
        $title = 'Netcar - Venda ou troque seu carro em Esteio';
        $description = 'Venda ou troque seu carro na Netcar, em Esteio. Aceitamos veículos financiados, sujeitos à avaliação presencial e à análise dos documentos.';
        $canonical = SEO_SITE_URL . '/compra';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Quer vender ou trocar seu carro?</h1>';
        echo '<p class="intro">Você envia os dados, traz o veículo para avaliação e recebe uma proposta da Netcar. ';
        echo 'Se houver financiamento em aberto, calculamos a quitação dentro da negociação.</p>';
        echo '<h2>Como funciona a venda ou troca</h2>';
        echo '<ol><li>Conte modelo, ano, km e se ainda tem financiamento</li>';
        echo '<li>Traga o veículo e os documentos para a avaliação presencial</li>';
        echo '<li>Se houver acordo, escolha entre vender ou usar o valor na troca</li></ol>';
        echo '<p>Atendemos vendedores de Esteio, Canoas, Sapucaia do Sul, São Leopoldo, Novo Hamburgo, Gravataí, Cachoeirinha e região metropolitana de Porto Alegre.</p>';
        echo '<h2>O que a Netcar resolve na negociação</h2>';
        echo '<p>Venda direta ou troca por um carro do estoque.</p>';
        echo '<ul><li><strong>Sem anúncio particular:</strong> Você negocia diretamente com a loja, sem receber visitas de desconhecidos.</li>';
        echo '<li><strong>Avaliação explicada:</strong> Estado do carro, versão, quilometragem e mercado entram na análise.</li>';
        echo '<li><strong>Financiamento em aberto:</strong> O saldo para quitação pode ser calculado dentro da negociação.</li>';
        echo '<li><strong>Venda ou troca:</strong> Você pode receber uma proposta de compra ou usar o valor em outro carro.</li></ul>';
        echo '<h2>Quais veículos compramos diretamente?</h2>';
        echo '<p>Estes são os critérios iniciais. A compra depende da avaliação do carro, da documentação e do interesse da loja naquele modelo.</p>';
        echo '<ul><li>No máximo 6 anos de uso</li><li>Até 80.000 km rodados</li>';
        echo '<li>Primeiro emplacamento no Rio Grande do Sul</li><li>Sem origem de locadora</li>';
        echo '<li>Sem passagem por leilão, sinistro, furto ou roubo</li></ul>';
        echo '<p><strong>Na troca, esses limites não se aplicam.</strong> O seu carro pode ser avaliado como parte da negociação, conforme vistoria e documentação.</p>';
        echo '<h2>Começar avaliação pelo WhatsApp</h2>';
        echo '<p>Envie modelo, ano e quilometragem. A equipe usa esses dados para iniciar a avaliação e combinar a vistoria.</p>';
        $purchaseMessage = 'Estava olhando o site da Netcar e gostaria de vender meu carro para a Netcar.';
        echo '<p><a href="https://wa.me/5551997293118?text=' . rawurlencode($purchaseMessage) . '">Começar pelo WhatsApp</a></p>';
        break;

    case 'blog':
        $title = 'Netcar - Blog de Seminovos';
        $description = 'Dicas de compra, financiamento e guias para quem busca seminovo em Esteio e região metropolitana de Porto Alegre.';
        $canonical = SEO_SITE_URL . '/blog';
        seo_render_head($title, $description, $canonical);
        echo '<h1>Blog Netcar</h1>';
        echo '<p class="intro">Respostas para dúvidas sobre compra, troca e financiamento de seminovos na Grande Porto Alegre.</p>';
        $blogFile = __DIR__ . '/seo/blog-index.json';
        $posts = is_readable($blogFile) ? json_decode((string) file_get_contents($blogFile), true) : [];
        if (is_array($posts)) {
            foreach ($posts as $post) {
                if (!is_array($post) || empty($post['title']) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', (string) ($post['slug'] ?? ''))) {
                    continue;
                }
                echo '<article><h2><a href="' . SEO_SITE_URL . '/blog/' . rawurlencode($post['slug']) . '">' . seo_h($post['title']) . '</a></h2>';
                $publishedAt = (string) ($post['publishedAt'] ?? '');
                if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $publishedAt, $date)) {
                    echo '<p><time datetime="' . seo_h($publishedAt) . '">' . seo_h($date[3] . '/' . $date[2] . '/' . $date[1]) . '</time>';
                    if (!empty($post['readMinutes'])) echo ' · ' . (int) $post['readMinutes'] . ' min';
                    echo '</p>';
                }
                echo '<p>' . seo_h($post['description'] ?? '') . '</p></article>';
            }
        }
        break;
}

seo_render_foot();
