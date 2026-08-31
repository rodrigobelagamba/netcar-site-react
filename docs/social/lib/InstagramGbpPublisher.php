<?php

declare(strict_types=1);

/**
 * Replica os posts novos do Instagram nos dois perfis GBP.
 *
 * Garantias principais:
 * - cutoff obrigatorio no modo live (nunca faz backfill acidental);
 * - estado separado por loja;
 * - marcador UTM + reconciliacao remota antes de criar;
 * - lock e escrita atomica do estado;
 * - dry-run sem download, sem estado e sem POST no Google.
 */
final class InstagramGbpPublisher
{
    private InstagramFeedClient $instagram;
    private GoogleLocalPostsClient $google;
    private InstagramPostMediaCache $mediaCache;
    private GooglePostsStateStore $stateStore;

    public function __construct(
        ?InstagramFeedClient $instagram = null,
        ?GoogleLocalPostsClient $google = null,
        ?InstagramPostMediaCache $mediaCache = null,
        ?GooglePostsStateStore $stateStore = null
    ) {
        $this->instagram = $instagram ?? new InstagramFeedClient();
        $this->google = $google ?? new GoogleLocalPostsClient();
        $this->mediaCache = $mediaCache ?? new InstagramPostMediaCache();
        $this->stateStore = $stateStore ?? new GooglePostsStateStore();
    }

    public function sync(bool $dryRun = false): array
    {
        $settings = $this->settings();
        $enabled = $settings['enabled'] === true;
        if (!$dryRun && !$enabled) {
            $this->rememberDisabled();
            return [
                'success' => true,
                'enabled' => false,
                'dryRun' => false,
                'skipped' => true,
                'message' => 'Publicacao GBP desativada. Use dry_run=1 para validar sem publicar.',
            ];
        }

        if ($dryRun) {
            $notBefore = $this->notBefore($settings, true);
            $media = $this->instagram->fetchSince($notBefore, (int) $settings['max_feed_items']);
            $locations = $this->google->listTargetLocations($settings['locations']);
            $result = $this->baseResult(true, $enabled, $notBefore, $media, $locations);
            foreach ($media as $item) {
                foreach ($locations as $location) {
                    $preview = InstagramGbpPostFactory::payload(
                        $item,
                        $location,
                        $this->mediaCache->publicUrl((string) $item['id']),
                        (string) $settings['fallback_url']
                    );
                    $result['items'][] = [
                        'instagramMediaId' => $item['id'],
                        'instagramPermalink' => $item['permalink'],
                        'publishedAt' => $item['publishedAt'],
                        'location' => $location['slug'],
                        'destinationKind' => $preview['destinationKind'],
                        'trackedUrl' => $preview['trackedUrl'],
                        'summary' => $preview['googlePayload']['summary'],
                        'mediaUrl' => $preview['googlePayload']['media'][0]['sourceUrl'],
                        'action' => 'would_create',
                    ];
                }
            }

            return $result;
        }

        // Valida as duas locations antes de alterar cutoff, descoberta ou estado local.
        $locations = $this->google->listTargetLocations($settings['locations']);
        $expectedLocationSlugs = $this->targetLocationSlugs($locations);

        $this->stateStore->lock();
        try {
            $state = $this->stateStore->load();
            $targetsChanged = $this->prepareLocationState($state, $locations);
            $requestedCutoff = $this->notBefore($settings, false);
            $wasDisabled = ($state['publisherEnabled'] ?? null) === false;
            $activationCommitted = !$wasDisabled && !$targetsChanged
                && $this->hasCommittedActivation($state, $requestedCutoff);
            $notBefore = $this->activationCutoff($state, $settings, $activationCommitted);
            $scanFrom = $this->discoveryScanFrom($state, $notBefore, $expectedLocationSlugs);
            $media = $this->instagram->fetchSince($scanFrom, (int) $settings['max_feed_items']);
            if (!$activationCommitted) {
                // Confirma o handover somente depois de ler todo o intervalo sem truncar.
                // Se a API falhar, a proxima tentativa precisa validar novamente uma
                // data recente em vez de herdar um cutoff incompleto indefinidamente.
                $state['activationCutoff'] = gmdate('c', $notBefore);
                $state['activationCompletedAt'] = gmdate('c');
            }
            $state['publisherEnabled'] = true;
            unset($state['disabledAt']);
            $this->rememberDiscoveredMedia($state, $media, $notBefore);
            $state['lastDiscoveryAt'] = gmdate('c');
            $this->stateStore->save($state);

            $result = $this->baseResult(false, true, $notBefore, $media, $locations);
            $candidates = $this->pendingMedia($state, $locations, $notBefore);
            $limit = max(1, min(10, (int) $settings['max_posts_per_run']));
            $selected = array_slice($candidates, 0, $limit);
            $result['pendingMedia'] = count($candidates);
            $result['backlogMedia'] = max(0, count($candidates) - count($selected));

            foreach ($selected as $item) {
                $this->syncMedia($item, $locations, $settings, $state, $result);
            }
            $this->collectPersistentErrors($state, $result);
            $this->pruneState($state, $expectedLocationSlugs);
            $this->stateStore->save($state);
        } finally {
            $this->stateStore->unlock();
        }

        $result['success'] = count($result['errors']) === 0;
        return $result;
    }

