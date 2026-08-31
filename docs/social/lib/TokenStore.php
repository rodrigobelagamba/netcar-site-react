<?php

declare(strict_types=1);

final class TokenStore
{
    private string $path;

    public function __construct(?string $path = null)
    {
        $this->path = $path ?? SocialEnv::privateDataDir() . '/social-tokens.json';
        if ($path === null) {
            $this->migrateLegacyStore();
        }
    }

    public function all(): array
    {
        if (!is_file($this->path)) {
            return [];
        }

        $raw = file_get_contents($this->path);
        if ($raw === false) {
            throw new RuntimeException('Nao foi possivel ler o store privado de tokens sociais.');
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Store privado de tokens sociais esta corrompido.');
        }
        return $decoded;
    }

    public function get(string $provider): array
    {
        return $this->all()[$provider] ?? [];
    }

    public function put(string $provider, array $data): void
    {
        $this->ensureDirectory();
        $this->withExclusiveLock(function () use ($provider, $data): void {
            $all = $this->all();
            $all[$provider] = array_merge($all[$provider] ?? [], $data, [
                'updatedAt' => gmdate('c'),
            ]);
            $this->writeAtomically($all);
        });
    }

    public function hasGoogleRefreshToken(): bool
    {
        return !empty($this->get('google')['refresh_token']);
    }

    public function hasMetaAccessToken(): bool
    {
        $meta = $this->get('meta');
        return !empty($meta['access_token']) && !empty($meta['ig_user_id']);
    }

    private function migrateLegacyStore(): void
    {
        $legacy = SocialEnv::cacheDir() . '/social-tokens.json';
        if (is_file($this->path) && !is_file($legacy)) {
            return;
        }
        if (!is_file($this->path) && !is_file($legacy)) {
            return;
        }

        $this->ensureDirectory();
        $this->withExclusiveLock(function () use ($legacy): void {
            if (is_file($this->path)) {
                if (is_file($legacy)) {
                    $private = json_decode((string) file_get_contents($this->path), true);
                    $legacyData = json_decode((string) file_get_contents($legacy), true);
                    if (!is_array($private) || !is_array($legacyData)) {
                        throw new RuntimeException('Store privado de tokens sociais esta invalido.');
                    }
                    $merged = array_replace_recursive($legacyData, $private);
                    if ($merged !== $private) {
                        $this->writeAtomically($merged);
                    }
                    if (!unlink($legacy)) {
                        throw new RuntimeException('Store publico legado de tokens sociais nao foi removido.');
                    }
                }
                return;
            }

            $raw = file_get_contents($legacy);
            $decoded = $raw === false ? null : json_decode($raw, true);
            if (!is_array($decoded)) {
                throw new RuntimeException('Store legado de tokens sociais esta invalido.');
            }

            $this->writeAtomically($decoded);

            // So remove o legado depois de reler e validar a copia privada.
            $verify = json_decode((string) file_get_contents($this->path), true);
            if (!is_array($verify)) {
                throw new RuntimeException('Falha ao validar a migracao dos tokens sociais.');
            }
            if (!unlink($legacy)) {
                throw new RuntimeException('Copia privada criada, mas o store publico legado nao foi removido.');
            }
        });
    }

    private function ensureDirectory(): void
    {
        $dir = dirname($this->path);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Diretorio privado dos tokens sociais indisponivel.');
        }
        @chmod($dir, 0700);
    }

    private function withExclusiveLock(callable $operation): void
    {
        $lockPath = $this->path . '.lock';
        $handle = fopen($lockPath, 'c+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            if (is_resource($handle)) {
                fclose($handle);
            }
            throw new RuntimeException('Nao foi possivel obter lock dos tokens sociais.');
        }

        @chmod($lockPath, 0600);
        try {
            $operation();
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function writeAtomically(array $data): void
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('Nao foi possivel codificar tokens sociais.');
        }

        $temporary = tempnam(dirname($this->path), 'social-tokens-');
        if ($temporary === false) {
            throw new RuntimeException('Nao foi possivel criar arquivo temporario dos tokens sociais.');
        }

        $written = file_put_contents($temporary, $json, LOCK_EX);
        if ($written !== strlen($json)) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel salvar tokens sociais.');
        }
        @chmod($temporary, 0600);

        if (!rename($temporary, $this->path)) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel ativar tokens sociais.');
        }
        @chmod($this->path, 0600);
    }
}
