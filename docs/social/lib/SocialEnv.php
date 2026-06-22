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
            __DIR__ . '/../social-config.php',
            __DIR__ . '/../data/social-config.php',
        ];

        foreach ($candidates as $path) {
            if (is_file($path)) {
                $loaded = require $path;
                if (is_array($loaded)) {
                    self::$config = $loaded;
                    return self::$config;
                }
            }
        }

        throw new RuntimeException(
            'social-config.php não encontrado. Copie social-config.example.php e preencha as credenciais.'
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
}