    private function baseResult(
        bool $dryRun,
        bool $enabled,
        int $notBefore,
        array $media,
        array $locations
    ): array {
        return [
            'success' => true,
            'enabled' => $enabled,
            'dryRun' => $dryRun,
            'notBefore' => gmdate('c', $notBefore),
            'feedChecked' => count($media),
            'eligibleMedia' => count($media),
            'locations' => array_map(static function (array $location): array {
                return [
                    'slug' => $location['slug'],
                    'id' => $location['id'],
                    'title' => $location['title'],
                ];
            }, $locations),
            'created' => 0,
            'reconciled' => 0,
            'alreadyLive' => 0,
            'deferred' => 0,
            'pendingMedia' => 0,
            'backlogMedia' => 0,
            'errors' => [],
            'items' => [],
        ];
    }

    private function activationCutoff(array $state, array $settings, bool $committed): int
    {
        $stored = strtotime((string) ($state['activationCutoff'] ?? ''));
        if ($committed && $stored !== false) {
            return $stored;
        }

        $cutoff = $this->notBefore($settings, false);
        $maxAge = max(60, min(3600, (int) $settings['max_activation_age_seconds']));
        if ($cutoff < time() - $maxAge || $cutoff > time() + 300) {
            throw new RuntimeException(
                'Ativacao bloqueada: not_before deve estar dentro da janela recente de handover do Zapier.'
            );
        }

        return $cutoff;
    }

    private function hasCommittedActivation(array $state, int $requestedCutoff): bool
    {
        $stored = strtotime((string) ($state['activationCutoff'] ?? ''));
        if ($stored === false || $stored !== $requestedCutoff) {
            return false;
        }
        if (strtotime((string) ($state['activationCompletedAt'] ?? '')) !== false) {
            return true;
        }

        // Compatibilidade com estados gravados antes de activationCompletedAt:
        // lastDiscoveryAt so avanca alem do cutoff depois de um fetch completo.
        $lastDiscovery = strtotime((string) ($state['lastDiscoveryAt'] ?? ''));
        return $lastDiscovery !== false && $lastDiscovery > $stored;
    }

    /** Registra uma pausa para que a proxima ativacao exija um novo handover recente. */
    private function rememberDisabled(): void
    {
        $this->stateStore->lock();
        try {
            $state = $this->stateStore->load();
            if (($state['publisherEnabled'] ?? null) === false) {
                return;
            }
            $state['publisherEnabled'] = false;
            $state['disabledAt'] = gmdate('c');
            $this->stateStore->save($state);
        } finally {
            $this->stateStore->unlock();
        }
    }

