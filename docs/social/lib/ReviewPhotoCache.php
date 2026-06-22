<?php

declare(strict_types=1);

/**
 * Baixa fotos de review do Google no sync e serve pelo nosso domínio.
 * URLs grass-cs expiram ou retornam 403 em hotlink — cache local evita isso.
 */
final class ReviewPhotoCache
{
    private const MAX_AGE_SECONDS = 30 * 86400;

    public static function resolve(string $reviewId, ?string $remoteUrl, ?string $accessToken): ?string
    {
        if (!$remoteUrl) {
            return null;
        }

        $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '', $reviewId) ?: md5($remoteUrl);
        $mediaDir = SocialEnv::dataDir() . '/media/reviews';
        if (!is_dir($mediaDir)) {
            mkdir($mediaDir, 0755, true);
        }

        $path = $mediaDir . '/' . $safeId . '.jpg';
        $publicUrl = self::publicUrl($safeId);

        if (self::isFresh($path)) {
            return $publicUrl;
        }

        $headers = ['Accept: image/*'];
        if ($accessToken) {
            $headers[] = 'Authorization: Bearer ' . $accessToken;
        }

        try {
            $response = HttpClient::fetchBinary($remoteUrl, $headers);
            if ($response['status'] === 200 && strlen($response['body']) > 512) {
                file_put_contents($path, $response['body']);
                return $publicUrl;
            }
        } catch (Throwable $e) {
            // mantém cache antigo ou fallback remoto
        }

        if (is_file($path)) {
            return $publicUrl;
        }

        return $remoteUrl;
    }

    public static function publicUrl(string $reviewId): string
    {
        $base = SocialEnv::get(
            'public_base_url',
            'https://www.netcarmultimarcas.com.br/social/v1'
        );

        return rtrim((string) $base, '/') . '/review-media.php?id=' . rawurlencode($reviewId);
    }

    private static function isFresh(string $path): bool
    {
        return is_file($path) && (time() - (int) filemtime($path)) < self::MAX_AGE_SECONDS;
    }
}
