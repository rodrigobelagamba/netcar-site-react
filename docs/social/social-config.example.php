<?php

declare(strict_types=1);

/**
 * Em producao, copie para /home/USUARIO/.netcar-social/social-config.php e preencha.
 * NÃO versionar social-config.php nem qualquer token/cache privado.
 */
return [
    // Segredo para proteger sync-social.php via HTTP/cron
    'sync' => [
        'secret' => 'TROQUE_POR_UM_SECRET_FORTE',
    ],

    // Pode ser diferente do segredo do cron; protege o inicio dos fluxos OAuth.
    'oauth' => [
        'admin_secret' => 'TROQUE_POR_OUTRO_SECRET_FORTE',
    ],

    'google' => [
        // Projeto GCP: fabled-skein-484500-g7 (My Project 62332)
        'client_id' => '796541076133-rtjj5ibs0m04rfs5ae7o59eik4pao963.apps.googleusercontent.com',
        'client_secret' => 'OBTER_NO_GOOGLE_CLOUD_CONSOLE',
        'redirect_uri' => 'https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=google&action=callback',
        'primary_place_url' => 'https://www.google.com/maps/place/Netcar+Multimarcas',
        'write_review_url' => 'https://g.page/NetcarRC/review?rc',
        // Opcional: restringir locations (name completo da API)
        // 'location_names' => [
        //     'accounts/123/locations/456',
        //     'accounts/123/locations/789',
        // ],
    ],

    // Replica gratuita Instagram -> Google Business Profile (sem Zapier).
    // A ativacao live exige enabled=true E not_before explicito.
    'google_posts' => [
        'enabled' => false,
        'not_before' => '', // Ex.: 2026-09-01T00:00:00-03:00
        'max_feed_items' => 500,
        'fallback_url' => 'https://www.netcarmultimarcas.com.br/seminovos',
        'stock_api_url' => 'https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500',
        'locations' => [
            'loja_1' => '11161331340741727452',
            'loja_2' => '17013442122163034193',
        ],
    ],

    // Plano B — reviews via Outscraper enquanto GBP API não aprova
    'outscraper' => [
        'api_key' => 'OBTER_EM_APP_OUTSCRAPER_CLOUD_PROFILE',
        'queries' => [
            'ChIJSRolPVtvGZURzx88U1pB5n4', // Loja 1 — Av. Pres. Vargas 740
            'ChIJq78McFxvGZURmIl8iyKRbJY', // Loja 2 — Av. Pres. Vargas 1106
        ],
    ],

    'meta' => [
        // App Meta existente: AutoAds Analyst (já tem Instagram Graph API)
        'app_id' => '1864158561129535',
        'app_secret' => 'OBTER_NO_META_DEVELOPERS_BASIC',
        'redirect_uri' => 'https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=meta&action=callback',
        'graph_version' => 'v21.0',
    ],

    'instagram' => [
        'username' => 'netcar_rc',
        'user_id' => '17841402339444396',
        'avatar_fallback' => '/images/Logotipo7_1768863597989.png',
    ],
];
