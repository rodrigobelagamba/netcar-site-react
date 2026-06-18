<?php

declare(strict_types=1);

/**
 * OAuth — conectar Google Business Profile + Instagram (Meta)
 *
 * GET /api/v1/social-oauth.php?provider=google|meta&action=connect|callback|status
 */

require_once __DIR__ . '/lib/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

$provider = $_GET['provider'] ?? '';
$action = $_GET['action'] ?? 'status';

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
                'ig_user_id' => $tokens->get('meta')['ig_user_id'] ?? null,
            ],
            'connect_urls' => [
                'google' => '/api/v1/social-oauth.php?provider=google&action=connect',
                'meta' => '/api/v1/social-oauth.php?provider=meta&action=connect',
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if ($provider === 'google') {
        $oauth = new GoogleOAuth();

        if ($action === 'connect') {
            header('Location: ' . $oauth->getAuthUrl());
            exit;
        }

        if ($action === 'callback') {
            $code = $_GET['code'] ?? '';
            if ($code === '') {
                throw new RuntimeException('Parâmetro code ausente');
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
            header('Location: ' . $oauth->getAuthUrl());
            exit;
        }

        if ($action === 'callback') {
            $code = $_GET['code'] ?? '';
            if ($code === '') {
                throw new RuntimeException('Parâmetro code ausente');
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
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
