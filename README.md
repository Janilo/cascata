# Handoff: Correções de Design System — Cascata

> **Destino:** repositório `Janilo/cascata` (Vite + React + TanStack Router + Tailwind v4 + shadcn, Supabase).
> **Natureza:** este NÃO é um handoff de nova UI. É um pacote de **remediação** — uma auditoria do código atual com correções precisas, prontas para aplicar. Cada item traz arquivo, linha, e o patch exato.
> **Referência visual:** `Auditoria DS — Cascata.html` (incluído) é o relatório navegável; este README é a versão acionável.

---

## Contexto em uma linha

O **token layer está maduro e correto**. O problema é a **aderência do código** a ele: a migração da paleta para hex literais foi feita só na definição (`src/styles.css`), mas vários pontos de consumo (gráficos Recharts + utilitários inline) ainda embrulham os tokens em `hsl()` — herança do shadcn cru. Como os tokens agora são hex (`#2F7D57`), `hsl(#2F7D57)` é **CSS inválido**, descartado em silêncio. Sem erro no console. Por isso passou.

**Causa-raiz única dos 3 bugs P0:** `hsl(var(--token))` sobre um token que resolve para hex.

---

## A regra de ouro (entender antes de tocar em qualquer arquivo)

Em `src/styles.css`, os tokens são **hex literais**, não trios HSL:

```css
--cascata-inflow:  #2F7D57;
--cascata-outflow: #B5502E;
--cascata-navy:    #103C61;
--primary:         var(--cascata-navy);   /* → #103C61 */
--chart-1:         var(--cascata-navy);
--chart-2:         var(--cascata-gold);   /* → #B5871C */
```

Portanto:

| Forma | Resultado | Veredito |
|---|---|---|
| `hsl(var(--primary))` | `hsl(#103C61)` | ❌ inválido → descartado → cai no herdado/preto |
| `var(--primary)` | `#103C61` | ✅ |
| `text-[hsl(var(--cascata-inflow))]` | inválido | ❌ |
| `text-inflow` / `.delta-up` | token resolvido | ✅ (após Passo 1) |

**Nunca** escreva `hsl(var(...))` neste repo. Os tokens já são cores finais.

---

## Ordem de aplicação (respeita dependências)

Aplique **nesta ordem**. O Passo 1 cria os utilitários que os bugs precisavam; depois cada P0 vira uma troca de classe.

---

### Passo 1 — S1 · Criar os utilitários de cor que faltam · `src/styles.css` (bloco `@theme`, ~linhas 67–87)

**Por quê:** o `@theme` já expõe `--color-gold`, `--color-marine`, `--color-navy` (por isso `bg-gold` funciona), mas **não há** `--color-inflow`/`--color-outflow`. Sem utilitário, o dev recorreu a valor arbitrário com `hsl()` e errou. Esta é a raiz de B1 e B3.

Adicione ao bloco `@theme` (junto dos outros `--color-*`):

```css
--color-inflow:       var(--inflow);
--color-inflow-soft:  var(--cascata-inflow-soft);
--color-outflow:      var(--outflow);
--color-outflow-soft: var(--cascata-outflow-soft);
--color-abyss:        var(--abyss);
--color-steel:        var(--cascata-steel);
```

**Efeito:** `text-inflow`, `bg-outflow`, `bg-outflow/15`, `bg-abyss/70` passam a existir nativamente.

---

### Passo 2 — B1 · Deltas do waterfall renderizam na cor herdada (P0) · `src/routes/_authenticated.waterfall.tsx:443`

**Sintoma:** o delta ajustado de cada KPI usa `hsl(var(--cascata-inflow))` / `outflow`. Inválido → o número herda a cor do pai → **▲ alta e ▼ baixa ficam idênticos**. A leitura mais importante do produto (entrou/saiu dinheiro) perde o sinal visual.

