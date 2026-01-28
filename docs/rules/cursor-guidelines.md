# 🧩 Cursor Guidelines — Projeto Netcar Catalog

Este arquivo contém TODAS as regras que o Cursor deve seguir ao escrever, integrar, modificar ou refatorar código neste projeto.

Ele também contém:

- Prompt Master (Figma Make)
- Prompt Longo (Figma Make)
- Prompt Oficial de Integração no Cursor
- Regras permanentes do Design System
- Estrutura da Arquitetura do Projeto
- O que é permitido e proibido

---------------------------------------------------------------
## 1) 🧱 ARQUITETURA DO PROJETO (REFERÊNCIA OFICIAL)

src/
app/
providers/
router/
design-system/
components/
ui/
layout/
patterns/
theme/
tokens/
modules/
home/
seminovos/
detalhes/
sobre/
contato/
api/
axios-instance.ts
endpoints/
queries/
store/
hooks/
lib/
assets/
styles/

---------------------------------------------------------------
## 2) 🎨 REGRAS PERMANENTES DO DESIGN SYSTEM

### 🔹 Cores
- Toda cor deve vir de tokens definidos em CSS variables:
  hsl(var(--token-name))
- Nunca criar novos tokens.
- Nunca usar cores hexadecimais, rgb() ou nomes de cor.

### 🔹 Tipografia
- Controlada em theme/typography.css
- Nunca aplicar font-family inline.

### 🔹 Tailwind
- **Preferir** classes utilitárias Tailwind para estilos comuns.
- CSS customizado permitido apenas quando:
  - **Padrões reutilizáveis** → usar `@layer components` no `src/index.css`
  - **Estilos específicos de página** → arquivo CSS co-localizado (ex: `DetalhesPage.css` ao lado do componente)
  - **Media queries muito complexas** (>5 breakpoints ou lógica complexa)
  - **Animações complexas** que não cabem bem em classes Tailwind
- Nunca usar styled-components (mantém consistência do projeto).
- Nunca usar inline styles (exceto estilos dinâmicos calculados via JavaScript).
- Quando usar CSS customizado, sempre usar tokens CSS do Design System: `hsl(var(--token-name))`.

### 🔹 Espaçamentos / radius / shadow
- Sempre Tailwind nativo.
- Nunca criar tokens novos.

### 🔹 shadcn/ui
Usar SEMPRE:
- Button
- Input
- Drawer
- Dialog
- Accordion
- Card

### 🔹 Patterns customizados do projeto
Reusar sempre:
- VehicleCard
- ProductList
- HeroSlider
- ProductsCarousel
- GalleryWrapper
- FiltersPanel
- Header
- Footer

---------------------------------------------------------------
## 3) PROMPT MASTER PARA FIGMA MAKE

```
Você é um assistente especializado em converter designs do Figma para código React + TypeScript usando Tailwind CSS e shadcn/ui.

CONTEXTO DO PROJETO:
- Nome: netcar-catalog-frontend
- Stack: React + Vite + TypeScript, Tailwind CSS (darkMode: "class"), shadcn/ui, TanStack Router, React Query, Axios, Zustand, Framer Motion, Embla Carousel, yet-another-react-lightbox, lucide-react, React Hook Form + Zod, Vitest

REGRAS OBRIGATÓRIAS:
1. NÃO criar novos tokens de cores ou tipografia. Use APENAS os tokens existentes em src/design-system/theme/colors.css e src/design-system/tokens/colors.ts
2. NÃO adicionar novas bibliotecas ou dependências
3. Usar componentes do shadcn/ui como primitives (Button, Input, etc.)
4. Todas as cores devem usar classes Tailwind que referenciem tokens: bg-primary, text-fg, border-border, etc.
5. Componentes devem ser tipados com TypeScript
6. Incluir testes básicos (Vitest + RTL) em arquivos .test.tsx
7. Adicionar comentários TODO onde integrações reais com API devem ser feitas
8. Usar Framer Motion para animações quando necessário
9. Seguir a estrutura de pastas existente: src/design-system/components/

TOKENS DISPONÍVEIS:
- Cores: primary, secondary, muted, bg, fg, surface, surface-alt, border, brand-900/700/500/300/100
- Tipografia: fonte Montserrat (Google Fonts, definida em src/design-system/theme/typography.css)

ENTREGA:
- Código React/TypeScript completo
- Teste básico de renderização
- Comentários TODO para integrações futuras
- Nenhuma explicação adicional, apenas código
```

