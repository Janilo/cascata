
# Auditoria de Design System — Cascata vs. handoff `jps-ds-cascata` v0.1

Comparei `src/styles.css`, os componentes shadcn em `src/components/ui/*` e as rotas em `src/routes/*` contra o bundle de referência (`tokens/`, `styles/components.css`, `styles/page.css`, `index.html` e os chats). A boa notícia: tokens primitivos, paleta e tipografia já estão alinhados. O que diverge é **uso** — várias rotas escapam para utilitários Tailwind crus e alguns componentes shadcn ainda têm radii/sombras do tema padrão.

## O que já está correto (não tocar)
- Paleta `--cascata-*` (navy, gold, inflow, outflow, steel, abyss, mist, paper, stone) idêntica ao handoff.
- Fontes Fraunces variável + Inter Tight carregadas; `--font-display` / `--font-sans` mapeados.
- Tokens de densidade (`--cascata-row-h-*`, `--cascata-topbar-h`, `--cascata-sidebar-w`) presentes.
- Utilitários de waterfall (`bar-inflow/outflow/subtotal/margin`, `pill-*`) presentes.
- Sidebar autenticada já usa `--cascata-abyss`. Wordmark unificado via `CascataWordmark`.

## Sugestões priorizadas

### P0 — Quebras semânticas (cores cruas em rotas de produto)
1. **`_authenticated.comparativo.tsx`** linhas 183 e 275: `text-emerald-700` / `text-rose-700` para deltas → trocar por `text-[color:var(--cascata-inflow)]` / `text-[color:var(--cascata-outflow)]` (ou criar classes `.delta-up` / `.delta-down`).
2. **`_authenticated.admin.tsx`** linha 159 (`text-emerald-700`) e linha 291 (`text-emerald-600`) → mesmas trocas. O ícone "approve" deve usar `--cascata-inflow`.
3. **`_authenticated.custo-de-servir.tsx`** linhas 112–113: `bg-emerald-100 text-emerald-900` / `bg-amber-100 text-amber-900` → trocar pelos utilitários já existentes `pill-inflow` e `pill-margin`.
4. **Overlays shadcn** (`dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `drawer.tsx`) usam `bg-black/80`. DS pede tom marinho: `bg-[color:var(--cascata-abyss)]/70`. Editar uma vez nos 4 componentes resolve em todo o app.

### P1 — Componentes shadcn fora do contrato visual do DS
5. **`Card`** usa `rounded-xl shadow` (xl = 4px no nosso tema, OK) mas o handoff prescreve `border: 1px solid var(--cascata-stone)` **sem sombra** por padrão e sombra só em `data-elev="raised"`. Sugestão: remover `shadow` do default e expor variante `elevated`.
6. **Anel de foco** (`--ring`) está em navy; o handoff usa **gold** (`outline: 2px solid var(--cascata-gold); outline-offset: 2px`) — é o detalhe que carimba a marca em interação. Trocar `--ring: var(--cascata-gold)` no light mode.
7. **`Button`** default: `shadow` na variante `default` e `shadow-sm` em outras — o handoff é flat. Remover sombras das variantes `default`/`secondary`/`outline`/`destructive`.
8. **`Input`** já usa `rounded-md` (2px). Adicionar comportamento de foco do DS: `focus-visible:ring-[3px] focus-visible:ring-[color:var(--cascata-navy-soft)] focus-visible:border-[color:var(--cascata-navy)]` (hoje é `ring-1`).
9. **Tabs**: indicador atual é fundo branco em pill; handoff usa underline em navy. Refazer `TabsTrigger` para `border-b-2 data-[state=active]:border-[color:var(--cascata-navy)] data-[state=active]:text-[color:var(--cascata-navy-deep)]`.
10. **Badge tones**: criar `data-tone="brand|success|warning|danger|ai"` mapeando aos `--cascata-*-soft` / `*-ink` do handoff em vez das variantes shadcn `default/secondary/destructive`.

### P2 — Tipografia e ritmo editorial
11. **Hero do `/`**: o headline deve ser Fraunces *italic* opsz 144 (referência: `chat2` + `page.css .hero h1`). Conferir que `<h1>` usa `font-display italic` e `font-variation-settings: "opsz" 144`.
12. **Empty states**: criar componente `EmptyState` com variante `feel="brand"` usando Fraunces italic 28px (`--cascata-slate`) — hoje empty states são genéricos do shadcn.
13. **`.eyebrow`** já existe; padronizar uso em cabeçalhos de seção (atualmente alguns títulos usam só `text-xs uppercase tracking-wider`).
14. **Numerais tabulares**: garantir `.cascata-num` (ou `tabular-nums`) em **todas** as colunas numéricas de `waterfall`, `comparativo`, `clientes`, `custo-de-servir`. Auditoria rápida mostra que algumas tabelas dependem só do `font-mono`.

### P3 — Tabelas financeiras
15. Aplicar a semântica `data-row="subtotal"` / `data-row="total"` do handoff nas tabelas de waterfall e comparativo (fundo `--cascata-navy-soft` para subtotal, `--cascata-navy` + texto branco para total). Hoje as linhas de subtotal são apenas negritadas.
16. Cabeçalho `<th>`: padronizar para `text-xs uppercase tracking-[0.14em] text-muted-foreground bg-paper` como no `.cascata-table thead th`.

### P4 — Detalhes de marca
17. **Toast/Sonner**: o DS prescreve toast em `--cascata-abyss` com dot colorido por tom. Conferir `src/components/ui/sonner.tsx` e alinhar.
18. **KPI cards**: adicionar variante `data-accent="money"` com faixa superior 2px em `--cascata-gold` para KPIs monetários (margem, receita líquida).
19. **Sombras**: substituir `shadow-sm/shadow` shadcn pelo token `--shadow-card` (já definido em `:root`) onde elevação for necessária — assim sombras são de fato marinho-frio.
20. **Dark mode**: `:root.dark` está definido mas nenhuma página oferece toggle. Decidir: (a) remover as variáveis dark, ou (b) implementar toggle. O produto financeiro do handoff é claro por design — recomendo remover para evitar drift.

## Detalhes técnicos
- Todas as trocas P0/P1 são CSS/Tailwind — sem migração, sem mudança de schema, sem mudança em server functions.
- Onde possível, prefiro estender utilitários existentes em `styles.css` (ex.: `.delta-up`, `.delta-down`, `.table-row-subtotal`) a espalhar arbitrary-values nas rotas.
- O bundle de referência traz `--cascata-tnum` e a classe `.tabular` — usar nas tabelas em vez de só `font-mono`.

## Fora de escopo (sinalizo, não execute sem ok)
- Substituir componentes shadcn pelos `.cascata-*` puros do handoff (refactor grande; só faz sentido se quiser abandonar shadcn).
- Implementar a página `/styleguide` espelhando o `index.html` do handoff (útil mas é trabalho novo, não auditoria).

## Próximo passo sugerido
Aprovar P0 + P1 como um único batch (impacto visual alto, risco baixo). P2–P4 podem entrar em sequência. Quer que eu execute tudo de uma vez, só P0+P1, ou prefere escolher itens específicos?
