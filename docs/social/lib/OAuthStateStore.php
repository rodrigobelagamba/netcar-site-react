<?php

declare(strict_types=1);

/** Nonces OAuth de uso unico, armazenados fora do webroot. */
final class OAuthStateStore
{
    private string $path;
    private string $lockPath;

    public function __construct(?string $path = null)
    {
        $this->path = $path ?? SocialEnv::privateDataDir() . '/oauth-states.json';
        $this->lockPath = $this->path . '.lock';
    }

    public function issue(string $provider): string
    {
        if (!in_array($provider, ['google', 'meta'], true)) {
            throw new RuntimeException('Provider OAuth invalido.');
        }

        return $this->withLock(function () use ($provider): string {
            $state = bin2hex(random_bytes(32));
            $all = $this->load();
            $this->prune($all);
            $all[$state] = [
                'provider' => $provider,
                'expiresAt' => time() + 600,
            ];
            $this->save($all);
            return $state;
        });
    }

    public function consume(string $state, string $provider): bool
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $state)
            || !in_array($provider, ['google', 'meta'], true)
        ) {
            return false;
        }

        return $this->withLock(function () use ($state, $provider): bool {
            $all = $this->load();
            $record = $all[$state] ?? null;
            // Remove mesmo quando o provider nao coincide: nonce continua sendo de uso unico.
            unset($all[$state]);
            $this->prune($all);
            $this->save($all);

            return is_array($record)
                && ($record['provider'] ?? '') === $provider
                && (int) ($record['expiresAt'] ?? 0) >= time();
        });
    }

    private function load(): array
    {
        if (!is_file($this->path)) {
            return [];
        }
        $contents = file_get_contents($this->path);
        $decoded = $contents === false ? null : json_decode($contents, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Estado OAuth esta corrompido.');
        }
        return $decoded;
    }

    private function save(array $states): void
    {
        $json = json_encode($states, JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('Nao foi possivel salvar estado OAuth.');
        }

        $temporary = tempnam(dirname($this->path), '.oauth-states-');
        if ($temporary === false) {
            throw new RuntimeException('Nao foi possivel criar estado OAuth temporario.');
        }
        if (file_put_contents($temporary, $json, LOCK_EX) === false) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel salvar estado OAuth.');
        }
        @chmod($temporary, 0600);
        if (!rename($temporary, $this->path)) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel ativar estado OAuth.');
        }
        @chmod($this->path, 0600);
    }

    private function withLock(callable $operation)
    {
        $dir = dirname($this->path);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Diretorio do estado OAuth indisponivel.');
        }

        $handle = fopen($this->lockPath, 'c+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            if (is_resource($handle)) {
                fclose($handle);
            }
            throw new RuntimeException('Nao foi possivel obter lock do estado OAuth.');
        }
        @chmod($this->lockPath, 0600);

        try {
            return $operation();
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function prune(array &$states): void
    {
        foreach ($states as $key => $record) {
            if (!is_array($record) || (int) ($record['expiresAt'] ?? 0) < time()) {
                unset($states[$key]);
            }
        }
    }
}