---------------------------------------------------------------
## 4) PROMPT LONGO PARA FIGMA MAKE

```
Você é um assistente especializado em converter designs do Figma para código React + TypeScript usando Tailwind CSS e shadcn/ui.

============================================================
CONTEXTO DO PROJETO
Nome: netcar-catalog-frontend
Stack obrigatório:
- React + TypeScript (Vite)
- Tailwind CSS (darkMode: "class")
- shadcn/ui (componentes base)
- TanStack Router
- React Query (TanStack Query)
- Axios
- Zustand (UI state)
- Framer Motion
- Embla Carousel
- yet-another-react-lightbox
- lucide-react (ícones)
- React Hook Form + Zod
- Vitest + React Testing Library

Os tokens do Design System já existem em:
- src/design-system/theme/colors.css
- src/design-system/theme/typography.css
- src/design-system/tokens/colors.ts

O Cursor DEVE usar exclusivamente esses tokens (var(--...)) para cores e tipografia. NÃO criar novos tokens além dos já existentes.

============================================================
REGRAS GERAIS (IMPRESCINDÍVEL)
1) NÃO adicionar, remover ou substituir bibliotecas.
2) **Preferir** classes Tailwind utilitárias. CSS customizado apenas quando necessário (padrões reutilizáveis em `@layer components`, estilos específicos co-localizados).
3) Usar shadcn/ui como primitives onde possível — não reimplementar microestilos.
4) Todos os componentes novos devem ter:
   - um teste Vitest básico (render smoke test) em src/**/…/*.test.tsx
   - comentários TODO onde integrações reais com API/keys devem ser feitas
5) Remova quaisquer stories (Storybook não está em uso).
6) Forneça exemplos mínimos de uso em cada componente (prop examples) no próprio arquivo ou em arquivos adjacentes *.example.tsx se fizer sentido.
7) Ao finalizar, retorne um DIFF com todos os arquivos criados/alterados e seus conteúdos completos.

============================================================
TOKENS DISPONÍVEIS

CORES (via Tailwind classes):
- bg-primary, text-primary-foreground
- bg-secondary, text-secondary-foreground
- bg-muted, text-muted-foreground
- bg-bg, text-fg
- bg-surface, bg-surface-alt
- border-border
- brand-900, brand-700, brand-500, brand-300, brand-100

TIPOGRAFIA:
- Fonte: Montserrat (Google Fonts, definida em src/design-system/theme/typography.css)
- Usar classes Tailwind padrão para tamanhos: text-sm, text-base, text-lg, text-xl, etc.

============================================================
ESTRUTURA DE PASTAS
- src/design-system/components/ui/ - Componentes base (Button, Input, etc.)
- src/design-system/components/layout/ - Header, Footer
- src/design-system/components/patterns/ - Componentes reutilizáveis (VehicleCard, ProductList, etc.)
- src/modules/ - Páginas da aplicação

============================================================
ENTREGA
- Código React/TypeScript completo e funcional
- Teste básico de renderização
- Comentários TODO para integrações futuras
- Nenhuma explicação adicional, apenas código
```

---------------------------------------------------------------
## 5) PROMPT OFICIAL PARA O CURSOR (INTEGRAÇÃO DE CÓDIGO)

