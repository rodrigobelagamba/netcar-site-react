<?php

declare(strict_types=1);

/** Guarda a capa do post no dominio Netcar para o Google nao depender de URL temporaria do Instagram. */
class InstagramPostMediaCache
{
    private const MAX_BYTES = 8_000_000;

    public function cache(array $media): string
    {
        $mediaId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($media['id'] ?? ''));
        if ($mediaId === '') {
            throw new RuntimeException('ID de midia Instagram invalido.');
        }

        $sourceUrl = $this->sourceUrl($media);
        $this->assertAllowedSource($sourceUrl);

        $dir = SocialEnv::dataDir() . '/media/instagram-posts';
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new RuntimeException('Nao foi possivel criar o cache de posts Instagram.');
        }

        $metaPath = $dir . '/' . $mediaId . '.json';
        $existing = $this->readMeta($metaPath);
        if ($existing !== null) {
            if ($this->isExistingCacheValid($existing, $dir)) {
                return $this->publicUrl($mediaId);
            }
            // Nao deixe o endpoint publico servir metadata sabidamente invalida.
            @unlink($metaPath);
        }

        $temporary = tempnam($dir, 'ig-post-');
        if ($temporary === false) {
            throw new RuntimeException('Nao foi possivel criar arquivo temporario para a midia.');
        }

        try {
            $download = $this->downloadToFile($sourceUrl, $temporary);
            $extension = $download['contentType'] === 'image/png' ? 'png' : 'jpg';
            $fileName = $mediaId . '.' . $extension;
            $target = $dir . '/' . $fileName;
            if (!rename($temporary, $target)) {
                throw new RuntimeException('Nao foi possivel salvar a midia do Instagram.');
            }
            $temporary = '';
        } catch (Throwable $error) {
            @unlink($temporary);
            throw $error;
        }

        $contentHash = hash_file('sha256', $target);
        if (!is_string($contentHash)) {
            @unlink($target);
            throw new RuntimeException('Nao foi possivel calcular o hash da midia Instagram.');
        }

        $meta = json_encode([
            'file' => $fileName,
            'contentType' => $download['contentType'],
            'sourceUrlHash' => hash('sha256', $sourceUrl),
            'contentSha256' => $contentHash,
            'cachedAt' => gmdate('c'),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        if ($meta === false) {
            @unlink($target);
            throw new RuntimeException('Nao foi possivel salvar os metadados da midia.');
        }
        try {
            $this->writeMetadataAtomically($metaPath, $meta);
        } catch (Throwable $error) {
            @unlink($target);
            throw $error;
        }

        return $this->publicUrl($mediaId);
    }

    public function publicUrl(string $mediaId): string
    {
        $base = (string) SocialEnv::get(
            'public_base_url',
            'https://www.netcarmultimarcas.com.br/social/v1'
        );

        return rtrim($base, '/') . '/instagram-post-media.php?id=' . rawurlencode($mediaId);
    }

    private function sourceUrl(array $media): string
    {
        $type = strtoupper((string) ($media['mediaType'] ?? 'IMAGE'));
        $url = $type === 'VIDEO'
            ? (string) ($media['thumbnailUrl'] ?? '')
            : (string) ($media['mediaUrl'] ?? '');

        if ($url === '') {
            $url = (string) ($media['thumbnailUrl'] ?? '');
        }

        if ($url === '') {
            throw new RuntimeException('Post Instagram sem imagem ou thumbnail publica.');
        }

        return $url;
    }

    private function assertAllowedSource(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));

        if ($scheme !== 'https' || $host === '') {
            throw new RuntimeException('URL de midia Instagram invalida.');
        }

        foreach (['cdninstagram.com', 'fbcdn.net'] as $suffix) {
            if ($host === $suffix || substr($host, -strlen('.' . $suffix)) === '.' . $suffix) {
                return;
            }
        }

        throw new RuntimeException('Host de midia Instagram nao permitido.');
    }

    private function downloadToFile(string $url, string $target): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('Cliente HTTP para midia indisponivel.');
        }

        $handle = fopen($target, 'wb');
        if ($handle === false) {
            throw new RuntimeException('Nao foi possivel abrir o cache temporario da midia.');
        }

        $curl = curl_init($url);
        if ($curl === false) {
            fclose($handle);
            throw new RuntimeException('Nao foi possivel iniciar o download da midia.');
        }

        $bytes = 0;
        $tooLarge = false;
        $writeFailed = false;
        curl_setopt_array($curl, [
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_FAILONERROR => false,
            CURLOPT_USERAGENT => 'Netcar Instagram GBP Sync/1.0',
            CURLOPT_HTTPHEADER => ['Accept: image/jpeg,image/png;q=0.9'],
            CURLOPT_WRITEFUNCTION => static function ($curlHandle, string $chunk) use (
                $handle,
                &$bytes,
                &$tooLarge,
                &$writeFailed
            ): int {
                $length = strlen($chunk);
                if ($bytes + $length > self::MAX_BYTES) {
                    $tooLarge = true;
                    return 0;
                }

                $written = fwrite($handle, $chunk);
                if ($written === false || $written !== $length) {
                    $writeFailed = true;
                    return 0;
                }
                $bytes += $written;
                return $written;
            },
        ]);
        if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
            curl_setopt($curl, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
        }

        $downloaded = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $contentType = strtolower(trim((string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE)));
        $contentType = trim(explode(';', $contentType)[0] ?? '');
        $error = curl_error($curl);
        if (PHP_VERSION_ID < 80000) {
            curl_close($curl);
        }
        fclose($handle);

        if ($tooLarge) {
            throw new RuntimeException('Tamanho de imagem Instagram fora do limite seguro.');
        }
        if ($writeFailed) {
            throw new RuntimeException('Falha ao gravar midia Instagram no cache temporario.');
        }
        if ($downloaded === false || $status !== 200) {
            throw new RuntimeException('Falha ao baixar midia Instagram' . ($error !== '' ? ': ' . $error : '.'));
        }

        $bytes = $this->validateImageFile($target, $contentType);

        return ['contentType' => $contentType, 'bytes' => $bytes];
    }

    protected function isExistingCacheValid(array $meta, string $dir): bool
    {
        $fileName = basename((string) ($meta['file'] ?? ''));
        $contentType = (string) ($meta['contentType'] ?? '');
        $expectedHash = strtolower((string) ($meta['contentSha256'] ?? ''));
        if ($fileName === '' || !preg_match('/^[a-f0-9]{64}$/', $expectedHash)) {
            return false;
        }

        $path = rtrim($dir, '/') . '/' . $fileName;
        try {
            $this->validateImageFile($path, $contentType, $expectedHash);
            return true;
        } catch (Throwable $error) {
            return false;
        }
    }

    protected function writeMetadataAtomically(string $path, string $json): void
    {
        $temporary = tempnam(dirname($path), 'ig-meta-');
        if ($temporary === false) {
            throw new RuntimeException('Nao foi possivel criar metadata temporaria da midia.');
        }
        if (file_put_contents($temporary, $json, LOCK_EX) === false) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel salvar os metadados da midia.');
        }
        if (!rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException('Nao foi possivel ativar os metadados da midia.');
        }
    }

    private function validateImageFile(string $path, string $contentType, ?string $expectedHash = null): int
    {
        if (!is_file($path) || !in_array($contentType, ['image/jpeg', 'image/png'], true)) {
            throw new RuntimeException('Formato de imagem Instagram nao aceito: ' . $contentType);
        }

        clearstatcache(true, $path);
        $bytes = filesize($path);
        if ($bytes === false || $bytes < 512 || $bytes > self::MAX_BYTES) {
            throw new RuntimeException('Tamanho de imagem Instagram fora do limite seguro.');
        }

        $prefix = file_get_contents($path, false, null, 0, 8);
        if ($prefix === false) {
            throw new RuntimeException('Nao foi possivel validar a midia Instagram.');
        }
        $isJpeg = substr($prefix, 0, 3) === "\xFF\xD8\xFF";
        $isPng = substr($prefix, 0, 8) === "\x89PNG\r\n\x1A\n";
        if (($contentType === 'image/jpeg' && !$isJpeg) || ($contentType === 'image/png' && !$isPng)) {
            throw new RuntimeException('Conteudo da midia nao corresponde ao formato informado.');
        }

        if (function_exists('getimagesize')) {
            $dimensions = @getimagesize($path);
            if (!is_array($dimensions) || ($dimensions[0] ?? 0) < 250 || ($dimensions[1] ?? 0) < 250) {
                throw new RuntimeException('Imagem Instagram abaixo do minimo de 250x250 para o Google.');
            }
        }

        if ($expectedHash !== null) {
            $actualHash = hash_file('sha256', $path);
            if (!is_string($actualHash) || !hash_equals($expectedHash, strtolower($actualHash))) {
                throw new RuntimeException('Hash da midia Instagram nao confere.');
            }
        }

        return $bytes;
    }

    private function readMeta(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $decoded = json_decode((string) file_get_contents($path), true);
        return is_array($decoded) && !empty($decoded['file']) ? $decoded : null;
    }
}