    private function discoveryScanFrom(array $state, int $notBefore, array $locationSlugs): int
    {
        $lastDiscovery = strtotime((string) ($state['lastDiscoveryAt'] ?? ''));
        $scanFrom = $lastDiscovery === false ? $notBefore : max($notBefore, $lastDiscovery - 3600);

        // Atualiza URLs assinadas de qualquer item que ainda precisa de retry.
        foreach ($state['posts'] ?? [] as $post) {
            if (!$this->postNeedsRetry($post, $locationSlugs)) {
                continue;
            }
            $publishedAt = strtotime((string) ($post['publishedAt'] ?? ''));
            if ($publishedAt !== false) {
                $scanFrom = max($notBefore, min($scanFrom, $publishedAt - 300));
            }
        }

        return $scanFrom;
    }

    private function rememberDiscoveredMedia(array &$state, array $media, int $notBefore): void
    {
        foreach ($media as $item) {
            $publishedAt = strtotime((string) ($item['publishedAt'] ?? ''));
            if ($publishedAt === false || $publishedAt < $notBefore || empty($item['id'])) {
                continue;
            }

            $mediaId = (string) $item['id'];
            $previous = $state['posts'][$mediaId] ?? [];
            $state['posts'][$mediaId] = array_merge($previous, [
                'instagramPermalink' => (string) ($item['permalink'] ?? ''),
                'publishedAt' => (string) $item['publishedAt'],
                'source' => $item,
                'locations' => is_array($previous['locations'] ?? null) ? $previous['locations'] : [],
            ]);
        }
    }

    private function pendingMedia(array $state, array $locations, int $notBefore): array
    {
        $pending = [];
        foreach ($state['posts'] ?? [] as $post) {
            $publishedAt = strtotime((string) ($post['publishedAt'] ?? ''));
            if ($publishedAt === false || $publishedAt < $notBefore || empty($post['source'])) {
                continue;
            }

            foreach ($locations as $location) {
                $entry = $post['locations'][$location['slug']] ?? [];
                if ($this->locationIsLive($entry)) {
                    continue;
                }
                if (($entry['status'] ?? '') === 'error' && empty($entry['retryable'])) {
                    continue;
                }
                if ($this->retryDue($entry)) {
                    $pending[] = $post['source'];
                    break;
                }
            }
        }

        usort($pending, static function (array $a, array $b): int {
            return strcmp((string) ($a['publishedAt'] ?? ''), (string) ($b['publishedAt'] ?? ''));
        });
        return $pending;
    }

    private function postNeedsWork(array $post, array $locationSlugs): bool
    {
        foreach ($locationSlugs as $slug) {
            $entry = $post['locations'][$slug] ?? [];
            if (!$this->locationIsLive($entry)) {
                return true;
            }
        }

        return false;
    }

    private function postNeedsRetry(array $post, array $locationSlugs): bool
    {
        foreach ($locationSlugs as $slug) {
            $entry = $post['locations'][$slug] ?? [];
            if ($this->locationIsLive($entry)) {
                continue;
            }
            if (($entry['status'] ?? '') === 'error' && empty($entry['retryable'])) {
                continue;
            }
            return true;
        }

        return false;
    }

    private function locationIsLive(array $entry): bool
    {
        return ($entry['status'] ?? '') === 'live'
            || strtoupper((string) ($entry['googleState'] ?? '')) === 'LIVE';
    }

