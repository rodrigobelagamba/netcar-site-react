# 📚 API Netcar - Documentação

Este diretório contém todos os endpoints e hooks React Query para interagir com a API Netcar.

## 📖 Documentação Completa da API

Para documentação completa da API, consulte:

- **[README_API.md](./README_API.md)** - Documentação completa da API com exemplos e endpoints
- **[openapi.yaml](./openapi.yaml)** - Especificação OpenAPI 3.0 da API
- **[API_CHANGELOG.md](./API_CHANGELOG.md)** - Histórico de mudanças da API
- **[Postman Collection](./postman/)** - Collection e Environment do Postman para testes

## 📁 Estrutura

```
src/catalog/
├── endpoints/          # Funções de chamada à API
│   ├── vehicles.ts    # API de Veículos
│   ├── categorias.ts  # API de Categorias
│   ├── stock.ts       # API de Stock (marcas, modelos, etc.)
│   ├── depoimentos.ts # API de Depoimentos
│   ├── site.ts        # API do Site (banners, informações, etc.)
│   └── info.ts        # API Info (dados da tabela info)
├── queries/           # Hooks React Query
│   ├── useVehicleQuery.ts
│   ├── useVehiclesQuery.ts
│   ├── useCategoriasQuery.ts
│   ├── useStockQuery.ts
│   ├── useDepoimentosQuery.ts
│   ├── useSiteQuery.ts
│   └── useInfoQuery.ts
├── axios-instance.ts  # Configuração do Axios
└── index.ts           # Barrel exports
```

## 🚀 Uso Rápido

### Importação

```typescript
// Importação individual
import { useVehiclesQuery } from '@/catalog/queries/useVehiclesQuery';
import { useBrandsQuery } from '@/catalog/queries/useStockQuery';

// Ou usando barrel export
import { useVehiclesQuery, useBrandsQuery, useDepoimentosQuery } from '@/catalog';
```

### Exemplos de Uso

#### 🚗 API Veículos

```typescript
import { useVehiclesQuery, useVehicleQuery, useOpcionaisQuery } from '@/catalog';

function VehiclesList() {
  const { data: vehicles, isLoading } = useVehiclesQuery({
    montadora: 'FORD',
    valor_min: 30000,
    valor_max: 60000,
    cambio: 'AUTOMATICO',
    opcionais: 'ar_condicionado,alarme',
    limit: 20,
    offset: 0
  });

  const { data: opcionais } = useOpcionaisQuery();

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div>
      {vehicles?.map(vehicle => (
        <div key={vehicle.id}>
          <h3>{vehicle.name}</h3>
          <p>Preço: {vehicle.valor_formatado}</p>
          {vehicle.pdf_url && (
            <a href={vehicle.pdf_url} target="_blank">Ver PDF</a>
          )}
          {vehicle.opcionais && (
            <ul>
              {vehicle.opcionais.map(opt => (
                <li key={opt.tag}>{opt.descricao}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### 📊 API Stock

```typescript
import { useBrandsQuery, useModelsByBrandQuery } from '@/catalog';

function Filters() {
  const { data: brands } = useBrandsQuery();
  const { data: models } = useModelsByBrandQuery('FORD');

  return (
    <select>
      {brands?.map(brand => (
        <option key={brand.id} value={brand.nome}>{brand.nome}</option>
      ))}
    </select>
  );
}
```

#### 💬 API Depoimentos

```typescript
import { useDepoimentosQuery } from '@/catalog';

function DepoimentosList() {
  const { data: depoimentos } = useDepoimentosQuery({ limit: 10 });

  return (
    <div>
      {depoimentos?.map(depoimento => (
        <div key={depoimento.id}>
          <h3>{depoimento.nome}</h3>
          <p>{depoimento.texto}</p>
        </div>
      ))}
    </div>
  );
}
```

#### 🏢 API Site

```typescript
import { useBannersQuery, usePhoneQuery, useWhatsAppQuery } from '@/catalog';

