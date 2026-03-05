# Design System – @jpfig/ui

## Tokens (fonte da verdade)

Todos os valores visuais devem vir de `packages/ui/src/tokens.scss`.
Nunca escrever cores, espaçamentos ou transições hardcoded nos SCSS dos apps.

### Configurar Vite para acessar tokens

```ts
// vite.config.ts de qualquer app
css: {
  preprocessorOptions: {
    scss: {
      loadPaths: [path.resolve(__dirname, '../../packages/ui/src')],
    },
  },
},
```

### Usar nos arquivos SCSS

```scss
@use 'tokens' as ds;

.meu-bloco {
  color: ds.$color-neon;
  background: ds.$color-bg-card;
  border-radius: ds.$radius-md;
  transition: border-color ds.$transition-fast;
  box-shadow: ds.$shadow-card;
  padding: ds.$space-4 ds.$space-5;
}
```

## Referência de tokens principais

| Token | Valor |
|---|---|
| `$color-bg-deep` | `#070a12` |
| `$color-bg-space` | `#0a0f1d` |
| `$color-bg-card` | `rgba(15,23,42,0.9)` |
| `$color-neon` | `#00e5ff` |
| `$color-neon-sky` | `#38bdf8` |
| `$color-magenta` | `#ff00e6` |
| `$color-marxist` | `#f9a8d4` |
| `$color-text-primary` | `#e2e8f0` |
| `$color-text-secondary` | `#9ca3af` |
| `$shadow-card` | `0 18px 45px rgba(15,23,42,0.9)` |
| `$shadow-neon` | ring neon sky |
| `$shadow-selected` | ring magenta |
| `$space-1..8` | escala 8pt (0.25rem – 2rem) |
| `$radius-sm/md/pill` | 0.375rem / 0.75rem / 999px |
| `$transition-fast/base/slow` | 160ms / 200ms / 300ms |

## Componentes exportados por `@jpfig/ui`

```tsx
import { Button, Badge, Card, PageContainer, NeonText } from '@jpfig/ui';

// Button: variant = 'primary' | 'ghost' | 'danger', size = 'sm' | 'md'
<Button variant="primary" onClick={...}>Ação</Button>

// Badge: variant = 'neon' | 'magenta' | 'neutral' | 'success' | 'warn'
<Badge variant="neon">beta</Badge>

// Card: hover=true ativa borda neon no mouseenter
<Card hover>conteúdo</Card>

// NeonText: texto com glow neon
<NeonText>SW Timeline</NeonText>
```

## CSS Custom Properties (para uso em JS/inline styles)

```css
/* Disponíveis em qualquer app que importar web/src/index.css ou @jpfig/ui/src/tokens.css */
var(--ds-neon)           /* #00e5ff */
var(--ds-magenta)        /* #ff00e6 */
var(--ds-bg-deep)        /* #070a12 */
var(--ds-text-primary)   /* #e2e8f0 */
```

## Convenções BEM para SCSS

```
.sw-axis              → bloco
.sw-axis__track       → elemento
.sw-axis__event-dot   → elemento
.sw-axis__event-dot--selected  → modificador
```

Prefixos de namespace: `sw-` (sw-timeline), `ds-` (design system), `kv-` (kafka-viz a criar).

## Anti-patterns a evitar

- ❌ `color: #38bdf8` hardcoded → use `ds.$color-neon-sky`
- ❌ `transition: all 0.2s` em SCSS dos apps → use `ds.$transition-base`
- ❌ `border-radius: 999px` → use `ds.$radius-pill`
- ❌ Criar novo componente React em `web/` ou `apps/` que deveria estar em `packages/ui`
