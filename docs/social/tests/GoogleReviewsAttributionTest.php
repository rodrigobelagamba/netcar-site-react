<?php

declare(strict_types=1);

// Exercita o cliente real com respostas de rede locais: não acessa Google,
// credenciais, cache de produção ou fotos de clientes.
final class GoogleOAuth
{
    public function getAccessToken(): string { return 'fixture-token'; }
}

final class SocialEnv
{
    public static function get(string $key, $default = null)
    {
        return [
            // Configuracao privada anterior ainda apontando para a filial.
            'google.primary_place_url' => 'https://maps.google.com/maps?cid=10839197980729051544',
            'google.write_review_url' => 'https://g.page/r/CZiJfIsikWyWEBM/review',
        ][$key] ?? $default;
    }
}

final class ReviewPhotoCache
{
    public static function resolve(...$args): ?string { return null; }
}

final class HttpClient
{
    public static function get(string $url, array $headers = []): array
    {
        if (strpos($url, 'mybusinessaccountmanagement.googleapis.com') !== false) {
            $body = ['accounts' => [['name' => 'accounts/1']]];
        } elseif (strpos($url, 'mybusinessbusinessinformation.googleapis.com') !== false) {
            $body = ['locations' => array_map(static fn($number) => [
                'name' => 'locations/' . $number,
                'title' => $number === 740 ? 'Netcar Multimarcas' : 'Netcar Multimarcas - Loja 2',
                'storefrontAddress' => ['addressLines' => ['Av. Presidente Vargas, ' . $number]],
                'metadata' => [
                    'mapsUri' => 'https://maps.google.com/maps?cid=' . $number,
                    'newReviewUri' => 'https://example.test/write/' . $number,
                ],
            ], [740, 1106])];
        } elseif (preg_match('#/locations/(740|1106)/reviews\?#', $url, $match)) {
            $number = (int) $match[1];
            $body = [
                'totalReviewCount' => $number === 740 ? 500 : 300,
                'averageRating' => $number === 740 ? 4.9 : 4.8,
                'reviews' => [[
                    'reviewId' => 'review-' . $number,
                    'starRating' => 'FIVE',
                    'comment' => 'Atendimento da unidade ' . $number,
                    'createTime' => '2026-11-13T10:00:00Z',
                ]],
            ];
        } else {
            throw new RuntimeException('Requisicao inesperada na fixture.');
        }
        return ['status' => 200, 'body' => $body];
    }
}

function expectAttribution(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

require_once __DIR__ . '/../lib/GoogleReviewsClient.php';
$result = (new GoogleReviewsClient())->syncAll();
expectAttribution($result['summary']['totalCount'] === 800, 'Manter o total das duas unidades.');
expectAttribution($result['summary']['scope'] === 'all_locations', 'Identificar o resumo agregado.');
expectAttribution($result['summary']['locationCount'] === 2, 'Contar fontes reais do resumo.');
expectAttribution($result['summary']['placeUrl'] === 'https://maps.google.com/maps?cid=9144067949621682127', 'Configuracao antiga nao pode desviar o destino comercial do perfil principal.');
expectAttribution($result['summary']['writeReviewUrl'] === 'https://g.page/r/Cc8fPFNaQeZ-EBM/review', 'Novo pedido de avaliacao deve usar o link oficial principal mesmo com config antiga.');
expectAttribution($result['summary']['units'][1]['totalCount'] === 300, 'Preservar contagem da filial separada.');
expectAttribution($result['summary']['units'][1]['writeReviewUrl'] === 'https://example.test/write/1106', 'Usar o link oficial da unidade para escrever avaliacao.');
expectAttribution($result['reviews'][1]['reviewUrl'] === 'https://maps.google.com/maps?cid=1106', 'Preservar destino da avaliacao individual.');
expectAttribution($result['reviews'][0]['locationTitle'] === 'Netcar Multimarcas', 'Renomeacao nao deve excluir matriz do sync.');

// Carrega a funcao real do endpoint, descartando a resposta do seed local.
$_SERVER['REQUEST_METHOD'] = 'GET';
ob_start();
require __DIR__ . '/../google-reviews.php';
ob_end_clean();

$legacy = $result;
unset($legacy['summary']['scope'], $legacy['summary']['locationCount'], $legacy['summary']['units']);
$legacy['summary']['placeUrl'] = 'https://maps.google.com/maps?cid=10839197980729051544';
$legacy['summary']['writeReviewUrl'] = 'https://g.page/r/CZiJfIsikWyWEBM/review';
$normalized = normalizeReviewsResponse($legacy, false, 1, 1);
expectAttribution($normalized['summary']['scope'] === 'all_locations', 'Reconhecer cache legado agregado antes de paginar.');
expectAttribution(!isset($normalized['summary']['locationCount']), 'Nao inventar contagem de locais do cache legado.');
expectAttribution($normalized['summary']['totalCount'] === 800, 'Nao reduzir total ao tamanho da pagina.');
expectAttribution($normalized['summary']['placeUrl'] === $result['summary']['placeUrl'], 'Cache legado deve abrir perfil principal no resumo.');
expectAttribution($normalized['summary']['writeReviewUrl'] === $result['summary']['writeReviewUrl'], 'Cache legado deve convidar avaliacao somente no principal.');
expectAttribution($normalized['summary']['rating'] === $result['summary']['rating'], 'Destino comercial nao pode mudar nota agregada.');

$stale = normalizeReviewsResponse($legacy, true, 2, 1);
expectAttribution($stale['stale'] === true, 'Preservar aviso de cache desatualizado.');
expectAttribution($stale['summary']['writeReviewUrl'] === $result['summary']['writeReviewUrl'], 'Backup/seed desatualizado tambem deve convidar para o principal.');
expectAttribution($stale['reviews'][0]['reviewUrl'] === 'https://maps.google.com/maps?cid=1106', 'Normalizar resumo nao pode reatribuir review historico da filial.');

$metadata = normalizeReviewsResponse($result);
expectAttribution($metadata['summary']['units'] === $result['summary']['units'], 'Preservar todos os metadados individuais de ambas as lojas.');
expectAttribution($metadata['summary']['locationCount'] === 2, 'Nao converter resumo de duas lojas em uma fonte.');
$withoutSummary = normalizeReviewsResponse(['reviews' => $result['reviews']]);
expectAttribution($withoutSummary['summary']['placeUrl'] === $result['summary']['placeUrl'], 'Fallback sem summary deve abrir o principal.');
expectAttribution($withoutSummary['summary']['writeReviewUrl'] === $result['summary']['writeReviewUrl'], 'Fallback sem summary deve usar link oficial principal.');
$legacy['reviews'] = [$legacy['reviews'][0]];
$partial = normalizeReviewsResponse($legacy);
expectAttribution(!isset($partial['summary']['scope']), 'Uma amostra de uma loja nao prova escopo de uma unica unidade.');

echo "Google reviews attribution OK\n";
