# Social Widgets — Design Spec (EmbedSocial baseline)

Referência visual para réplica pixel-perfect dos widgets EmbedSocial (Reviews + Stories).

## Section container

| Propriedade | Valor |
|---|---|
| Background | `bg-bg` (#FFFFFF) |
| Padding Y | `py-8 sm:py-12 lg:py-16` |
| Inner container | `container-main px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16` |
| Gap entre blocos | `space-y-10` (40px) |

## Google Reviews

### Header

| Elemento | Valor |
|---|---|
| Título | "Depoimentos de quem já viveu a experiência Netcar" |
| Cor título | `#00283C` |
| Font | bold, ~24px mobile / ~28px desktop, center |
| Summary | Google G colorido + "{rating} em {total} comentários" |
| Estrelas summary | 5× `#FBBC04`, 18px |
| Botão CTA | "Queremos te ouvir" — bg `#6cc4ca`, texto branco, pill `rounded-full`, px-6 py-2.5 |
| Ícone CTA | coração outline branco, 16px |

### Masonry grid

| Breakpoint | Colunas |
|---|---|
| ≥1280px | 6 |
| 768–1279px | 2 |
| <768px | 1 |

| Propriedade | Valor |
|---|---|
| Gap | 14px |
| Card radius | 12px (`rounded-xl`) |
| Card border | 1px `#E5E7EB` |
| Card bg texto | `#FFFFFF` |
| Card bg escuro | `#333333` |
| Card shadow | none (borda apenas) |
| break-inside | avoid |

### Card texto (variante A)

1. Estrelas 5× amarelas, centro, 14px, pt-4
2. Google G colorido, centro, 32px, my-3
3. Texto review: 14px, `#374151`, line-height 1.5, max 4 linhas
4. "Ver mais" link `#6cc4ca`, 14px
5. Footer: avatar 32px circle + nome bold 13px + data muted 12px

### Card foto (variante B)

- Imagem cover, min-height ~200px
- Gradiente bottom: `linear-gradient(transparent, rgba(0,0,0,0.75))`
- Estrelas brancas + nome branco + Google G branco canto inferior direito

### Card escuro (variante C)

- Fundo `#333333`, texto branco
- Google G branco, estrelas brancas

### Footer section

- Link "Ver mais avaliações no Google" — `#6cc4ca`, underline on hover, center

## Stories

### Header

| Elemento | Valor |
|---|---|
| Logo | Netcar logo 32px + "Netcar" bold `#00283C` |
| Botão Follow | borda `#DBDBDB`, rounded-lg, px-4 py-1.5, ícone Instagram gradient |
| Link | instagram.com/netcar_rc |

### Carrossel

| Propriedade | Valor |
|---|---|
| Card width | 280px (sm: 300px) |
| Aspect ratio | 9/16 |
| Radius | 16px (`rounded-2xl`) |
| Shadow | `0 4px 12px rgba(0,0,0,0.12)` |
| Gap | 14px |
| Scroll | Embla horizontal, drag free |

### Story preview card

- Cover image object-cover
- Badge tempo: pill `bg-black/50 text-white text-xs px-2 py-0.5 rounded-full` top-right, ex "6 h"
- Overlay textos: branco, sombra texto, bottom-left

### Story viewer modal

- Fullscreen `bg-black`, z-50
- Progress bars: brancas, 2px height, gap 2px, top safe area
- Tap nav: esquerda 30% voltar, direita 30% avançar
- Auto-advance: 5000ms default
- Close: X top-right ou swipe down
- Body scroll lock quando aberto

## Tokens reutilizados

- Primary: `#6cc4ca` (hsl 183 47% 60%)
- FG: `#00283C`
- Star: `#FBBC04`
- Muted text: `#6B7280`

## QA breakpoints obrigatórios

- 1440px, 1280px, 768px, 375px
- Comparar side-by-side com `VITE_SOCIAL_QA_SIDE_BY_SIDE=true`
