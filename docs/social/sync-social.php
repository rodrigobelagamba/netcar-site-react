<?php

declare(strict_types=1);

/**
 * Sync social cache — Google Reviews + Instagram Stories
 *
 * CLI:  php sync-social.php
 * HTTP: GET /social/v1/sync-social.php?key=SEU_SYNC_SECRET
 * Cron KingHost (2x/dia reviews, a cada 15 min stories):
 *   0 6,18 * * * curl -s "https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?key=...&reviews_only=1"
 *   (cron) a cada 15 min: curl -s ".../social/v1/sync-social.php?key=...&stories_only=1"
 */

require_once __DIR__ . '/lib/bootstrap.php';

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');

    $providedKey = $_GET['key'] ?? '';
    $expectedKey = SocialEnv::get('sync.secret', '');

    if ($expectedKey === '' || !hash_equals($expectedKey, $providedKey)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$reviewsOnly = isset($_GET['reviews_only']);
$storiesOnly = isset($_GET['stories_only']);

try {
    $runner = new SocialSyncRunner();
    $result = $runner->run(!$storiesOnly, !$reviewsOnly);

    $json = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($isCli) {
        echo $json . PHP_EOL;
        exit($result['success'] ? 0 : 1);
    }

    echo $json;
} catch (Throwable $e) {
    if ($isCli) {
        fwrite(STDERR, $e->getMessage() . PHP_EOL);
        exit(1);
    }

    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
