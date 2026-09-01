<?php

declare(strict_types=1);

interface VehicleDestinationResolver
{
    /** @return array{url:?string,reason:string} */
    public function resolve(string $caption): array;
}

/**
 * Resolve captions de veiculo sem URL contra o estoque oficial da Netcar.
 *
 * O AutoADS inclui uma referencia nao clicavel ``#netcar<ID>`` entre as
 * hashtags. O ID precisa existir como uma unica unidade ativa; sem essa prova,
 * o publicador usa /seminovos em vez de inferir um carro pela copy.
 */
final class NetcarStockVehicleDestinationResolver implements VehicleDestinationResolver
{
    private string $apiUrl;
    private ?array $vehicles = null;
    private bool $loaded = false;
    private ?string $loadFailureReason = null;

    public function __construct(?string $apiUrl = null)
    {
        $configured = trim((string) ($apiUrl ?? SocialEnv::get(
            'google_posts.stock_api_url',
            'https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500'
        )));
        $this->apiUrl = $this->validateApiUrl($configured);
    }

    public function resolve(string $caption): array
    {
        $reference = self::referenceResult($caption);
        if ($reference['reason'] !== 'vehicle_reference_found') {
            return ['url' => null, 'reason' => $reference['reason']];
        }

        if (!$this->loaded) {
            $this->loaded = true;
            try {
                $this->vehicles = $this->fetchVehicles();
            } catch (Throwable $error) {
                $this->vehicles = [];
                $this->loadFailureReason = 'stock_api_unavailable';
                error_log('[GBP] Estoque indisponivel para resolver CTA: ' . $error->getMessage());
            }
        }
        if ($this->loadFailureReason !== null) {
            return ['url' => null, 'reason' => $this->loadFailureReason];
        }
        return self::resolveDetailedFromVehicles($caption, $this->vehicles ?? []);
    }

    public static function resolveFromVehicles(string $caption, array $vehicles): ?string
    {
        return self::resolveDetailedFromVehicles($caption, $vehicles)['url'];
    }

    /** @return array{url:?string,reason:string} */
    public static function resolveDetailedFromVehicles(string $caption, array $vehicles): array
    {
        $reference = self::referenceResult($caption);
        if ($reference['reason'] !== 'vehicle_reference_found') {
            return ['url' => null, 'reason' => $reference['reason']];
        }
        $vehicleId = (string) $reference['id'];

        $matches = [];
        foreach ($vehicles as $vehicle) {
            if (!is_array($vehicle) || (float) ($vehicle['valor'] ?? 0) <= 0) {
                continue;
            }

            $id = trim((string) ($vehicle['id'] ?? ''));
            $model = self::normalize((string) ($vehicle['modelo'] ?? ''));
            $year = (int) ($vehicle['ano'] ?? 0);
            if (!preg_match('/^[0-9]+$/', $id)
                || $id !== $vehicleId
                || $model === ''
                || $year < 1900
            ) {
                continue;
            }

            $matches[] = self::vehicleUrl($vehicle, $id, $year);
        }

        $matches = array_values(array_unique($matches));
        if (count($matches) === 1) {
            return ['url' => $matches[0], 'reason' => 'stock_reference'];
        }
        return [
            'url' => null,
            'reason' => count($matches) > 1 ? 'stock_record_ambiguous' : 'vehicle_not_active',
        ];
    }

    public static function extractVehicleId(string $caption): ?string
    {
        $result = self::referenceResult($caption);
        return $result['reason'] === 'vehicle_reference_found' ? (string) $result['id'] : null;
    }

    /** @return array{id:?string,reason:string} */
    private static function referenceResult(string $caption): array
    {
        if (!preg_match_all('/(?<![a-z0-9_])#netcar([0-9]{4,})(?![a-z0-9_])/iu', $caption, $matches)) {
            return ['id' => null, 'reason' => 'vehicle_reference_missing'];
        }
        $ids = array_values(array_unique(array_map('strval', $matches[1])));
        if (count($ids) !== 1) {
            return ['id' => null, 'reason' => 'vehicle_reference_ambiguous'];
        }
        return ['id' => $ids[0], 'reason' => 'vehicle_reference_found'];
    }

    private function fetchVehicles(): array
    {
        $ch = curl_init($this->apiUrl);
        if ($ch === false) {
            throw new RuntimeException('curl_init falhou.');
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $status !== 200) {
            throw new RuntimeException(
                $response === false ? 'falha HTTP: ' . $error : 'API retornou HTTP ' . $status
            );
        }

        $decoded = json_decode((string) $response, true);
        $vehicles = is_array($decoded) ? ($decoded['data'] ?? null) : null;
        if (!is_array($vehicles)) {
            throw new RuntimeException('resposta do estoque invalida.');
        }
        return $vehicles;
    }

    private function validateApiUrl(string $url): string
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        $path = (string) ($parts['path'] ?? '');
        if ($scheme !== 'https'
            || !in_array($host, ['netcarmultimarcas.com.br', 'www.netcarmultimarcas.com.br'], true)
            || $path !== '/api/v1/veiculos.php'
        ) {
            throw new RuntimeException('google_posts.stock_api_url deve usar a API oficial da Netcar.');
        }
        return $url;
    }

    private static function normalize(string $value): string
    {
        if (function_exists('iconv')) {
            $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
            if (is_string($ascii)) {
                $value = $ascii;
            }
        }
        $value = strtolower($value);
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $value));
    }

    private static function vehicleUrl(array $vehicle, string $id, int $year): string
    {
        $modelSlug = str_replace(' ', '-', self::normalize((string) ($vehicle['modelo'] ?? '')));
        $parts = array_values(array_filter([$modelSlug, (string) $year]));
        $plate = strtoupper((string) ($vehicle['placa'] ?? ''));
        $plate = preg_replace('/[^A-Z0-9]/', '', $plate);
        if (strlen($plate) >= 5) {
            $parts[] = strtolower(substr($plate, 0, 3) . '-xx' . substr($plate, -2));
        }
        $parts[] = $id;
        return 'https://www.netcarmultimarcas.com.br/veiculo/' . implode('-', $parts);
    }
}
