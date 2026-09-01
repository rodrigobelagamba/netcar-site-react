<?php

declare(strict_types=1);

/**
 * Sync social — Google Reviews + Instagram Stories + Instagram -> GBP
 *
 * CLI:  php sync-social.php
 * HTTP: curl -H "Authorization: Bearer ..." https://.../sync-social.php
 * Cron KingHost (2x/dia reviews, a cada 15 min stories + posts):
 *   Prefira CLI ou header Authorization; query key existe apenas durante a migracao do cron legado.
 */

require_once __DIR__ . '/lib/bootstrap.php';

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

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
    } elseif (is_string($_GET['key'] ?? null)) {
        // Compatibilidade temporaria com o cron existente; migrar para Bearer.
        $providedKey = $_GET['key'];
    }
    $expectedKey = (string) SocialEnv::get('sync.secret', '');

    if ($expectedKey === '' || !hash_equals($expectedKey, $providedKey)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$reviewsOnly = isset($_GET['reviews_only']);
$storiesOnly = isset($_GET['stories_only']);
$postsOnly = isset($_GET['posts_only']);
$dryRun = isset($_GET['dry_run']) && $_GET['dry_run'] !== '0';

try {
    $runner = new SocialSyncRunner();
    if ($postsOnly) {
        $result = $runner->run(false, false, true, $dryRun);
    } elseif ($reviewsOnly) {
        $result = $runner->run(true, false, false, $dryRun);
    } elseif ($storiesOnly) {
        // Reaproveita o cron de 15 min ja existente. Enquanto disabled, posts so reporta skipped.
        $result = $runner->run(false, true, true, $dryRun);
    } else {
        $result = $runner->run(true, true, true, $dryRun);
    }

    $json = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($isCli) {
        echo $json . PHP_EOL;
        exit($result['success'] ? 0 : 1);
    }

    if (empty($result['success'])) {
        http_response_code(502);
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
