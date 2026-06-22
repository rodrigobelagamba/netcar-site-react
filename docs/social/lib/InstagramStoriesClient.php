<?php

declare(strict_types=1);

final class InstagramStoriesClient
{
    private MetaOAuth $oauth;
    private string $graphVersion;

    public function __construct(?MetaOAuth $oauth = null)
    {
        $this->oauth = $oauth ?? new MetaOAuth();
        $this->graphVersion = SocialEnv::get('meta.graph_version', 'v21.0');
    }

    public function syncAll(): array
    {
        $accessToken = $this->oauth->getAccessToken();
        $igUserId = $this->oauth->getInstagramUserId();

        $profileQuery = http_build_query([
            'fields' => 'username,name,profile_picture_url',
            'access_token' => $accessToken,
        ]);

        $profileResponse = HttpClient::get(
            'https://graph.facebook.com/' . $this->graphVersion . '/' . $igUserId . '?' . $profileQuery
        );

        if ($profileResponse['status'] !== 200) {
            throw new RuntimeException('Falha ao buscar perfil Instagram: ' . $profileResponse['raw']);
        }

        $profileBody = $profileResponse['body'] ?? [];
        $username = $profileBody['username'] ?? SocialEnv::get('instagram.username', 'netcar_rc');

        $storiesQuery = http_build_query([
            'fields' => 'id,media_type,media_url,thumbnail_url,timestamp,caption',
            'access_token' => $accessToken,
        ]);

        $storiesResponse = HttpClient::get(
            'https://graph.facebook.com/' . $this->graphVersion . '/' . $igUserId . '/stories?' . $storiesQuery
        );

        if ($storiesResponse['status'] !== 200) {
            throw new RuntimeException('Falha ao buscar stories Instagram: ' . $storiesResponse['raw']);
        }

        $stories = [];
        foreach ($storiesResponse['body']['data'] ?? [] as $item) {
            $stories[] = $this->mapStory($item, $profileBody);
        }

        return [
            'success' => true,
            'stale' => false,
            'syncedAt' => gmdate('c'),
            'profile' => [
                'username' => $username,
                'displayName' => $profileBody['name'] ?? 'Netcar',
                'avatarUrl' => $profileBody['profile_picture_url']
                    ?? SocialEnv::get('instagram.avatar_fallback', '/images/Logotipo7_1768863597989.png'),
                'followUrl' => 'https://www.instagram.com/' . $username,
            ],
            'stories' => $stories,
        ];
    }

    private function mapStory(array $item, array $profile): array
    {
        $id = (string) ($item['id'] ?? uniqid('story_'));
        $mediaType = strtoupper($item['media_type'] ?? 'IMAGE');
        $cover = $item['thumbnail_url'] ?? $item['media_url'] ?? '';
        $full = $item['media_url'] ?? $cover;
        $timestamp = $item['timestamp'] ?? null;

        return [
            'id' => $id,
            'title' => $profile['name'] ?? 'Netcar',
            'coverImage' => $cover,
            'relativeTime' => $this->formatRelativeTime($timestamp),
            'publishedAt' => $timestamp,
            'expiresAt' => $timestamp ? gmdate('c', strtotime($timestamp) + 86400) : null,
            'items' => [[
                'id' => $id,
                'type' => $mediaType === 'VIDEO' ? 'video' : 'image',
                'url' => $full,
                'previewUrl' => $cover,
                'durationMs' => $mediaType === 'VIDEO' ? 5000 : 5000,
                'caption' => $item['caption'] ?? null,
            ]],
        ];
    }

    private function formatRelativeTime(?string $isoDate): string
    {
        if (!$isoDate) {
            return '';
        }

        $timestamp = strtotime($isoDate);
        if ($timestamp === false) {
            return '';
        }

        $diff = time() - $timestamp;
        if ($diff < 3600) {
            return 'agora';
        }
        if ($diff < 86400) {
            return 'há ' . max(1, (int) floor($diff / 3600)) . ' h';
        }

        return 'há ' . max(1, (int) floor($diff / 86400)) . ' d';
    }
}
