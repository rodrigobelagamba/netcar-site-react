# 📚 API Netcar - Documentação

Este diretório contém todos os endpoints e hooks React Query para interagir com a API Netcar.

## 📁 Estrutura

```
src/api/
├── endpoints/          # Funções de chamada à API
│   ├── vehicles.ts    # API de Veículos
│   ├── stock.ts       # API de Stock (marcas, modelos, etc.)
│   ├── depoimentos.ts # API de Depoimentos
│   └── site.ts        # API do Site (banners, informações, etc.)
├── queries/           # Hooks React Query
│   ├── useVehicleQuery.ts
│   ├── useVehiclesQuery.ts
│   ├── useStockQuery.ts
│   ├── useDepoimentosQuery.ts
│   └── useSiteQuery.ts
├── axios-instance.ts  # Configuração do Axios
└── index.ts           # Barrel exports
```

## 🚀 Uso Rápido

### Importação

```typescript
// Importação individual
import { useVehiclesQuery } from '@/api/queries/useVehiclesQuery';
import { useBrandsQuery } from '@/api/queries/useStockQuery';

// Ou usando barrel export
import { useVehiclesQuery, useBrandsQuery, useDepoimentosQuery } from '@/api';
```

### Exemplos de Uso

#### 🚗 API Veículos

```typescript
import { useVehiclesQuery, useVehicleQuery } from '@/api';

function VehiclesList() {
  const { data: vehicles, isLoading } = useVehiclesQuery({
    marca: 'FORD',
    precoMin: '30000',
    precoMax: '60000'
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div>
      {vehicles?.map(vehicle => (
        <div key={vehicle.id}>{vehicle.name}</div>
      ))}
    </div>
  );
}
```

#### 📊 API Stock

```typescript
import { useBrandsQuery, useModelsByBrandQuery } from '@/api';

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
import { useDepoimentosQuery } from '@/api';

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
import { useBannersQuery, usePhoneQuery, useWhatsAppQuery } from '@/api';

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

**Hooks:**
- `useVehiclesQuery(query?)` - Hook para listar veículos
- `useVehicleQuery(slug)` - Hook para buscar veículo específico

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

## ⚙️ Configuração

### Variáveis de Ambiente

O projeto já vem com arquivos de ambiente configurados:

- `.env.development` - Usado em `npm run dev`
- `.env.production` - Usado em `npm run build`
- `.env.example` - Template de exemplo

A configuração é feita através da variável `VITE_API_BASE_URL` no arquivo `src/api/config.ts`.

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

## 🔗 Links Úteis

- [Documentação da API Netcar](../../../netcar/api/v1/docs/README_API.md)
- [Collection Postman](../../../netcar/api/v1/docs/Netcar_API_Collection.postman_collection.json)