    private function syncMedia(
        array $media,
        array $locations,
        array $settings,
        array &$state,
        array &$result
    ): void {
        $mediaId = (string) $media['id'];
        if (!isset($state['posts'][$mediaId]) || !is_array($state['posts'][$mediaId])) {
            $state['posts'][$mediaId] = [
                'instagramPermalink' => (string) ($media['permalink'] ?? ''),
                'publishedAt' => (string) ($media['publishedAt'] ?? ''),
                'source' => $media,
                'locations' => [],
            ];
        }

        $stableMediaUrl = null;
        foreach ($locations as $location) {
            $slug = (string) $location['slug'];
            $entry = $state['posts'][$mediaId]['locations'][$slug] ?? [];
            $entry['locationId'] = (string) $location['id'];
            $entry['locationParent'] = (string) $location['parent'];
            $status = strtoupper((string) ($entry['googleState'] ?? ''));

            if (($entry['status'] ?? '') === 'live' || $status === 'LIVE') {
                $result['alreadyLive']++;
                continue;
            }
            if (($entry['status'] ?? '') === 'error' && empty($entry['retryable'])) {
                $result['deferred']++;
                $result['errors'][] = [
                    'instagramMediaId' => $mediaId,
                    'location' => $slug,
                    'retryable' => false,
                    'persistent' => true,
                    'message' => (string) ($entry['error'] ?? 'Erro permanente pendente de resolucao.'),
                ];
                continue;
            }
            if (!$this->retryDue($entry)) {
                $result['deferred']++;
                continue;
            }

            $attemptRecorded = false;
            try {
                $preview = InstagramGbpPostFactory::payload(
                    $media,
                    $location,
                    $this->mediaCache->publicUrl($mediaId),
                    (string) $settings['fallback_url']
                );

                if (!empty($entry['googlePostName'])) {
                    try {
                        $remote = $this->google->get((string) $entry['googlePostName']);
                        $remoteState = strtoupper((string) ($remote['state'] ?? 'PROCESSING'));
                        $entry = $this->successfulEntry($entry, $remote, 'checked');
                        $state['posts'][$mediaId]['locations'][$slug] = $entry;
                        $this->stateStore->save($state);

                        if ($remoteState === 'LIVE') {
                            $result['reconciled']++;
                        } else {
                            $result['deferred']++;
                        }
                        continue;
                    } catch (GoogleLocalPostsException $error) {
                        if (!$error->isNotFound()) {
                            throw $error;
                        }

                        // O nome salvo sumiu: primeiro procura o marcador em toda a
                        // location. Somente se ele nao existir uma nova criacao e permitida.
                        unset($entry['googlePostName'], $entry['googleState']);
                        $entry['status'] = 'retrying';
                        $entry['retryable'] = true;
                        $entry['nextAttemptAt'] = null;
                        $entry['error'] = null;
                        $entry['updatedAt'] = gmdate('c');
                    }
                    $state['posts'][$mediaId]['locations'][$slug] = $entry;
                    $this->stateStore->save($state);
                }

                // Se uma execucao anterior caiu apos o POST, a UTM recupera o post remoto.
                $remote = $this->google->findByMarker((string) $location['parent'], $preview['marker']);
                if ($remote !== null) {
                    $state['posts'][$mediaId]['locations'][$slug] = $this->successfulEntry($entry, $remote, 'reconciled');
                    $this->stateStore->save($state);
                    $result['reconciled']++;
                    continue;
                }

                if ($stableMediaUrl === null) {
                    $stableMediaUrl = $this->mediaCache->cache($media);
                }
                $post = InstagramGbpPostFactory::payload(
                    $media,
                    $location,
                    $stableMediaUrl,
                    (string) $settings['fallback_url']
                );

                $entry['status'] = 'submitting';
                $entry['marker'] = $post['marker'];
                $entry['destinationKind'] = $post['destinationKind'];
                $entry['trackedUrl'] = $post['trackedUrl'];
                $entry['lastAttemptAt'] = gmdate('c');
                $entry['attempts'] = (int) ($entry['attempts'] ?? 0) + 1;
                $attemptRecorded = true;
                $state['posts'][$mediaId]['locations'][$slug] = $entry;
                $this->stateStore->save($state);

                $remote = $this->google->create((string) $location['parent'], $post['googlePayload']);
                $state['posts'][$mediaId]['locations'][$slug] = $this->successfulEntry($entry, $remote, 'created');
                $this->stateStore->save($state);
                $result['created']++;
                $result['items'][] = [
                    'instagramMediaId' => $mediaId,
                    'location' => $slug,
                    'destinationKind' => $post['destinationKind'],
                    'trackedUrl' => $post['trackedUrl'],
                    'googlePostName' => $remote['name'] ?? null,
                    'googleState' => $remote['state'] ?? null,
                    'action' => 'created',
                ];
            } catch (Throwable $e) {
                $retryable = !($e instanceof GoogleLocalPostsException) || $e->isRetryable();
                $attempts = (int) ($entry['attempts'] ?? 0) + ($attemptRecorded ? 0 : 1);
                $delay = min(21600, 900 * (2 ** min(4, max(0, $attempts - 1))));
                $entry = array_merge($entry, [
                    'status' => 'error',
                    'retryable' => $retryable,
                    'attempts' => $attempts,
                    'lastAttemptAt' => gmdate('c'),
                    'nextAttemptAt' => $retryable ? gmdate('c', time() + $delay) : null,
                    'error' => $e->getMessage(),
                ]);
                $state['posts'][$mediaId]['locations'][$slug] = $entry;
                $this->stateStore->save($state);
                $result['errors'][] = [
                    'instagramMediaId' => $mediaId,
                    'location' => $slug,
                    'retryable' => $retryable,
                    'message' => $e->getMessage(),
                ];
            }
        }
    }