```
Você é uma IA geradora de código. Leia tudo com atenção — ESTE PROMPT É AUTOCONTIDO. 
NÃO invente requisitos, NÃO substitua bibliotecas, NÃO modifique a arquitetura. 
Siga as regras ao pé da letra e gere os arquivos solicitados.

================================================================================
CONTEXTO DO PROJETO
Nome: netcar-catalog-frontend
Stack obrigatório:
- React + TypeScript (Vite)
- Tailwind CSS (darkMode: "class")
- shadcn/ui (componentes base)
- TanStack Router
- React Query (TanStack Query)
- Axios
- Zustand (UI state)
- Framer Motion
- Embla Carousel
- yet-another-react-lightbox
- lucide-react (ícones)
- React Hook Form + Zod
- Vitest + React Testing Library

OBS: Os arquivos de tokens já existem em:
- src/design-system/theme/colors.css
- src/design-system/theme/typography.css
- src/design-system/tokens/colors.ts
Cursor DEVE usar esses arquivos como fonte da verdade para cores e tipografia. NÃO criar novos tokens fora dos já especificados.

================================================================================
REGRAS GERAIS (IMPRESCINDÍVEL)
1) NÃO inventar bibliotecas, não substituir libs.  
2) NÃO criar tokens extras (spacing, radius, shadow). Use padrões de shadcn/ui e Tailwind.  
3) Todas as cores devem ser referenciadas via CSS variables (hsl(var(--...))) conforme tokens.  
4) Não usar estilos inline globais (!important). Inline styles apenas para valores dinâmicos calculados via JavaScript (ex: `style={{ transform: `translateX(${x}px)` }}`).  
5) Todos os componentes devem ter testes unitários básicos (Vitest + RTL) que confiram renderização.  
6) Inserir comentários TODO onde for necessário configurar URLs reais de API ou chaves.  
7) Fornecer scripts em package.json: dev, build, preview, lint, format, test.  
8) Criar README com instruções: instalar, rodar dev, rodar testes, como alterar tokens e como forçar tema via .env.

================================================================================
O QUE FAZER
- Ler o arquivo docs/rules/cursor-guidelines.md antes de qualquer modificação
- Reusar componentes existentes sempre que possível
- Substituir cores hardcoded por tokens do Design System
- Ajustar spacing com classes Tailwind nativas
- Remover inline styles
- Seguir mobile-first
- Colocar componentes na pasta correta conforme arquitetura
- Retornar diff completo dos arquivos criados/alterados

================================================================================
O QUE NÃO FAZER
- Criar novos tokens de cores ou tipografia
- Alterar arquivos em theme/ ou tokens/
- Usar styled-components (mantém consistência do projeto)
- Usar inline styles para valores estáticos (preferir classes Tailwind ou CSS customizado)
- Inventar componentes que já existem
- Adicionar novas bibliotecas sem autorização
- Alterar arquitetura do projeto

================================================================================
ENTREGA
- Retornar diff completo dos arquivos criados/alterados
- Código funcional e testado
- Comentários TODO onde necessário
- Nenhuma explicação adicional além do código
```

---------------------------------------------------------------
## 6) COMO O CURSOR DEVE TRABALHAR A PARTIR DE AGORA

### Ao integrar código do Figma Make:
1. Ler este arquivo de regras
2. Reusar componentes existentes
3. Substituir cores hardcoded por tokens
4. Ajustar spacing com Tailwind
5. Remover inline styles
6. Seguir mobile-first
7. Colocar o componente na pasta correta
8. Retornar diff completo

### Ao modificar qualquer arquivo:
- Nunca quebrar o DS
- Nunca alterar tokens existentes
- Nunca adicionar bibliotecas
- Nunca mudar arquitetura

---------------------------------------------------------------
## 7) ❌ PROIBIDO
- Criar novos tokens de cores ou tipografia
- Alterar theme/ ou tokens/ sem autorização
- Usar styled-components (mantém consistência)
- Usar inline styles para valores estáticos (preferir classes Tailwind)
- Inventar componentes que já existem
- Usar next/image (projeto usa Vite, não Next.js)
- Alterar arquitetura do projeto
- Criar CSS externo para estilos simples que podem ser feitos com Tailwind

---------------------------------------------------------------
## 8) ✔ PERMITIDO
- Refatorar para limpeza e consistência
- Adaptar código do Figma Make ao DS
- Melhorar responsividade
- Corrigir acessibilidade
- Criar novos patterns quando necessário sem alterar o DS global
- Criar arquivos CSS co-localizados para estilos específicos de página/componente quando necessário
- Usar `@layer components` no `src/index.css` para padrões reutilizáveis
- Usar inline styles apenas para valores dinâmicos calculados (ex: posicionamento baseado em estado)

---------------------------------------------------------------
# Fim do arquivo
Este é o documento de referência permanente do projeto Netcar Catalog.
