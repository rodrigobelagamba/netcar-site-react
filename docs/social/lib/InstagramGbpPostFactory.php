<?php

declare(strict_types=1);

/** Regras puras de copy, URL e payload para a replica Instagram -> GBP. */
final class InstagramGbpPostFactory
{
    public static function extractVehicleUrl(string $caption): ?string
    {
        if (!preg_match(
            '~(?:^|\R)\s*An[úu]ncio\s*:\s*(https://[^\s<>"\']+)~iu',
            $caption,
            $matches
        )) {
            return null;
        }

        return self::normalizeAllowedUrl((string) $matches[1], true);
    }

    public static function destinationUrl(
        string $caption,
        string $fallbackUrl,
        ?string $resolvedVehicleUrl = null
    ): array
    {
        $vehicleUrl = self::extractVehicleUrl($caption);
        if ($vehicleUrl !== null) {
            return ['url' => $vehicleUrl, 'kind' => 'vehicle', 'source' => 'caption_url'];
        }

        if ($resolvedVehicleUrl !== null) {
            $resolved = self::normalizeAllowedUrl($resolvedVehicleUrl, true);
            if ($resolved !== null) {
                return ['url' => $resolved, 'kind' => 'vehicle', 'source' => 'stock_reference'];
            }
        }

        $fallback = self::normalizeAllowedUrl($fallbackUrl, false);
        if ($fallback === null) {
            throw new RuntimeException('google_posts.fallback_url deve apontar para o dominio oficial da Netcar.');
        }

        return ['url' => $fallback, 'kind' => 'fallback', 'source' => 'fallback'];
    }

    public static function marker(string $mediaId, string $locationSlug): string
    {
        $safeMediaId = preg_replace('/[^a-zA-Z0-9_-]/', '', $mediaId);
        $safeLocation = preg_replace('/[^a-z0-9_-]/', '', strtolower($locationSlug));
        if ($safeMediaId === '' || $safeLocation === '') {
            throw new RuntimeException('Nao foi possivel gerar marcador idempotente do post.');
        }

        return 'ig_' . $safeMediaId . '_' . $safeLocation;
    }

    public static function trackedUrl(string $destinationUrl, string $marker): string
    {
        $parts = parse_url($destinationUrl);
        if (!is_array($parts) || empty($parts['host']) || empty($parts['path'])) {
            throw new RuntimeException('URL de destino invalida.');
        }

        $query = [];
        if (!empty($parts['query'])) {
            parse_str((string) $parts['query'], $query);
        }
        $query['utm_source'] = 'google_business_profile';
        $query['utm_medium'] = 'organic_social';
        $query['utm_campaign'] = 'instagram_replica';
        $query['utm_content'] = $marker;

        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        return strtolower((string) $parts['scheme']) . '://'
            . strtolower((string) $parts['host']) . $port
            . (string) $parts['path']
            . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    public static function summary(string $caption): string
    {
        $clean = preg_replace(
            '~(?:^|\R)\s*An[úu]ncio\s*:\s*https://[^\s<>"\']+\s*~iu',
            "\n",
            trim($caption)
        );
        $clean = preg_replace(
            '/(?<![a-z0-9_])#netcar[0-9]{4,}(?![a-z0-9_])/iu',
            '',
            (string) $clean
        );
        $clean = preg_replace('/[ \t]+(?=\R|$)/u', '', (string) $clean);
        $clean = preg_replace('/(?<=\S)[ \t]{2,}(?=\S)/u', ' ', (string) $clean);
        $clean = trim((string) preg_replace('/\n{3,}/', "\n\n", (string) $clean));

        if ($clean === '') {
            $clean = 'Confira esta novidade da Netcar Multimarcas.';
        }

        if (function_exists('mb_substr')) {
            return rtrim(mb_substr($clean, 0, 1500, 'UTF-8'));
        }

        return rtrim(self::utf8Substring($clean, 1500));
    }

    public static function payload(
        array $media,
        array $location,
        string $mediaUrl,
        string $fallbackUrl,
        ?string $resolvedVehicleUrl = null,
        ?string $resolutionReason = null
    ): array
    {
        $caption = (string) ($media['caption'] ?? '');
        $mediaId = (string) ($media['id'] ?? '');
        $slug = (string) ($location['slug'] ?? '');
        $destination = self::destinationUrl($caption, $fallbackUrl, $resolvedVehicleUrl);
        $marker = self::marker($mediaId, $slug);
        $destinationReason = $destination['source'] === 'fallback'
            ? ($resolutionReason ?? 'fallback')
            : $destination['source'];
        $warningReasons = [
            'stock_api_unavailable',
            'vehicle_reference_ambiguous',
            'vehicle_not_active',
            'stock_record_ambiguous',
        ];

        return [
            'marker' => $marker,
            'destinationKind' => $destination['kind'],
            'destinationSource' => $destination['source'],
            'destinationReason' => $destinationReason,
            'destinationWarning' => in_array($destinationReason, $warningReasons, true)
                ? $destinationReason
                : null,
            'trackedUrl' => self::trackedUrl($destination['url'], $marker),
            'googlePayload' => [
                'languageCode' => 'pt-BR',
                'summary' => self::summary($caption),
                'topicType' => 'STANDARD',
                'callToAction' => [
                    'actionType' => 'LEARN_MORE',
                    'url' => self::trackedUrl($destination['url'], $marker),
                ],
                'media' => [[
                    'mediaFormat' => 'PHOTO',
                    'sourceUrl' => $mediaUrl,
                ]],
            ],
        ];
    }

    private static function normalizeAllowedUrl(string $url, bool $vehicleOnly): ?string
    {
        $url = rtrim(trim($url), ".,;:!?)]}'\"");
        $parts = parse_url($url);
        if (!is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        $path = (string) ($parts['path'] ?? '');

        if ($scheme !== 'https' || !in_array($host, ['netcarmultimarcas.com.br', 'www.netcarmultimarcas.com.br'], true)) {
            return null;
        }
        if ($vehicleOnly && strpos($path, '/veiculo/') !== 0) {
            return null;
        }
        if ($path === '' || strpos($path, '//') === 0) {
            return null;
        }

        return $url;
    }

    /** Trunca por code points sem cortar um caractere quando mbstring nao estiver disponivel. */
    private static function utf8Substring(string $value, int $maxCharacters): string
    {
        $length = strlen($value);
        $offset = 0;
        $characters = 0;
        $result = '';

        while ($offset < $length && $characters < $maxCharacters) {
            $first = ord($value[$offset]);
            if ($first <= 0x7F) {
                $sequenceLength = 1;
            } elseif ($first >= 0xC2 && $first <= 0xDF) {
                $sequenceLength = 2;
            } elseif ($first >= 0xE0 && $first <= 0xEF) {
                $sequenceLength = 3;
            } elseif ($first >= 0xF0 && $first <= 0xF4) {
                $sequenceLength = 4;
            } else {
                $offset++;
                continue;
            }

            if ($offset + $sequenceLength > $length) {
                break;
            }
            for ($index = 1; $index < $sequenceLength; $index++) {
                $continuation = ord($value[$offset + $index]);
                if ($continuation < 0x80 || $continuation > 0xBF) {
                    $sequenceLength = 0;
                    break;
                }
            }
            if ($sequenceLength === 0) {
                $offset++;
                continue;
            }

            $result .= substr($value, $offset, $sequenceLength);
            $offset += $sequenceLength;
            $characters++;
        }

        return $result;
    }
}
