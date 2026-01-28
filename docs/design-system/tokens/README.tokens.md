# Tokens do Design System

## Cores

As cores são definidas através de variáveis CSS em `src/design-system/theme/colors.css` e consumidas pelo Tailwind através do arquivo `src/design-system/tokens/colors.ts`.

### Estrutura

- **Cores Principais**: primary, secondary, muted e suas variantes foreground
- **Cores Funcionais**: bg, fg, surface, surface-alt
- **Cores de Marca**: brand-900, brand-700, brand-500, brand-300, brand-100

### Uso no Tailwind

As cores estão disponíveis através do objeto `colors` exportado de `src/design-system/tokens/colors.ts`.

## Tipografia

A tipografia utiliza fontes do sistema (system fonts), definida em `src/design-system/theme/typography.css`.

### Variáveis

- `--font-family-base`: Fonte padrão para o body (system fonts)
- `--font-family-heading`: Fonte para títulos (system fonts)
