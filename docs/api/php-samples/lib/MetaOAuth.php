<?php

declare(strict_types=1);

final class MetaOAuth
{
    private TokenStore $tokens;
    private string $graphVersion;

    public function __construct(?TokenStore $tokens = null)
    {
        $this->tokens = $tokens ?? new TokenStore();
        $this->graphVersion = SocialEnv::get('meta.graph_version', 'v21.0');
    }

    public function getAuthUrl(): string
    {
        $scopes = [
            'instagram_basic',
            'pages_show_list',
            'pages_read_engagement',
        ];

        $params = http_build_query([
            'client_id' => SocialEnv::get('meta.app_id'),
            'redirect_uri' => SocialEnv::get('meta.redirect_uri'),
            'scope' => implode(',', $scopes),
            'response_type' => 'code',
        ]);

        return 'https://www.facebook.com/' . $this->graphVersion . '/dialog/oauth?' . $params;
    }

    public function handleCallback(string $code): void
    {
        $query = http_build_query([
            'client_id' => SocialEnv::get('meta.app_id'),
            'client_secret' => SocialEnv::get('meta.app_secret'),
            'redirect_uri' => SocialEnv::get('meta.redirect_uri'),
            'code' => $code,
        ]);

        $tokenResponse = HttpClient::get(
            'https://graph.facebook.com/' . $this->graphVersion . '/oauth/access_token?' . $query
        );

        if ($tokenResponse['status'] !== 200 || empty($tokenResponse['body']['access_token'])) {
            throw new RuntimeException('Falha ao trocar code Meta: ' . $tokenResponse['raw']);
        }

        $shortToken = $tokenResponse['body']['access_token'];
        $longToken = $this->exchangeLongLivedToken($shortToken);
        $igUserId = $this->resolveInstagramUserId($longToken);

        $this->tokens->put('meta', [
            'access_token' => $longToken,
            'expires_at' => time() + (60 * 24 * 60 * 60) - 3600,
            'ig_user_id' => $igUserId,
        ]);
    }

    public function getAccessToken(): string
    {
        $meta = $this->tokens->get('meta');
        if (empty($meta['access_token'])) {
            throw new RuntimeException('Token Meta ausente. Acesse social-oauth.php?provider=meta&action=connect');
        }

        if (!empty($meta['expires_at']) && $meta['expires_at'] < time() + 86400) {
            $refreshed = $this->exchangeLongLivedToken($meta['access_token']);
            $this->tokens->put('meta', [
                'access_token' => $refreshed,
                'expires_at' => time() + (60 * 24 * 60 * 60) - 3600,
            ]);
            return $refreshed;
        }

        return $meta['access_token'];
    }

    public function getInstagramUserId(): string
    {
        $configured = SocialEnv::get('instagram.user_id');
        if ($configured) {
            return (string) $configured;
        }

        $meta = $this->tokens->get('meta');
        if (empty($meta['ig_user_id'])) {
            throw new RuntimeException('ig_user_id ausente. Reconecte Meta OAuth.');
        }

        return (string) $meta['ig_user_id'];
    }

    private function exchangeLongLivedToken(string $token): string
    {
        $query = http_build_query([
            'grant_type' => 'fb_exchange_token',
            'client_id' => SocialEnv::get('meta.app_id'),
            'client_secret' => SocialEnv::get('meta.app_secret'),
            'fb_exchange_token' => $token,
        ]);

        $response = HttpClient::get(
            'https://graph.facebook.com/' . $this->graphVersion . '/oauth/access_token?' . $query
        );

        if ($response['status'] !== 200 || empty($response['body']['access_token'])) {
            throw new RuntimeException('Falha ao gerar long-lived token Meta: ' . $response['raw']);
        }

        return $response['body']['access_token'];
    }

    private function resolveInstagramUserId(string $accessToken): string
    {
        $configured = SocialEnv::get('instagram.user_id');
        if ($configured) {
            return (string) $configured;
        }

        $pagesQuery = http_build_query([
            'fields' => 'instagram_business_account,name',
            'access_token' => $accessToken,
        ]);

        $pagesResponse = HttpClient::get(
            'https://graph.facebook.com/' . $this->graphVersion . '/me/accounts?' . $pagesQuery
        );

        if ($pagesResponse['status'] !== 200) {
            throw new RuntimeException('Falha ao listar páginas Meta: ' . $pagesResponse['raw']);
        }

        foreach ($pagesResponse['body']['data'] ?? [] as $page) {
            $igAccount = $page['instagram_business_account']['id'] ?? null;
            if ($igAccount) {
                return (string) $igAccount;
            }
        }

        throw new RuntimeException(
            'Nenhuma página Facebook com Instagram Business vinculado. Vincule @netcar_rc a uma Page no Meta Business.'
        );
    }
}
