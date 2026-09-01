<?php

declare(strict_types=1);

/**
 * Controle operacional do publicador Instagram -> GBP.
 *
 * Este arquivo e enviado por stdin ao PHP da KingHost; nao e instalado no
 * webroot. Ele nunca recebe nem imprime credenciais.
 */

function publisherControlWriteSettings(string $target, array $settings): void
{
    $directory = dirname($target);
    $json = json_encode(
        $settings,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if ($json === false) {
        throw new RuntimeException('Nao foi possivel codificar as configuracoes do publicador.');
    }

    $temporary = tempnam($directory, '.google-posts-settings-');
    if ($temporary === false) {
        throw new RuntimeException('Nao foi possivel preparar a configuracao do publicador.');
    }

    try {
        $written = file_put_contents($temporary, $json . PHP_EOL, LOCK_EX);
        if ($written !== strlen($json . PHP_EOL)) {
            throw new RuntimeException('Nao foi possivel gravar toda a configuracao do publicador.');
        }
        if (!chmod($temporary, 0600)) {
            throw new RuntimeException('Nao foi possivel proteger a configuracao do publicador.');
        }
        if (!rename($temporary, $target)) {
            throw new RuntimeException('Nao foi possivel promover a configuracao do publicador.');
        }
    } finally {
        if (is_file($temporary)) {
            unlink($temporary);
        }
    }
}

function publisherControlReadSettings(string $target): array
{
    if (!is_file($target)) {
        return [];
    }
    $decoded = json_decode((string) file_get_contents($target), true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Configuracao operacional existente esta invalida.');
    }
    return array_intersect_key($decoded, array_flip(['enabled', 'not_before']));
}

function publisherControlValidateLocations(array $posts): array
{
    $expected = [
        'loja_1' => '11161331340741727452',
        'loja_2' => '17013442122163034193',
    ];
    $locations = is_array($posts['locations'] ?? null) ? $posts['locations'] : [];
    if (count($locations) !== 2) {
        throw new RuntimeException('Operacao nao confirmou exatamente duas locations.');
    }

    $seenSlugs = [];
    $seenIds = [];
    foreach ($locations as $location) {
        $slug = (string) ($location['slug'] ?? '');
        $id = (string) ($location['id'] ?? '');
        if (!isset($expected[$slug]) || $expected[$slug] !== $id) {
            throw new RuntimeException('Operacao encontrou uma location diferente das duas lojas Netcar.');
        }
        $seenSlugs[$slug] = true;
        $seenIds[$id] = true;
    }
    if (count($seenSlugs) !== 2 || count($seenIds) !== 2) {
        throw new RuntimeException('Operacao encontrou location duplicada.');
    }

    return $locations;
}

function publisherControlRunPosts(): array
{
    return (new SocialSyncRunner())->run(false, false, true, false);
}

function publisherControlBackup(string $target, string $action): ?string
{
    if (!is_file($target)) {
        return null;
    }
    $suffix = gmdate('YmdHis') . '-' . bin2hex(random_bytes(3));
    $backup = $target . '.before-' . $action . '-' . $suffix;
    if (!copy($target, $backup) || !chmod($backup, 0600)) {
        throw new RuntimeException('Nao foi possivel criar o backup da configuracao operacional.');
    }
    return $backup;
}

$socialRoot = rtrim((string) ($argv[1] ?? ''), '/');
$action = (string) ($argv[2] ?? '');
if (!preg_match('#^[a-zA-Z0-9._/-]+$#', $socialRoot)
    || strpos('/' . $socialRoot . '/', '/../') !== false
    || !in_array($action, ['activate', 'pause'], true)
) {
    throw new RuntimeException('Parametros de controle invalidos.');
}

$bootstrap = $socialRoot . '/lib/bootstrap.php';
if (!is_file($bootstrap) || is_link($bootstrap)) {
    throw new RuntimeException('Runtime social de producao nao encontrado ou inseguro.');
}
require_once $bootstrap;

$privateDirectory = SocialEnv::privateDataDir();
$settingsPath = $privateDirectory . '/google-posts-settings.json';
if (is_link($settingsPath)
    || (file_exists($settingsPath) && !is_file($settingsPath))
) {
    throw new RuntimeException('Destino da configuracao operacional nao e arquivo regular.');
}

$previous = publisherControlReadSettings($settingsPath);
$previousNotBefore = trim((string) ($previous['not_before'] ?? ''));

if ($action === 'pause') {
    $backup = publisherControlBackup($settingsPath, $action);
    publisherControlWriteSettings($settingsPath, [
        'enabled' => false,
        'not_before' => $previousNotBefore,
    ]);
    $result = publisherControlRunPosts();
    $posts = is_array($result['posts'] ?? null) ? $result['posts'] : [];
    if (($result['success'] ?? false) !== true
        || ($posts['skipped'] ?? false) !== true
        || ($posts['enabled'] ?? true) !== false
    ) {
        throw new RuntimeException('Pausa nao foi confirmada pelo publicador.');
    }
    echo json_encode([
        'success' => true,
        'action' => 'pause',
        'enabled' => false,
        'backupCreated' => $backup !== null,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
}

// Preflight sem POST, cache de midia ou escrita de estado GBP.
$preview = (new InstagramGbpPublisher())->sync(true);
if (($preview['success'] ?? false) !== true
    || ($preview['dryRun'] ?? false) !== true
    || ($preview['enabled'] ?? true) !== false
    || (int) ($preview['created'] ?? -1) !== 0
) {
    throw new RuntimeException('Ativacao exige publicador desativado e dry-run seguro.');
}
publisherControlValidateLocations($preview);

$backup = publisherControlBackup($settingsPath, $action);
$cutoff = time() + 180;
$notBefore = gmdate('c', $cutoff);
publisherControlWriteSettings($settingsPath, [
    'enabled' => true,
    'not_before' => $notBefore,
]);

try {
    // Com cutoff tres minutos no futuro, esta execucao confirma o handover sem
    // tornar nenhuma publicacao anterior elegivel.
    $result = publisherControlRunPosts();
    $posts = is_array($result['posts'] ?? null) ? $result['posts'] : [];
    $locations = publisherControlValidateLocations($posts);
    if (($result['success'] ?? false) !== true
        || ($posts['success'] ?? false) !== true
        || ($posts['enabled'] ?? false) !== true
        || ($posts['dryRun'] ?? true) !== false
        || strtotime((string) ($posts['notBefore'] ?? '')) !== $cutoff
        || (int) ($posts['feedChecked'] ?? -1) !== 0
        || (int) ($posts['created'] ?? -1) !== 0
        || (int) ($posts['reconciled'] ?? -1) !== 0
        || (int) ($posts['alreadyLive'] ?? -1) !== 0
        || count((array) ($posts['errors'] ?? [])) !== 0
    ) {
        throw new RuntimeException('Ativacao nao confirmou um handover vazio e seguro.');
    }

    $statePath = $privateDirectory . '/instagram-gbp-posts.json';
    $state = is_file($statePath)
        ? json_decode((string) file_get_contents($statePath), true)
        : null;
    if (!is_array($state)
        || ($state['publisherEnabled'] ?? false) !== true
        || strtotime((string) ($state['activationCutoff'] ?? '')) !== $cutoff
        || strtotime((string) ($state['activationCompletedAt'] ?? '')) === false
    ) {
        throw new RuntimeException('Estado do handover nao foi persistido corretamente.');
    }
    if ((fileperms($settingsPath) & 0777) !== 0600) {
        throw new RuntimeException('Configuracao operacional ficou com permissao insegura.');
    }
} catch (Throwable $error) {
    // Falha sempre converge para disabled; nunca preserva uma ativacao incerta.
    publisherControlWriteSettings($settingsPath, [
        'enabled' => false,
        'not_before' => $previousNotBefore,
    ]);
    publisherControlRunPosts();
    throw $error;
}

echo json_encode([
    'success' => true,
    'action' => 'activate',
    'enabled' => true,
    'notBefore' => $notBefore,
    'created' => 0,
    'backupCreated' => $backup !== null,
    'locations' => $locations,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;

