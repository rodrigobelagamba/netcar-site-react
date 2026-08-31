<?php

declare(strict_types=1);

final class SocialEnv
{
    private static ?array $config = null;

    public static function config(): array
    {
        if (self::$config !== null) {
            return self::$config;
        }

        $candidates = [
            self::defaultPrivateDataDir() . '/social-config.php',
            __DIR__ . '/../social-config.php',
            __DIR__ . '/../data/social-config.php',
        ];

        foreach ($candidates as $path) {
            if (is_file($path)) {
                $loaded = require $path;
                if (!is_array($loaded)) {
                    throw new RuntimeException('Arquivo de configuracao social invalido: ' . $path);
                }
                self::$config = $loaded;
                return self::$config;
            }
        }

        throw new RuntimeException(
            'social-config.php não encontrado no diretorio privado nem no local legado.'
        );
    }

    public static function get(string $key, $default = null)
    {
        $config = self::config();
        $segments = explode('.', $key);
        $value = $config;

        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    public static function dataDir(): string
    {
        return __DIR__ . '/../data';
    }

    public static function cacheDir(): string
    {
        $dir = self::dataDir() . '/cache';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir;
    }

    /** Dados secretos/operacionais fora de /www. */
    public static function privateDataDir(): string
    {
        $configured = self::get('private_data_dir', '');
        $dir = trim((string) $configured);
        if ($dir === '') {
            // Producao: /home/USUARIO/www/social/v1/lib -> /home/USUARIO/.netcar-social
            $dir = self::defaultPrivateDataDir();
        }

        if (strpos($dir, '/') !== 0 || preg_match('#(?:^|/)\.\.(?:/|$)#', $dir)) {
            throw new RuntimeException('private_data_dir deve ser um caminho absoluto e sem traversal.');
        }

        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Diretorio privado da integracao social indisponivel.');
        }
        $realDir = realpath($dir);
        $realWebRoot = realpath(dirname(__DIR__, 3));
        if ($realDir === false
            || ($realWebRoot !== false
                && ($realDir === $realWebRoot || strpos($realDir, $realWebRoot . DIRECTORY_SEPARATOR) === 0))
        ) {
            throw new RuntimeException('private_data_dir deve ficar fora do document root.');
        }
        @chmod($dir, 0700);
        return $realDir;
    }

    private static function defaultPrivateDataDir(): string
    {
        return dirname(__DIR__, 4) . '/.netcar-social';
    }
}
