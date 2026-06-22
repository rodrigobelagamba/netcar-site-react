<?php

declare(strict_types=1);

final class GoogleOAuth
{
    private TokenStore $tokens;

    public function __construct(?TokenStore $tokens = null)
    {
        $this->tokens = $tokens ?? new TokenStore();
    }

    public function getAuthUrl(): string
    {
        $params = http_build_query([
            'client_id' => SocialEnv::get('google.client_id'),
            'redirect_uri' => SocialEnv::get('google.redirect_uri'),
            'response_type' => 'code',
            'scope' => 'https://www.googleapis.com/auth/business.manage',
            'access_type' => 'offline',
            'prompt' => 'consent',
        ]);

        return 'https://accounts.google.com/o/oauth2/v2/auth?' . $params;
    }

    public function handleCallback(string $code): void
    {
        $response = HttpClient::post('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => SocialEnv::get('google.client_id'),
            'client_secret' => SocialEnv::get('google.client_secret'),
            'redirect_uri' => SocialEnv::get('google.redirect_uri'),
            'grant_type' => 'authorization_code',
        ]);

        if ($response['status'] !== 200 || !is_array($response['body'])) {
            throw new RuntimeException('Falha ao trocar code Google: ' . $response['raw']);
        }

        $body = $response['body'];
        if (empty($body['refresh_token']) && !$this->tokens->hasGoogleRefreshToken()) {
            throw new RuntimeException(
                'Google não devolveu refresh_token. Revogue o app em myaccount.google.com/permissions e conecte de novo com prompt=consent.'
            );
        }

        $this->tokens->put('google', [
            'access_token' => $body['access_token'] ?? null,
            'refresh_token' => $body['refresh_token'] ?? $this->tokens->get('google')['refresh_token'] ?? null,
            'expires_at' => time() + (int) ($body['expires_in'] ?? 3600) - 60,
        ]);
    }

    public function getAccessToken(): string
    {
        $google = $this->tokens->get('google');

        if (!empty($google['access_token']) && !empty($google['expires_at']) && $google['expires_at'] > time()) {
            return $google['access_token'];
        }

        $refreshToken = $google['refresh_token'] ?? null;
        if (!$refreshToken) {
            throw new RuntimeException('Google refresh_token ausente. Acesse social-oauth.php?provider=google&action=connect');
        }

        $response = HttpClient::post('https://oauth2.googleapis.com/token', [
            'client_id' => SocialEnv::get('google.client_id'),
            'client_secret' => SocialEnv::get('google.client_secret'),
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token',
        ]);

        if ($response['status'] !== 200 || empty($response['body']['access_token'])) {
            throw new RuntimeException('Falha ao renovar token Google: ' . $response['raw']);
        }

        $accessToken = $response['body']['access_token'];
        $this->tokens->put('google', [
            'access_token' => $accessToken,
            'expires_at' => time() + (int) ($response['body']['expires_in'] ?? 3600) - 60,
        ]);

        return $accessToken;
    }
}
