<?php

declare(strict_types=1);

final class TokenStore
{
    private string $path;

    public function __construct(?string $path = null)
    {
        $this->path = $path ?? SocialEnv::cacheDir() . '/social-tokens.json';
    }

    public function all(): array
    {
        if (!is_file($this->path)) {
            return [];
        }

        $raw = file_get_contents($this->path);
        if ($raw === false) {
            return [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public function get(string $provider): array
    {
        return $this->all()[$provider] ?? [];
    }

    public function put(string $provider, array $data): void
    {
        $all = $this->all();
        $all[$provider] = array_merge($all[$provider] ?? [], $data, [
            'updatedAt' => gmdate('c'),
        ]);

        $dir = dirname($this->path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        file_put_contents(
            $this->path,
            json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }

    public function hasGoogleRefreshToken(): bool
    {
        return !empty($this->get('google')['refresh_token']);
    }

    public function hasMetaAccessToken(): bool
    {
        $meta = $this->get('meta');
        return !empty($meta['access_token']) && !empty($meta['ig_user_id']);
    }
}
