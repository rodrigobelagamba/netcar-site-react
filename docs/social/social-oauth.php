<?php

declare(strict_types=1);

/**
 * OAuth — conectar Google Business Profile + Instagram (Meta)
 *
 * GET /social/v1/social-oauth.php?provider=google|meta&action=connect|callback|status
 */

require_once __DIR__ . '/lib/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$provider = is_string($_GET['provider'] ?? null) ? $_GET['provider'] : '';
$action = is_string($_GET['action'] ?? null) ? $_GET['action'] : 'status';
$requireAdmin = static function (): void {
    $authorization = '';
    foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $headerName) {
        if (is_string($_SERVER[$headerName] ?? null) && trim($_SERVER[$headerName]) !== '') {
            $authorization = trim((string) $_SERVER[$headerName]);
            break;
        }
    }

    $providedKey = '';
    if (stripos($authorization, 'Bearer ') === 0) {
        $providedKey = trim(substr($authorization, 7));
    } elseif (is_string($_POST['key'] ?? null)) {
        // Compatibilidade com o formulario administrativo existente.
        $providedKey = (string) $_POST['key'];
    }

    $expectedKey = (string) SocialEnv::get('oauth.admin_secret', '');
    if ($expectedKey === '' || !hash_equals($expectedKey, $providedKey)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
        exit;
    }
};

try {
    if ($action === 'status') {
        $tokens = new TokenStore();
        echo json_encode([
            'success' => true,
            'google' => [
                'connected' => $tokens->hasGoogleRefreshToken(),
            ],
            'meta' => [
                'connected' => $tokens->hasMetaAccessToken(),
            ],
            'oauthProtected' => true,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if ($provider === 'google') {
        $oauth = new GoogleOAuth();

        if ($action === 'connect') {
            if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
                http_response_code(405);
                header('Allow: POST');
                echo json_encode(['success' => false, 'message' => 'Use POST autenticado.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $requireAdmin();
            $state = (new OAuthStateStore())->issue('google');
            header('Location: ' . $oauth->getAuthUrl($state), true, 303);
            exit;
        }

        if ($action === 'callback') {
            $code = is_string($_GET['code'] ?? null) ? $_GET['code'] : '';
            $state = is_string($_GET['state'] ?? null) ? $_GET['state'] : '';
            if ($code === '' || !(new OAuthStateStore())->consume($state, 'google')) {
                throw new RuntimeException('Callback Google invalido ou expirado.');
            }
            $oauth->handleCallback($code);
            echo json_encode([
                'success' => true,
                'message' => 'Google conectado. Rode sync-social.php para popular o cache.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    if ($provider === 'meta') {
        $oauth = new MetaOAuth();

        if ($action === 'connect') {
            if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
                http_response_code(405);
                header('Allow: POST');
                echo json_encode(['success' => false, 'message' => 'Use POST autenticado.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $requireAdmin();
            $state = (new OAuthStateStore())->issue('meta');
            header('Location: ' . $oauth->getAuthUrl($state), true, 303);
            exit;
        }

        if ($action === 'callback') {
            $code = is_string($_GET['code'] ?? null) ? $_GET['code'] : '';
            $state = is_string($_GET['state'] ?? null) ? $_GET['state'] : '';
            if ($code === '' || !(new OAuthStateStore())->consume($state, 'meta')) {
                throw new RuntimeException('Callback Meta invalido ou expirado.');
            }
            $oauth->handleCallback($code);
            echo json_encode([
                'success' => true,
                'message' => 'Instagram/Meta conectado. Rode sync-social.php para popular o cache.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Use provider=google|meta e action=connect|callback|status',
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Netcar social OAuth error: ' . get_class($e) . ': ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Falha ao concluir a conexao OAuth. Consulte o log do servidor.',
    ], JSON_UNESCAPED_UNICODE);
}