    private function successfulEntry(array $entry, array $remote, string $source): array
    {
        $googleState = strtoupper((string) ($remote['state'] ?? 'PROCESSING'));
        $status = $googleState === 'LIVE' ? 'live' : 'submitted';
        if ($googleState === 'REJECTED') {
            $status = 'error';
        }

        return array_merge($entry, [
            'status' => $status,
            'source' => $source,
            'googlePostName' => $remote['name'] ?? ($entry['googlePostName'] ?? null),
            'googleState' => $googleState,
            'updatedAt' => gmdate('c'),
            'retryable' => $googleState !== 'REJECTED',
            'nextAttemptAt' => $googleState === 'PROCESSING' ? gmdate('c', time() + 900) : null,
            'error' => $googleState === 'REJECTED' ? 'Google rejeitou o post.' : null,
        ]);
    }

    private function retryDue(array $entry): bool
    {
        $next = strtotime((string) ($entry['nextAttemptAt'] ?? ''));
        return $next === false || $next <= time();
    }

    private function collectPersistentErrors(array $state, array &$result): void
    {
        $seen = [];
        foreach ($result['errors'] as $error) {
            $seen[(string) ($error['instagramMediaId'] ?? '') . '|' . (string) ($error['location'] ?? '')] = true;
        }

        foreach ($state['posts'] ?? [] as $mediaId => $post) {
            foreach ($post['locations'] ?? [] as $slug => $entry) {
                if (($entry['status'] ?? '') !== 'error') {
                    continue;
                }
                $key = $mediaId . '|' . $slug;
                if (isset($seen[$key])) {
                    continue;
                }
                $result['errors'][] = [
                    'instagramMediaId' => $mediaId,
                    'location' => $slug,
                    'retryable' => !empty($entry['retryable']),
                    'persistent' => true,
                    'nextAttemptAt' => $entry['nextAttemptAt'] ?? null,
                    'message' => (string) ($entry['error'] ?? 'Erro pendente no sincronizador GBP.'),
                ];
                $seen[$key] = true;
            }
        }
    }

    private function notBefore(array $settings, bool $dryRun): int
    {
        $raw = trim((string) ($settings['not_before'] ?? ''));
        if ($raw === '' && $dryRun) {
            return time() - (7 * 86400);
        }
        if ($raw === '') {
            throw new RuntimeException('Ativacao bloqueada: defina google_posts.not_before para nao republicar posts antigos.');
        }

        $timestamp = strtotime($raw);
        if ($timestamp === false) {
            throw new RuntimeException('google_posts.not_before possui data invalida.');
        }
        return $timestamp;
    }