```diff
- className={`mt-2 text-xs font-mono ${d >= 0 ? "text-[hsl(var(--cascata-inflow))]" : "text-[hsl(var(--cascata-outflow))]"}`}
+ className={`mt-2 text-xs font-mono ${d >= 0 ? "delta-up" : "delta-down"}`}
```

> `.delta-up` / `.delta-down` já existem em `src/styles.css:268` e fazem exatamente isto, sem `hsl()`. **Use-as; não recrie.**

---

### Passo 3 — B3 · Badge de confiança da IA sem cor de alerta (P0) · `src/routes/_authenticated.inputs.tsx:346`

**Sintoma:** o pill "Revisar · NN%" usa `bg-[hsl(var(--cascata-outflow)/0.15)] text-[hsl(var(--cascata-outflow))]` — duas regras inválidas. O aviso de "a IA não tem certeza" aparece sem cor, justo quando precisa chamar atenção.

```diff
- className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-semibold bg-[hsl(var(--cascata-outflow)/0.15)] text-[hsl(var(--cascata-outflow))] border border-[hsl(var(--cascata-outflow)/0.3)]"
+ className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-semibold pill-outflow border border-[var(--cascata-outflow)]/30"
```

> `.pill-outflow` (`src/styles.css:263`) já combina fundo clay-soft + texto clay.

---

### Passo 4 — B2 · Linhas e barras dos gráficos renderizam pretas (P0) · todos os gráficos Recharts

**Sintoma:** as séries passam cor como `stroke="hsl(var(--primary))"` ou `hsl(var(--chart-2, 200 70% 40%))`. Inválido → o atributo SVG `stroke`/`fill` cai no padrão **preto**. A série tracejada "Pocket %" perde o mostarda. Os fallbacks `200 70% 40%` são lixo da era HSL antiga e nunca disparam (a var existe).

**Arquivos afetados:** `_authenticated.comparativo.tsx` (linhas 206–217, 229–236), e o mesmo padrão em `_authenticated.custo-de-servir.tsx` e no gráfico do `_authenticated.waterfall.tsx`. Faça um grep por `hsl(var(` em `src/` e corrija todos.

```diff
- <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
- <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
- <Line stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
- <Line stroke="hsl(var(--chart-2, 200 70% 40%))" strokeWidth={2} dot={{ r: 4 }} />
- <Line stroke="hsl(var(--chart-3, 40 80% 50%))" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} />
- <Bar  fill="hsl(var(--primary))" />
- contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
+ <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
+ <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
+ <Line stroke="var(--chart-1)" strokeWidth={2} dot={false} />
+ <Line stroke="var(--chart-2)" strokeWidth={2} dot={false} />
+ <Line stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
+ <Bar  fill="var(--chart-1)" />
+ contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }}
```

> Ordem de série do DS (máx. 4): `--chart-1` marinho → `--chart-2` mostarda → `--chart-3` steel → `--chart-4` inflow. `dot={false}` e a 2ª série tracejada `5 4` já alinham ao spec (ver Passo 6).

---

### Passo 5 — D1 · `DEPT_COLORS` é um arco-íris com paleta de outra marca (P1) · `src/routes/_authenticated.inputs.tsx:15–28`

**Sintoma:** 12 hex cravados. As 4 primeiras (`#4A1942` roxo, `#2E5D4F` verde, `#0F2940`, `#C9A227`) são a **paleta JPS v1** que a Cascata abandonou pelo marinho. As outras 8 (`#7d3c98`, `#2980b9`, `#16a085`, `#8e44ad`, `#27ae60`, `#d35400`, `#34495e`, `#94908A`) são flat-UI genérico, sem token. Viola "máx. 4 séries de viz".

**Correção:** departamento é dado categórico, mas não precisa de 12 matizes berrantes. Tokenize uma rampa derivada da paleta e mande "outros" para neutro:

