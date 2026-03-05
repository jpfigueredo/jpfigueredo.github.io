# TypeScript & React – Convenções

## Tipagem

- Sempre tipar props explicitamente: `type Props = { ... }` (prefira `type` a `interface` para props de componente)
- Usar `import type { Foo }` para importações de tipo
- Nunca usar `any`; prefira `unknown` ou tipo adequado
- Props opcionais com `?` e valor default via destructuring
- Usar `as const` em arrays/objetos que são literais (ex: `TAGS = [...] as const`)

## Componentes React

- Sempre `React.FC<Props>` com props nomeadas
- Hooks customizados: arquivo `hooks/useFoo.ts`, nome sempre prefixado `use`
- `useCallback`/`useMemo` apenas quando há dependência de referência ou custo real de recalculo
- `key` em listas: sempre usar ID estável, nunca índice do array
- Para re-disparar animação CSS ao trocar conteúdo: `key={id}` no elemento raiz

## Estrutura de arquivos

```
components/
  layout/     → estruturas de página (shells, grids)
  timeline/   → componentes de domínio
  atoms/      → componentes primitivos (botões, inputs, icons)
  molecules/  → composições de atoms
hooks/        → custom hooks
data/         → dados estáticos tipados
styles/       → SCSS (layout, timeline, animations)
```

## Eventos e acessibilidade

- Botões interativos: sempre `type="button"` para evitar submit acidental
- Adicionar `aria-pressed`, `aria-label`, `role` quando relevante
- Navegação por teclado: `onKeyDown` com `ArrowLeft`/`ArrowRight` em listas de itens
- `focus-visible` para outline de foco: nunca `outline: none` sem alternativa

## Imports

- Imports absolutos via `@jpfig/ui` e `@jpfig/config` para packages internos
- Imports relativos curtos (sem `../../../../`): reorganizar se ficar longo demais
- Ordem: React → libs externas → packages internos → relativo local → tipos