function HomePage() {
  const { data: banners } = useBannersQuery();
  const { data: phone } = usePhoneQuery('Loja1');
  const { data: whatsapp } = useWhatsAppQuery();

  return (
    <div>
      {banners?.map(banner => (
        <img key={banner.id} src={banner.imagem} alt={banner.titulo} />
      ))}
      <a href={`tel:${phone?.telefone}`}>{phone?.telefone}</a>
      <a href={whatsapp?.link}>WhatsApp</a>
    </div>
  );
}
```

## 📋 Endpoints Disponíveis

### 🚗 API Veículos

- `fetchVehicles(query?)` - Lista veículos com filtros opcionais
- `fetchVehicleById(id)` - Busca veículo por ID
- `fetchVehicleBySlug(slug)` - Busca veículo por slug
- `fetchOpcionais()` - Lista todos os opcionais disponíveis

**Hooks:**
- `useVehiclesQuery(query?)` - Hook para listar veículos
- `useVehicleQuery(slug)` - Hook para buscar veículo específico
- `useOpcionaisQuery()` - Hook para listar opcionais disponíveis

**Filtros disponíveis:**
- `montadora` ou `marca` - Fabricante do veículo
- `modelo` - Modelo do veículo
- `valor_min` ou `precoMin` - Valor mínimo
- `valor_max` ou `precoMax` - Valor máximo
- `ano_min` ou `anoMin` - Ano mínimo
- `ano_max` ou `anoMax` - Ano máximo
- `cambio` - Tipo de câmbio (MANUAL, AUTOMATICO)
- `combustivel` - Tipo de combustível (Flex, Gasolina, etc.)
- `motor` - Motorização (1.0, 1.6, 2.0, etc.)
- `cor` - Cor do veículo (BRANCA, PRETA, PRATA, etc.)
- `categoria` - Categoria do veículo (ex: SUV, Sedan, Hatchback)
- `opcional` - Tag de um único opcional (ex: ar_condicionado)
- `opcionais` - Múltiplas tags separadas por vírgula (ex: ar_condicionado,alarme)
- `limit` - Número máximo de resultados
- `offset` - Número de registros para pular

**Campos adicionais:**
- `pdf` - Nome do arquivo PDF
- `pdf_url` - URL completa do PDF
- `opcionais` - Array com tag e descrição dos opcionais
- `categoria` - Categoria do veículo (ex: SUV, Sedan, Hatchback)

### 🏷️ API Categorias

- `fetchCategorias()` - Lista todas as categorias de veículos disponíveis

**Hooks:**
- `useCategoriasQuery()` - Hook para listar categorias disponíveis

**Notas:**
- Retorna apenas categorias de veículos com valor diferente de zero
- As categorias são ordenadas alfabeticamente
- Exemplo de retorno: `["Hatchback", "Sedan", "SUV"]`

### 📊 API Stock

- `fetchBrands()` - Lista todas as marcas
- `fetchModels()` - Lista todos os modelos
- `fetchModelsByBrand(brand)` - Lista modelos por marca
- `fetchYears()` - Lista todos os anos
- `fetchColors()` - Lista todas as cores
- `fetchMotors()` - Lista todas as motorizações
- `fetchFuels()` - Lista todos os combustíveis
- `fetchTransmissions()` - Lista todas as transmissões
- `fetchPriceRanges()` - Lista faixas de preço
- `fetchAllStockData()` - Retorna todos os dados de uma vez

**Hooks:**
- `useBrandsQuery()` - Hook para marcas
- `useModelsQuery()` - Hook para modelos
- `useModelsByBrandQuery(brand)` - Hook para modelos por marca
- `useYearsQuery()` - Hook para anos
- `useColorsQuery()` - Hook para cores
- `useMotorsQuery()` - Hook para motores
- `useFuelsQuery()` - Hook para combustíveis
- `useTransmissionsQuery()` - Hook para transmissões
- `usePriceRangesQuery()` - Hook para faixas de preço
- `useAllStockDataQuery()` - Hook para todos os dados

### 💬 API Depoimentos

- `fetchDepoimentos(limit?, offset?)` - Lista depoimentos com paginação
- `fetchDepoimentoById(id)` - Busca depoimento por ID
- `fetchDepoimentosGallery()` - Retorna galeria de depoimentos
- `fetchDepoimentosWithImages()` - Lista depoimentos com imagens
- `fetchDepoimentosAlt()` - Método alternativo

**Hooks:**
- `useDepoimentosQuery(options?)` - Hook para listar depoimentos
- `useDepoimentoQuery(id)` - Hook para depoimento específico
- `useDepoimentosGalleryQuery()` - Hook para galeria
- `useDepoimentosWithImagesQuery()` - Hook para depoimentos com imagens
- `useDepoimentosAltQuery()` - Hook método alternativo

### 🏢 API Site

- `fetchSiteInfo()` - Informações gerais do site
- `fetchBanners()` - Lista todos os banners
- `fetchBannersLoja1()` - Banners da Loja 1
- `fetchBannersLoja2()` - Banners da Loja 2
- `fetchNotifications()` - Lista notificações
- `fetchSubGallery()` - Retorna subgaleria
- `fetchPhone(loja)` - Telefone da loja
- `fetchAddress(loja)` - Endereço da loja
- `fetchWhatsApp()` - Informações do WhatsApp
- `fetchSchedule()` - Horário de atendimento
- `fetchAboutText(titulo)` - Texto sobre a empresa
- `fetchCounters(titulo)` - Contadores da empresa
- `fetchNews()` - Feed de notícias
- `fetchVideos(local?)` - Lista vídeos
- `checkMobile()` - Verifica se é mobile

**Hooks:**
- `useSiteInfoQuery()` - Hook para informações do site
- `useBannersQuery()` - Hook para banners
- `useBannersLoja1Query()` - Hook para banners Loja 1
- `useBannersLoja2Query()` - Hook para banners Loja 2
- `useNotificationsQuery()` - Hook para notificações
- `useSubGalleryQuery()` - Hook para subgaleria
- `usePhoneQuery(loja)` - Hook para telefone
- `useAddressQuery(loja)` - Hook para endereço
- `useWhatsAppQuery()` - Hook para WhatsApp
- `useScheduleQuery()` - Hook para horário
- `useAboutTextQuery(titulo)` - Hook para texto sobre
- `useCountersQuery(titulo)` - Hook para contadores
- `useNewsQuery()` - Hook para notícias
- `useVideosQuery(local?)` - Hook para vídeos
- `useMobileCheckQuery()` - Hook para verificação mobile

### ℹ️ API Info

- `fetchInfo(query?)` - Lista itens da tabela info com filtros opcionais
- `fetchInfoByType(tipo)` - Busca informações por tipo
- `fetchInfoByTitle(titulo)` - Busca informações por título
- `fetchInfoByLocal(local)` - Busca informações por local
- `fetchInfoCombined(query)` - Busca informações com filtros combinados

**Hooks:**
- `useInfoQuery(query?)` - Hook para listar informações
- `useInfoByTypeQuery(tipo)` - Hook para buscar por tipo
- `useInfoByTitleQuery(titulo)` - Hook para buscar por título
- `useInfoByLocalQuery(local)` - Hook para buscar por local
- `useInfoCombinedQuery(query)` - Hook para buscar com filtros combinados

**Tipos disponíveis:**
- `Texto` - Textos gerais
- `Numeros` - Números/contadores
- `Telefone` - Informações de telefone
- `Endereço` - Informações de endereço
- `RedeSocial` - Informações de redes sociais

**Locais disponíveis:**
- `Todos` - Todas as localizações
- `Empresa` - Apenas empresa

**Exemplo de uso:**
```typescript
import { useInfoQuery, useInfoByTypeQuery } from '@/catalog';