```ts
// Rampa categórica Cascata — ordem do spec, depois tints. "Outros" → mute.
const DEPT_COLORS: Record<string, string> = {
  "Comercial":   "var(--cascata-navy)",
  "PS":          "var(--cascata-gold)",
  "Produto":     "var(--cascata-steel)",
  "Fiscal":      "var(--cascata-inflow)",
  "Financeiro":  "var(--cascata-outflow)",
  "Tech/Infra":  "var(--cascata-navy-deep)",
};
const DEPT_FALLBACK = "var(--cascata-mute)";
// uso: DEPT_COLORS[dept] ?? DEPT_FALLBACK
```

> Se houver realmente mais de ~6 departamentos ativos, prefira um único tom (marinho) com variação de opacidade/tint a inventar matizes fora da paleta.

---

### Passo 6 — D2 · Gráficos usam caixas de legenda e dots; o spec pede rótulo no fim da linha (P1) · `_authenticated.comparativo.tsx:214` e demais gráficos

**Spec de data viz do DS (literal):** "rótulos sempre no FIM de cada linha — nunca caixas de legenda", linhas 1.5–2px, sem marcadores de ponto, máx. 4 séries, 2ª série diferenciada por tracejado além da cor.

- Remover `<Legend />`.
- `dot={false}` em todas as séries (já no Passo 4).
- Rotular o último ponto de cada série com `<LabelList dataKey="..." position="right" />` (ou um label customizado no último índice), na cor da série, Inter Tight 11–13px.
- 2ª série: manter `strokeDasharray="5 4"`.

---

### Passo 7 — S2 · Guard-rail contra regressão (P2) · ESLint

Quatro convenções de cor convivem hoje (`bg-gold`, `bg-[var(--gold)]`, `bg-[color:var(--cascata-abyss)]/70`, `text-[hsl(var(--cascata-inflow))]`). Depois das correções, padronize e trave:

- **Regra:** utilitário de theme sempre que existir (`bg-gold`, `text-inflow`); arbitrário só para opacidade pontual (`bg-abyss/70`).
- **Lint:** proibir a string `hsl(var(` dentro de `className` e em props `stroke`/`fill`/`style`. Uma regra `no-restricted-syntax` ou um simples grep no CI fecha a porta para B1/B2/B3 voltarem.

---

## O que já está certo (não mexer)

- **Token layer em 3 camadas, limpa:** primitivas `--cascata-*` → role tokens (`--primary`, `--destructive`) → aliases `--color-*`. Derivação correta, sem fork do core JPS.
- **Semântica de waterfall toda tokenizada:** `.bar-*`, `.pill-*`, `.delta-*` existem e estão corretas (`src/styles.css:257–270`). O conserto do P0 é só passar a usá-las.
- **Componentes shadcn fiéis ao DS:** botões chapados, anel de foco mostarda, cantos retos (radius 2px), overlay no abismo.
- **Números pt-BR, tabular:** `Intl.NumberFormat("pt-BR", … BRL)` + `tabular-nums` nas colunas numéricas.

---

## Checklist de verificação pós-fix

- [ ] `grep -rn "hsl(var(" src/` retorna **zero** resultados.
- [ ] No waterfall, um KPI com delta positivo aparece **verde** e um negativo **clay** (cores diferentes).
- [ ] Em `/comparativo`, as linhas do gráfico aparecem em marinho/mostarda/steel — **nenhuma preta**.
- [ ] O badge "Revisar · NN%" em `/inputs` tem fundo clay-soft e texto clay.
- [ ] Nenhum `<Legend>` nos gráficos; rótulos no fim das linhas.
- [ ] `DEPT_COLORS` não contém nenhum hex literal.

---

## Arquivos neste pacote

| Arquivo | O que é |
|---|---|
| `README.md` | Este documento — instruções acionáveis. |
| `Auditoria DS — Cascata.html` | Relatório navegável (mesma análise, formato visual). |

> Os tokens e classes citados vivem no repo `Janilo/cascata` em `src/styles.css`. Este pacote não os duplica — referencia por caminho e linha.
