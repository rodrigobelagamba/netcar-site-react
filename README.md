# Netcar Catalog - Frontend

Catálogo digital de veículos desenvolvido com React, TypeScript e tecnologias modernas.

## 📋 Sobre o Projeto

Frontend do catálogo Netcar, uma aplicação web moderna para visualização e busca de veículos seminovos. O projeto utiliza uma arquitetura modular baseada em componentes, design system próprio e integração com APIs REST.

## 🚀 Principais Bibliotecas e Tecnologias

### Core
- **React 18.2.0** - Biblioteca JavaScript para construção de interfaces
- **TypeScript 5.3.3** - Superset JavaScript com tipagem estática
- **Vite 4.x** - Build tool e dev server de alta performance

### Roteamento e Estado
- **TanStack Router 1.12.0** - Roteamento type-safe e performático
- **Zustand 4.4.7** - Gerenciamento de estado global leve
- **TanStack Query 5.17.0** - Gerenciamento de estado do servidor e cache

### Estilização
- **Tailwind CSS 3.4.0** - Framework CSS utilitário
- **shadcn/ui** - Componentes UI acessíveis e customizáveis
- **Framer Motion 10.16.16** - Biblioteca de animações
- **GSAP 3.14.2** - Animação avançada
- **class-variance-authority** - Variantes de componentes
- **clsx** e **tailwind-merge** - Utilitários para classes CSS

### Formulários e Validação
- **React Hook Form 7.49.3** - Gerenciamento performático de formulários
- **Zod 3.22.4** - Validação de schemas TypeScript-first

### Carrosséis e Galerias
- **Embla Carousel React 8.0.0** - Carrossel leve e performático
- **fslightbox-react 2.0.0** - Lightbox para galerias de imagens

### HTTP Client
- **Axios 1.6.5** - Cliente HTTP baseado em promises

### Ícones
- **Lucide React 0.309.0** - Biblioteca de ícones moderna e minimalista

### Desenvolvimento
- **ESLint 8.56.0** - Linter para JavaScript/TypeScript
- **Prettier 3.1.1** - Formatador de código
- **TypeScript ESLint** - Plugin ESLint para TypeScript

## 🏗️ Padrões de Projeto

### Arquitetura Modular

O projeto segue uma arquitetura modular com separação clara de responsabilidades:

```
src/
├── app/                    # Configuração da aplicação
│   ├── providers/         # Context providers (Query, Router, Theme)
│   └── router/            # Configuração de rotas
├── modules/               # Módulos da aplicação (páginas)
│   ├── home/
│   ├── seminovos/
│   ├── detalhes/
│   ├── sobre/
│   └── contato/
├── design-system/         # Design System
│   ├── components/        # Componentes reutilizáveis
│   │   ├── ui/           # Componentes base (shadcn/ui)
│   │   ├── layout/       # Layout components (Header, Footer)
│   │   └── patterns/     # Padrões complexos reutilizáveis
│   ├── theme/            # Tema (cores, tipografia)
│   └── tokens/           # Tokens de design
├── api/                  # Integração com API
│   ├── axios-instance.ts
│   ├── endpoints/        # Definição de endpoints
│   └── queries/          # React Query hooks
├── hooks/                # Custom hooks
├── lib/                  # Utilitários e helpers
├── store/                # Estado global (Zustand)
└── assets/               # Assets estáticos
```

### Design System

#### Cores
- Todas as cores são definidas através de **tokens CSS** em `src/design-system/tokens/`
- Uso obrigatório de variáveis CSS: `hsl(var(--token-name))`
- **Proibido**: cores hexadecimais, rgb() ou nomes de cor hardcoded
- Tokens disponíveis: `primary`, `secondary`, `muted`, `bg`, `fg`, `surface`, `border`, `brand-*`

#### Tipografia
- Fonte principal: **Gotham** (definida em `theme/typography.css`)
- Tamanhos controlados via classes Tailwind: `text-sm`, `text-base`, `text-lg`, etc.
- **Proibido**: aplicar `font-family` inline

#### Estilização
- **Apenas Tailwind CSS** - classes utilitárias
- **Proibido**: CSS externo, styled-components, inline styles
- Espaçamentos, radius e shadows: sempre Tailwind nativo

### Componentes

#### Componentes Base (shadcn/ui)
- `Button`, `Badge` e outros componentes primitivos
- Todos os componentes base ficam em `design-system/components/ui/`

#### Patterns Customizados
Componentes reutilizáveis específicos do projeto:
- `VehicleCard` - Card de veículo
- `ProductList` - Lista de produtos/veículos
- `HeroSlider` - Slider hero da home
- `ProductsCarousel` - Carrossel de produtos
- `GalleryWrapper` - Wrapper para galerias
- `FiltersPanel` - Painel de filtros
- `Header` e `Footer` - Layout components

### Convenções de Código

#### TypeScript
- Strict mode habilitado
- Tipagem explícita em todas as funções e componentes
- Path aliases configurados: `@/*` aponta para `src/*`