function InfoSection() {
  const { data: info } = useInfoQuery({
    tipo: 'Texto',
    local: 'Empresa',
    titulo: 'Desenvolvemos'
  });

  const { data: textos } = useInfoByTypeQuery('Texto');

  return (
    <div>
      {info?.map(item => (
        <div key={item.id}>
          <h3>{item.titulo}</h3>
          <p>{item.conteudo}</p>
        </div>
      ))}
    </div>
  );
}
```

## ⚙️ Configuração

### Variáveis de Ambiente

O projeto já vem com arquivos de ambiente configurados:

- `.env.development` - Usado em `npm run dev`
- `.env.production` - Usado em `npm run build`
- `.env.example` - Template de exemplo

A configuração é feita através da variável `VITE_API_BASE_URL` no arquivo `src/catalog/config.ts`.

**Para desenvolvimento local**, edite `.env.development`:
```env
VITE_API_BASE_URL=http://localhost/netcar/api/v1
```

**Para produção**, o arquivo `.env.production` já está configurado corretamente.

Veja mais detalhes em [ENV_SETUP.md](../../docs/ENV_SETUP.md).

## 🔧 Tratamento de Erros

Todos os endpoints retornam arrays vazios `[]` ou objetos vazios `{}` em caso de erro, evitando quebras na aplicação. Os erros são logados no console para debug.

## 📝 Notas

- Todos os hooks usam React Query para cache e gerenciamento de estado
- As URLs de imagens são normalizadas automaticamente
- Os dados são tipados com TypeScript
- Os hooks têm `staleTime` configurado para otimizar requisições

## 📖 Documentação Completa da API

Para documentação completa da API, consulte:

- **[README_API.md](./README_API.md)** - Documentação completa da API com exemplos e endpoints
- **[openapi.yaml](./openapi.yaml)** - Especificação OpenAPI 3.0 da API
- **[API_CHANGELOG.md](./API_CHANGELOG.md)** - Histórico de mudanças da API
- **[Postman Collection](./postman/)** - Collection e Environment do Postman para testes
  - [Collection](./postman/Netcar_API_Collection.postman_collection.json)
  - [Environment](./postman/Netcar_API_Environment.postman_environment.json)
  - [Instruções](./postman/README_Postman.md)

## 🔗 Links Úteis

- [Documentação da API Netcar](../../../netcar/api/v1/docs/README_API.md)
- [Swagger UI](https://www.netcarmultimarcas.com.br/api/v1/docs) - Documentação interativa da API

