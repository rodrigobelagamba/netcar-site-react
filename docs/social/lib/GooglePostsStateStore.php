<?php

declare(strict_types=1);

/** Estado atomico por post e por loja; tambem impede dois crons simultaneos. */
final class GooglePostsStateStore
{
    private string $statePath;
    private string $lockPath;
    private $lockHandle = null;

    public function __construct(?string $statePath = null)
    {
        $this->statePath = $statePath ?? SocialEnv::privateDataDir() . '/instagram-gbp-posts.json';
        $this->lockPath = $this->statePath . '.lock';
    }

    public function lock(): void
    {
        if ($this->lockHandle !== null) {
            return;
        }

        $dir = dirname($this->lockPath);
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new RuntimeException('Diretorio do estado GBP indisponivel.');
        }

        $handle = fopen($this->lockPath, 'c+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            if (is_resource($handle)) {
                fclose($handle);
            }
            throw new RuntimeException('Nao foi possivel obter lock do sincronizador GBP.');
        }
        $this->lockHandle = $handle;
    }

    public function load(): array
    {
        if (!is_file($this->statePath)) {
            return ['version' => 1, 'posts' => []];
        }

        $decoded = json_decode((string) file_get_contents($this->statePath), true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Estado do sincronizador GBP esta corrompido.');
        }

        $decoded['version'] = 1;
        $decoded['posts'] = is_array($decoded['posts'] ?? null) ? $decoded['posts'] : [];
        return $decoded;
    }

    public function save(array $state): void
    {
        if ($this->lockHandle === null) {
            throw new RuntimeException('Estado GBP so pode ser salvo com lock ativo.');
        }

        $state['version'] = 1;
        $state['updatedAt'] = gmdate('c');
        $json = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('Nao foi possivel codificar o estado GBP.');
        }

        $temporary = $this->statePath . '.tmp.' . getmypid();
        if (file_put_contents($temporary, $json, LOCK_EX) === false || !rename($temporary, $this->statePath)) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel salvar o estado GBP.');
        }
    }

    public function unlock(): void
    {
        if ($this->lockHandle === null) {
            return;
        }

        flock($this->lockHandle, LOCK_UN);
        fclose($this->lockHandle);
        $this->lockHandle = null;
    }

    public function __destruct()
    {
        $this->unlock();
    }
}