#### Nomenclatura
- Componentes: PascalCase (ex: `VehicleCard.tsx`)
- Hooks: camelCase com prefixo `use` (ex: `useTheme.ts`)
- Utilitários: camelCase (ex: `formatters.ts`)
- Constantes: UPPER_SNAKE_CASE

#### Estado
- **Zustand**: Estado global da aplicação (ex: filtros)
- **React Query**: Estado do servidor e cache de dados
- **React Hook Form**: Estado local de formulários

## 🛠️ Como Rodar o Projeto

### Pré-requisitos

- **Node.js** 20.19+ ou 22.12+ (recomendado: LTS)
- **npm** ou **yarn** ou **pnpm**

### Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd estudos-react
```

2. Instale as dependências:
```bash
npm install
```

### Desenvolvimento

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

O projeto estará disponível em:
- **Local**: http://localhost:5173
- **Network**: A URL será exibida no terminal

### Build para Produção

Gera os arquivos otimizados para produção:

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`.

**Configuração do Base Path:**

Por padrão, a aplicação usa `/` como base path. Para configurar um base path diferente:

1. Crie um arquivo `.env.production`:
   ```env
   VITE_BASE_PATH=/app/
   ```

2. Regenere o build:
   ```bash
   npm run build
   ```

### Deploy com Docker (Recomendado para VPS)

Para publicar o projeto em um VPS usando Docker:

1. **Execute o script:**
   ```bash
   chmod +x docker/build.sh
   ./docker/build.sh up
   ```

2. **Ou usando Docker Compose diretamente:**
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

3. **Acesse:** `http://seu-servidor:8080`

Para mais detalhes, consulte [README.DOCKER.md](./README.DOCKER.md)

### Deploy Manual (WAMP/XAMPP)

Para publicar o projeto em um servidor WAMP ou XAMPP:

1. **Gere a build:**
   ```bash
   npm run build
   ```

2. **Copie o conteúdo da pasta `dist/`** para o servidor:
   - **Na raiz**: `C:\wamp64\www\` → Acesse: `http://localhost/`
   - **Em subpasta**: `C:\wamp64\www\dist\` → Acesse: `http://localhost/dist/`

3. **Configure o Apache** para SPA:
   - Certifique-se de que o módulo `mod_rewrite` está habilitado
   - Adicione um `.htaccess` na pasta `dist/` com regras de rewrite para SPA

#### Configuração do Apache

**Certifique-se de que o módulo `mod_rewrite` está habilitado:**

1. Abra o `httpd.conf` do WAMP/XAMPP
   - WAMP: `C:\wamp64\bin\apache\apache2.x.x\conf\httpd.conf`
   - XAMPP: `C:\xampp\apache\conf\httpd.conf`

2. Procure por `LoadModule rewrite_module` e descomente (remova o `#` se houver):
   ```apache
   LoadModule rewrite_module modules/mod_rewrite.so
   ```

3. Verifique se o `AllowOverride` está configurado para `All`:
   ```apache
   <Directory "C:/wamp64/www">
       Options Indexes FollowSymLinks
       AllowOverride All
       Require all granted
   </Directory>
   ```

4. Reinicie o Apache

**Nota**: O arquivo `.htaccess` garante que todas as rotas da SPA sejam redirecionadas para `index.html`, permitindo que o roteamento do lado do cliente funcione corretamente.

### Preview da Build

Visualiza a build de produção localmente:

```bash
npm run preview
```

### Linting

Executa o linter para verificar problemas no código:

```bash
npm run lint
```

### Formatação

Formata o código automaticamente:

```bash
npm run format
```

## 📜 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Cria a build de produção |
| `npm run preview` | Preview da build de produção |
| `npm run lint` | Executa o ESLint |
| `npm run format` | Formata o código com Prettier |

## 🌐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (use `.env.example` como referência):

```env
VITE_API_URL=https://api.exemplo.com
```

## 📁 Estrutura de Diretórios Principais

- **`src/app/`** - Configuração da aplicação (providers, router)
- **`src/modules/`** - Módulos/páginas da aplicação
- **`src/design-system/`** - Design System (componentes, tema, tokens)
- **`src/api/`** - Configuração e queries da API
- **`src/hooks/`** - Custom React hooks
- **`src/lib/`** - Utilitários e helpers
- **`src/store/`** - Stores do Zustand

## 🎨 Personalização do Tema

O tema é gerenciado através de:
- **Cores**: `src/design-system/tokens/colors.ts` e `colors.json`
- **Tipografia**: `src/design-system/theme/typography.css`
- **Variáveis CSS**: `src/design-system/theme/colors.css`

**⚠️ Importante**: Não crie novos tokens. Use apenas os tokens existentes no Design System.

## 🤝 Contribuindo

1. Siga os padrões de código definidos
2. Mantenha a consistência com o Design System
3. Use apenas as tecnologias e bibliotecas já definidas no projeto
4. Adicione testes quando necessário

## 📝 Licença

Este projeto é privado.

---

Desenvolvido com ❤️ usando React + TypeScript + Vite

