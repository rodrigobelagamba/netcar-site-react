<?php

declare(strict_types=1);

final class SocialSyncRunner
{
    public function run(bool $reviews = true, bool $stories = true): array
    {
        $result = [
            'success' => true,
            'syncedAt' => gmdate('c'),
            'reviews' => null,
            'stories' => null,
            'errors' => [],
        ];

        if ($reviews) {
            try {
                $reviewsData = (new GoogleReviewsClient())->syncAll();
                $this->writeCache('google-reviews', $reviewsData);
                $result['reviews'] = [
                    'count' => count($reviewsData['reviews'] ?? []),
                    'totalCount' => $reviewsData['summary']['totalCount'] ?? 0,
                ];
            } catch (Throwable $e) {
                $result['success'] = false;
                $result['errors']['reviews'] = $e->getMessage();
            }
        }

        if ($stories) {
            try {
                $storiesData = (new InstagramStoriesClient())->syncAll();
                $this->writeCache('stories', $storiesData);
                $result['stories'] = [
                    'count' => count($storiesData['stories'] ?? []),
                ];
            } catch (Throwable $e) {
                $result['success'] = false;
                $result['errors']['stories'] = $e->getMessage();
            }
        }

        return $result;
    }

    private function writeCache(string $basename, array $data): void
    {
        $cacheDir = SocialEnv::cacheDir();
        $target = $cacheDir . '/' . $basename . '.json';
        $backup = $cacheDir . '/' . $basename . '.backup.json';

        if (is_file($target)) {
            copy($target, $backup);
        }

        file_put_contents(
            $target,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }
}