    private function settings(): array
    {
        $defaults = [
            'enabled' => false,
            'not_before' => '',
            'max_feed_items' => 500,
            'max_posts_per_run' => 3,
            'max_activation_age_seconds' => 1800,
            'fallback_url' => 'https://www.netcarmultimarcas.com.br/seminovos',
            'locations' => [
                'loja_1' => '11161331340741727452',
                'loja_2' => '17013442122163034193',
            ],
        ];
        $configured = SocialEnv::get('google_posts', []);
        if (!is_array($configured)) {
            $configured = [];
        }

        // Arquivo operacional separado: ativa/desativa sem tocar nas credenciais OAuth.
        $runtimePath = SocialEnv::privateDataDir() . '/google-posts-settings.json';
        $runtime = [];
        if (is_file($runtimePath)) {
            $decoded = json_decode((string) file_get_contents($runtimePath), true);
            if (!is_array($decoded)) {
                throw new RuntimeException('data/google-posts-settings.json esta invalido.');
            }
            $runtime = array_intersect_key($decoded, array_flip(['enabled', 'not_before']));
        }

        $settings = array_merge($defaults, $configured, $runtime);
        $settings['enabled'] = $settings['enabled'] === true || $settings['enabled'] === 1;
        if (!is_array($settings['locations'])) {
            $settings['locations'] = $defaults['locations'];
        }

        return $settings;
    }

    private function pruneState(array &$state, array $locationSlugs): void
    {
        $cutoff = time() - (180 * 86400);
        foreach ($state['posts'] as $mediaId => $post) {
            $publishedAt = strtotime((string) ($post['publishedAt'] ?? ''));
            if ($publishedAt !== false
                && $publishedAt < $cutoff
                && !$this->postNeedsWork($post, $locationSlugs)
            ) {
                unset($state['posts'][$mediaId]);
            }
        }
    }

    private function targetLocationSlugs(array $locations): array
    {
        $slugs = [];
        foreach ($locations as $location) {
            $safeSlug = preg_replace('/[^a-z0-9_-]/', '', strtolower((string) ($location['slug'] ?? '')));
            if ($safeSlug !== '') {
                $slugs[] = $safeSlug;
            }
        }
        $slugs = array_values(array_unique($slugs));
        if (count($slugs) !== 2) {
            throw new RuntimeException('Sincronizador GBP exige exatamente duas locations com slugs unicos.');
        }
        return $slugs;
    }

    /**
     * Vincula o estado aos IDs reais, nao apenas aos slugs. Uma troca de destino
     * invalida o handover anterior e limpa somente as entradas da location alterada.
     */
    private function prepareLocationState(array &$state, array $locations): bool
    {
        $current = [];
        $parents = [];
        foreach ($locations as $location) {
            $slug = (string) $location['slug'];
            $current[$slug] = (string) $location['id'];
            $parents[$slug] = (string) $location['parent'];
        }

        $stored = $state['locationFingerprint'] ?? null;
        if ($stored === null) {
            // Adocao unica de estados anteriores a este hardening.
            foreach ($state['posts'] as &$post) {
                foreach ($current as $slug => $locationId) {
                    if (isset($post['locations'][$slug]) && is_array($post['locations'][$slug])) {
                        $post['locations'][$slug]['locationId'] = $locationId;
                        $post['locations'][$slug]['locationParent'] = $parents[$slug];
                    }
                }
            }
            unset($post);
            $state['locationFingerprint'] = $current;
            return false;
        }
        if (!is_array($stored)) {
            throw new RuntimeException('Fingerprint das locations Google esta invalido.');
        }
        if ($stored === $current) {
            return false;
        }

        foreach ($state['posts'] as &$post) {
            foreach ($current as $slug => $locationId) {
                $entry = $post['locations'][$slug] ?? null;
                if (is_array($entry) && (string) ($entry['locationId'] ?? '') !== $locationId) {
                    unset($post['locations'][$slug]);
                }
            }
        }
        unset($post);

        $state['locationFingerprint'] = $current;
        unset($state['activationCutoff'], $state['activationCompletedAt'], $state['lastDiscoveryAt']);
        return true;
    }
}
