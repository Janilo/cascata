# Auditoria de Arquitetura — Cascata

> Base: `Janilo/cascata` (branch atual). Stack: TanStack Start · React 19 · Vite · Cloudflare Workers · Supabase (+ edge functions) · Zod · Tailwind 4 · shadcn.
> Referência: Matt Pocock, "Software Fundamentals Matter More Than Ever" (https://www.youtube.com/watch?v=v4F1gFy-hqg).
> Escopo: **arquitetura** — módulos, fatias verticais, interfaces, ocultação de informação, testes. **NÃO** é a auditoria de design system (essa é `README.md`, e já foi aplicada: `_authenticated.waterfall.tsx:526` já usa `delta-up/down`, `_authenticated.inputs.tsx:341` já usa `pill-outflow`).

---

## Sumário executivo

A tese do Pocock: **código não é barato**. A IA é um programador *tático* excelente — ela produz cada tela, cada `serverFn`, cada gráfico com competência. O que ela não faz sozinha é *estratégia*: decidir onde a regra de negócio mora, garantir que ela mora em **um** lugar, e escolher os *seams* certos. Cascata é a evidência viva disso. A camada tática está boa: schema coeso, Zod na borda, um gate de aprovação real, e — o achado mais importante — **uma separação de módulo profundo já existente e correta** em `waterfall-core.ts`. O problema é estratégico: **a matemática financeira que define o produto (o waterfall do P&L, a Pocket Margin) está reimplementada em 5 arquivos, e as implementações divergem** — a mesma palavra, "Pocket Margin", significa R$ em três telas e **porcentagem** em outra. Isso é exatamente o que fundamentos previnem, e é caro num app onde o número *é* o produto.

| Princípio | Nota | Veredito em uma linha |
|---|---|---|
| 1. Linguagem ubíqua (DDD) | 🟡 | Substantivos do schema impecáveis; mas "Pocket Margin" tem **dois significados** (R$ vs %) e `comparativo.tsx` vaza português no código. |
| 2. Fatias verticais | 🟡 | Leitura do waterfall é uma fatia limpa (schema→core→serverFn→rota). Mas **toda escrita** (clientes, inputs, admin) fura a fatia e vai direto do browser à tabela via RLS. |
| 3. TDD | 🔴 | **Zero** test runner, **zero** testes. `computeWaterfall` — o cérebro financeiro — não tem nenhuma rede de proteção. |
| 4. Módulos profundos (Ousterhout) | 🟡 | `waterfall-core.ts` e `require-approved.ts` são módulos profundos exemplares. Mas os KPIs do P&L são um **módulo raso replicado 5×** nas rotas. |
| 5. Ocultação de informação & design de sistema | 🟡 | `supabaseAdmin` bem contido (25 usos, 5 arquivos server). Mas o *seam* serverFn↔edge é **assimétrico na segurança**: edge functions não checam `is_approved`; erros são `throw new Error("string")` sem tipo. |

---

## A arquitetura em uma tela

Estrutura real:

```
src/
  lib/
    waterfall-core.ts        ← computeWaterfall(): motor do waterfall (lê DB + soma P&L)   ◀ MÓDULO PROFUNDO
    waterfall.functions.ts   ← getWaterfall / getSharedWaterfall / createSharedLink (serverFn, wrappers finos)
    cost-to-serve.functions.ts ← getCustomerPnL (serverFn; DUPLICA parte do core)
    auth.functions.ts        ← enterAsGuestFn (serverFn)
    require-approved.ts       ← requireApprovedUser(): gate de aprovação server-side         ◀ MÓDULO PROFUNDO
    file-parse.ts             ← fileToText(): XLSX/CSV/TXT → texto
    config.ts                 ← ADMIN_EMAIL / GUEST_EMAIL
  integrations/supabase/
    client.ts (anon+RLS)  ·  client.server.ts (service-role, bypassa RLS)  ·  auth-middleware.ts  ·  auth-attacher.ts
  routes/
    _authenticated.waterfall.tsx      ← kpisFor()  (pocket = R$)   ── reimplementa o P&L
    _authenticated.comparativo.tsx    ← kpisFor()  (pocket = %)    ── reimplementa o P&L (DIVERGE)
    _authenticated.custo-de-servir.tsx← consome getCustomerPnL
    _authenticated.inputs.tsx         ← escreve line_inputs DIRETO (RLS) + invoca extract-inputs
    _authenticated.clientes.tsx       ← escreve customers DIRETO (RLS) + invoca extract-customers
    _authenticated.admin.tsx          ← escreve profiles/roles/business_units DIRETO (RLS)
    share.$token.tsx                  ← reimplementa o P&L (hardcoded 1..29)
    demo.tsx                          ← reimplementa o P&L (mais uma variante)
supabase/
  functions/extract-customers/index.ts   ← Deno · IA (Gemini) · SERVICE_ROLE · só checa getUser()
  functions/extract-inputs/index.ts      ← Deno · IA (Gemini) · SERVICE_ROLE · só checa getUser()
  migrations/*.sql (21 arquivos)          ← schema + RLS (152 ocorrências de policy/rls)
```

O **seam de compute** (ponto onde a lógica se parte entre dois runtimes):

```
                         BROWSER (React 19)
        ┌───────────────────────┴─────────────────────────────┐
        │ leitura de números                    │ escrita + IA │
        ▼                                        ▼              ▼
  useServerFn(getWaterfall)              supabase.from(...)   supabase.functions.invoke(...)
        │                                   .insert/upsert       │
        ▼                                        │               ▼
  Cloudflare Worker (TanStack serverFn)          │        Supabase Edge (Deno)
   • requireSupabaseAuth  ✅                      │         • getUser(token)   ⚠️ NÃO checa is_approved
   • requireApprovedUser  ✅                      │         • AI_API_KEY (secret isolado)
   • supabaseAdmin (bypassa RLS)                  │         • chama Gemini, devolve JSON
   • computeWaterfall()                           ▼
        │                                   RLS no Postgres
        ▼                                   (current_department(), has_role())
   Supabase Postgres  ◀───────────────────────────┘
```

Leitura: a colocação serverFn-vs-edge é **defensável** (o edge isola `AI_API_KEY` e roda em Deno com timeout maior para a chamada de IA). O problema não é *onde* cada compute mora — é que (a) a mesma regra de P&L é reimplementada de ambos os lados e nas telas, e (b) o gate de aprovação existe de um lado do seam e não do outro.

---

## 1 — Linguagem ubíqua

**O que está certo.** O vocabulário do domínio é consistente do schema à rota. `waterfall_lines`, `line_inputs`, `org_nodes`, `customers`, `shared_links`, `line_inputs_audit` (migração `20260527003917_...sql:51–127`) reaparecem com os mesmos nomes em `waterfall-core.ts:24–36`. Os *value objects* do P&L são disciplinados: `bucket ∈ {revenue, deduction, cost}` e `priority ∈ {P1,P2,P3,MANUAL,RATEIO}` são os mesmos no CHECK do banco, no `PRIORITY_ORDER` (`waterfall-core.ts:4`) e no `<select>` da UI (`_authenticated.inputs.tsx:254`). A convenção PT-BR-na-UI / inglês-no-código é seguida na grande maioria dos arquivos.

**Onde vaza — dois furos concretos:**

1. **"Pocket Margin" é um homônimo com dois significados.** Em `_authenticated.waterfall.tsx:87` e `share.$token.tsx:62`, `pocket = grossMargin - opex` → um **valor em R$**. Em `_authenticated.comparativo.tsx:50`, `pocketMargin = (margemBruta / receitaLiquida) * 100` → uma **porcentagem**. As duas telas rotulam a métrica como "Pocket Margin" / "Pocket margin" para o mesmo usuário. Em linguagem ubíqua, um termo = um conceito. Aqui o mesmo termo é R$ numa aba e % na aba ao lado — o tipo de ambiguidade que gera bug de interpretação numa reunião de diretoria.

2. **`comparativo.tsx` vaza português para dentro do código.** Enquanto todo o resto usa identificadores em inglês, `comparativo.tsx:45–51` introduz `receitaBruta`, `deducoes`, `receitaLiquida`, `margemBruta` como nomes de variáveis. Não é errado — mas quebra a regra "UI em PT-BR, código em inglês" que o resto do repo mantém, e cria um segundo vocabulário para os mesmos conceitos que `waterfall.tsx` chama de `grossRevenue`, `deductions`, `netRevenue`, `grossMargin`.

> A causa-raiz de ambos é a mesma do achado A1: não existe um módulo único de KPIs. Cada tela batiza os conceitos de novo, então a linguagem diverge junto com o código.

---

## 2 — Fatias verticais

Uma capacidade deve atravessar schema → serviço → API → frontend como uma fatia coesa. Cascata acerta isso **na leitura** e fura **na escrita**.

**Fatias limpas (leitura):**
- **Waterfall:** `waterfall_lines`/`line_inputs` → `computeWaterfall` (`waterfall-core.ts`) → `getWaterfall` (`waterfall.functions.ts:18`) → `useServerFn` em `_authenticated.waterfall.tsx:118` e `comparativo.tsx:66`. Exemplar.
- **Custo de servir:** `getCustomerPnL` (`cost-to-serve.functions.ts:13`) → `_authenticated.custo-de-servir.tsx:26`. Exemplar.
- **Share público:** `shared_links` → `getSharedWaterfall` (sem middleware de auth, valida token) → `share.$token.tsx`. Fatia bem desenhada, incluindo o caso não-autenticado.

**Onde a fatia se rompe (escrita):** todas as mutações do domínio pulam a camada de serviço e vão do browser direto à tabela:
- `_authenticated.clientes.tsx:29,36,47` — `supabase.from("customers").insert/delete` direto.
- `_authenticated.inputs.tsx:104,133` — `supabase.from("line_inputs").upsert` direto (inclusive gravando `ai_extraction` cru).
- `_authenticated.admin.tsx:77,94–101` — escreve `business_units`, `user_roles`, `profiles` direto.

Isso é *meia fatia*: a leitura é servidor-autoritativa (por causa do guest via RLS), a escrita é cliente-autoritativa (confia só na RLS). A consequência prática aparece em `inputs.tsx`: como não há `serverFn` de escrita, a regra "prioridade default P1" e a chave de conflito `onConflict: "line_code,customer_id,bu,reference_date"` estão **na tela**, e teriam que ser reescritas em qualquer outro caller. Não é inseguro por si (a RLS `inputs_write_own_dept`, migração `...003917:122`, exige `department = current_department()`), mas é uma inconsistência arquitetural que multiplica lógica.

---

## 3 — TDD

**Estado: 🔴 ausente.** Verificado:
- `package.json` — `scripts` são só `dev / build / build:dev / preview / lint / format`. **Nenhum** `test`. **Nenhum** `vitest`/`jest`/`@testing-library` em `dependencies` nem `devDependencies`.
- Busca por `**/*.{test,spec}.{ts,tsx,js}` em `cascata/` → **zero arquivos**.

Pocock argumenta que fundamentos importam *mais* na era da IA porque a IA gera muito código rápido — e código financeiro não-testado é passivo, não ativo. Aqui o risco é concentrado e mensurável: **o número é o produto**. Uma regressão silenciosa em `computeWaterfall` não quebra o build nem aparece no console — ela mostra uma Margem Bruta errada numa reunião com cliente.

**Onde começar (por ordem de alavancagem), e por quê:**

1. **Alocação de salário / rateio em `waterfall-core.ts:80–120` e `cost-to-serve.functions.ts:66–95`.** É a lógica mais sutil do repo: prioridade P1>P2>P3>MANUAL>RATEIO, "melhor valor por (linha, cliente)", e rateio de salário ponderado por receita — com o *fallback* traiçoeiro de `weightSum === 0` (`waterfall-core.ts:113`) que divide igualmente. É determinística e é exatamente onde um humano erraria. Casos-alvo: dois inputs mesma célula com prioridades diferentes → vence a de menor índice; nó de org sem clientes casados → cai em `personnelLine` inteiro (`:106–109`); `weightSum=0` → divide por N.
2. **Somatórios de KPI do P&L** (o alvo do achado A1): dado um mapa de totais por código, `grossRevenue = Σ(1..5)`, `netRevenue = grossRevenue − Σ(6..8)`, `pocket`. Um único teste de tabela pega a divergência R$-vs-% entre `waterfall.tsx` e `comparativo.tsx` na hora.
3. **`fileToText` (`file-parse.ts`)** — parse de XLSX multi-aba → CSV. Barato de testar com um fixture pequeno, e é a porta de entrada de dados sujos do cliente para a IA.

**Nota sobre "core puro".** O prompt sugere que `waterfall-core.ts` seria matemática *pura*. Na prática **não é pura**: `computeWaterfall` faz suas próprias leituras via `supabaseAdmin` (`:24–36`). É um *módulo profundo de acesso a dados*, não uma função pura — então hoje só é testável com banco/mocks. Ver A3: extrair o núcleo aritmético (sem I/O) é o que o torna um alvo de TDD de verdade.

---

## 4 — Módulos profundos (Ousterhout)

Interface simples sobre implementação poderosa. Cascata tem exemplos dos dois extremos.

**Profundos e corretos — creditar e usar como modelo:**

- **`waterfall-core.ts` / `waterfall.functions.ts` — a separação É real e boa.** Verificado lado a lado: `computeWaterfall(args)` (`waterfall-core.ts:21`) esconde ~120 linhas de junção de 5 tabelas, dedupe por prioridade e rateio atrás de uma assinatura de uma linha. `getWaterfall` (`waterfall.functions.ts:18–24`) e `getSharedWaterfall` (`:28–52`) são wrappers finos que **ambos** reusam o mesmo núcleo — o autenticado adiciona `requireApprovedUser`, o público resolve o token e chama o mesmo `computeWaterfall`. Isso é exatamente o padrão de "core profundo + adaptadores finos". **É o modelo que as fatias de KPI (A1) e de auth (A2) deveriam seguir.**
- **`require-approved.ts` — guard profundo.** `requireApprovedUser(userId)` (`:6`) esconde a busca combinada `profiles.is_approved` + `user_roles` e a regra "admin OU aprovado" atrás de um `Promise<void>` que lança se negado. Responsabilidade única, ocultação de informação limpa, reusado por todos os serverFn sensíveis.
- **`file-parse.ts` / `config.ts`** — pequenos e honestos. `fileToText` esconde a mecânica do `xlsx`; `config.ts` centraliza dois e-mails. Sem queixas.

**Raso e replicado — o problema central:** **os KPIs do P&L são um módulo raso instanciado 5 vezes.** A mesma cadeia (`grossRevenue → deductions → netRevenue → grossMargin → pocket`) aparece independentemente em:
- `_authenticated.waterfall.tsx:79–89` (`kpisFor`, códigos hardcoded `["1".."5"]`, pocket em R$),
- `_authenticated.comparativo.tsx:40–52` (`kpisFor`, derivado de `bucket`, pocket em **%**),
- `share.$token.tsx:56–62` (hardcoded `1..29`),
- `demo.tsx:64` (mais uma variante),
- e o núcleo server (`waterfall-core.ts`) que produz os totais que todas consomem.

Duas funções chamadas `kpisFor`, em dois arquivos, com **assinaturas e semânticas diferentes**, é a definição de módulo raso: nenhuma esconde complexidade, todas expõem a mesma fórmula, e mantê-las em sincronia é trabalho manual que **já falhou** (o pocket R$-vs-%). O mesmo vale, em menor escala, para a detecção da linha de pessoal `(...).includes("pessoal")` + alocação, copiada verbatim entre `waterfall-core.ts:80–82` e `cost-to-serve.functions.ts:66–68`.

---

## 5 — Ocultação de informação & consciência de design de sistema

**O que está certo.**
- **`supabaseAdmin` (service-role, bypassa RLS) está contido.** 25 ocorrências em **5** arquivos, todos server-only: `client.server.ts`, `waterfall-core.ts`, `waterfall.functions.ts`, `cost-to-serve.functions.ts`, `require-approved.ts`. Não vaza para rotas nem componentes. O acesso é via `Proxy` lazy (`client.server.ts:36`) com o comentário de segurança certo. Bom isolamento.
- A fronteira Zod é real: `Input.parse(d)` em cada `serverFn` (`waterfall.functions.ts:9–16,26,54`; `cost-to-serve.functions.ts:10`), com regex para `token` e `referenceDate`.
- O fluxo multi-tenant com gate de aprovação existe de ponta a ponta: `is_approved`/`user_roles` no schema, `requireApprovedUser` no server, e o `beforeLoad` em `_authenticated.tsx:12–27` no client.

**Seams e vazamentos concretos:**

1. **Assimetria de autorização através do seam serverFn↔edge (relevante para segurança).** Os `serverFn` chamam `requireApprovedUser` (`waterfall.functions.ts:22`, `cost-to-serve.functions.ts:17`). As **edge functions não**: `extract-customers/index.ts:18` e `extract-inputs/index.ts:19` só fazem `supabaseAdmin.auth.getUser(token)` e param aí. Resultado: um usuário **logado mas ainda não aprovado** (bloqueado no waterfall) ainda consegue chamar `extract-inputs`/`extract-customers` e queimar o orçamento de IA / a chave `AI_API_KEY`. O gate de aprovação precisa existir dos dois lados do seam — hoje existe só de um.

2. **Autorização "é admin ou aprovado" é reimplementada à mão 3×.** A mesma regra vive em `require-approved.ts:11–13` (server), `_authenticated.tsx:19–26` (client `beforeLoad`) e `_authenticated.admin.tsx:14–21` (guard de admin) — três leituras separadas de `profiles`+`user_roles`. `require-approved.ts` mostra a interface certa; as outras duas não a reusam (uma é client, mas ainda assim duplicam a lógica em vez de um helper compartilhado).

3. **RLS de tenant é `USING (true)` — isolamento multi-tenant é frágil.** `customers_all_auth` (`...003917:84`) e `org_all_auth` (`:101`) permitem a **qualquer** autenticado ler/escrever **todas** as linhas; a separação por BU é só um filtro de coluna no app (`.eq("bu", bu)`), não uma fronteira imposta. Para um app "multi-tenant with approval gating", vale documentar explicitamente que o tenant (BU) **não** é uma fronteira de segurança hoje — é organização visual.

4. **Erros são strings, não tipos.** ~20 `throw new Error("...")` (ex.: `waterfall.functions.ts:36–37`, `require-approved.ts:13`, `auth.functions.ts:11`). "Link inválido", "Link expirado" e "Forbidden: account pending approval" são indistinguíveis programaticamente do erro genérico do `errorMiddleware` (`start.ts:6–19`) — a UI só consegue mostrar `e.message`. Sem um tipo de erro (ex. `AppError` com `code`), o client não pode reagir diferente a "expirado" vs "não autorizado".

---

## Achados priorizados

### A1 — Matemática do P&L reimplementada 5× e **divergente** (P0)
- **Arquivos:** `_authenticated.waterfall.tsx:79–89`, `_authenticated.comparativo.tsx:40–52`, `share.$token.tsx:56–62`, `demo.tsx:64`, e o núcleo `waterfall-core.ts`.
- **Sintoma:** Cinco definições independentes de `grossRevenue/netRevenue/grossMargin/pocket`. Duas funções chamadas `kpisFor` com semânticas diferentes: em `waterfall.tsx` `pocket` é **R$** (`grossMargin − opex`); em `comparativo.tsx` `pocketMargin` é **%** (`margemBruta/receitaLiquida×100`). Ambas rotuladas "Pocket Margin" na UI para o mesmo usuário. Os códigos das linhas (`1..5`, `6..8`, `9..16`, `17..29`) estão hardcoded e repetidos.
- **Princípio ferido:** Linguagem ubíqua (1), Módulos profundos (4), (habilita 3).
- **Correção:** criar `src/lib/pnl.ts` como módulo profundo único e **puro** (só `Map<string,number>` + linhas, sem I/O), no espírito do `waterfall-core`:
  ```ts
  // src/lib/pnl.ts
  export type PnLKpis = { grossRevenue: number; deductions: number; netRevenue: number;
                          grossMargin: number; opex: number; pocket: number; pocketPct: number };
  export function computePnLKpis(totals: Map<string, number>): PnLKpis { /* soma 1..29 uma vez */ }
  ```
  Trocar as 5 cópias por `computePnLKpis(...)`. Nomear os dois conceitos distintamente na UI: **"Pocket Margin (R$)"** vs **"Pocket %"** — nunca o mesmo rótulo para os dois.
- **Aceite:** os códigos `["1".."29"]` aparecem em **um** arquivo; `grep "grossMargin - opex"` retorna 1 ocorrência; waterfall e comparativo mostram valores coerentes com rótulos que deixam claro R$ vs %; um teste de tabela cobre `computePnLKpis`.

### A2 — Extrair um núcleo de waterfall **puro** para destravar testes (P0)
- **Arquivo:** `waterfall-core.ts:21–138` (I/O + aritmética misturados).
- **Sintoma:** `computeWaterfall` faz as leituras `supabaseAdmin` *e* toda a matemática de dedupe/rateio no mesmo corpo, então a lógica financeira só roda com um banco atrás.
- **Princípio ferido:** TDD (3), Módulos profundos (4).
- **Correção (passos):** (1) manter `computeWaterfall` como o *data-access* (busca as 5 tabelas); (2) extrair `reduceWaterfall(inputs, lines, orgNodes, salaries, customers, args): { totalsByCode, subTotalsByCode, salaryTotal }` — função pura, zero imports de Supabase; (3) `computeWaterfall` = buscar + `reduceWaterfall`. Fazer `cost-to-serve.functions.ts` reusar o mesmo redutor (hoje ele reimplementa `best`/`revenueByCustomer`/detecção de pessoal, `:39–95`).
- **Aceite:** `reduceWaterfall` não importa nada de `@/integrations/supabase`; testes cobrem prioridade P1>P2>P3, `weightSum===0`, e nó sem clientes; `cost-to-serve` e `waterfall` compartilham a detecção da linha de pessoal.

### A3 — Adotar um test runner e cobrir o núcleo financeiro (P0)
- **Arquivo:** `package.json` (sem `test`).
- **Sintoma:** zero testes num app cujo output *é* dinheiro.
- **Princípio ferido:** TDD (3).
- **Correção:** adicionar `vitest` (devDep) + `"test": "vitest"`; primeiros arquivos: `pnl.test.ts` (A1), `waterfall-reduce.test.ts` (A2), `file-parse.test.ts`. Ligar no CI (`.github/workflows/deploy.yml`).
- **Aceite:** `npm test` roda; ≥ 3 arquivos de teste; a regressão R$-vs-% de A1 é pega por um teste.

### A4 — Edge functions não checam aprovação (P0, segurança)
- **Arquivos:** `supabase/functions/extract-inputs/index.ts:19`, `extract-customers/index.ts:18`.
- **Sintoma:** só validam `getUser(token)`. Um usuário logado **não aprovado** consegue disparar a IA (custo + chave `AI_API_KEY`), embora esteja bloqueado no resto do app.
- **Princípio ferido:** Ocultação de informação / design de sistema (5) — o gate existe de um lado do seam só.
- **Correção:** após obter `user`, checar aprovação com o mesmo critério do `require-approved` (consultar `profiles.is_approved` + `user_roles`), retornando `403` se negado. Como é outro runtime (Deno), replicar a *regra* (não o arquivo) e deixar um comentário linkando `src/lib/require-approved.ts` como fonte da verdade conceitual.
- **Aceite:** chamada a `extract-inputs` com token de usuário não aprovado retorna 403; usuário aprovado segue funcionando.

### A5 — Consolidar a regra de autorização "admin OU aprovado" (P1)
- **Arquivos:** `require-approved.ts:6–15`, `_authenticated.tsx:19–26`, `_authenticated.admin.tsx:14–21`.
- **Sintoma:** três implementações da mesma leitura `profiles`+`user_roles` e do mesmo predicado.
- **Princípio ferido:** Módulos profundos (4), Ocultação de informação (5).
- **Correção:** extrair um helper client (ex. `getAccessState(userId): { isAdmin, isApproved }`) usado por `_authenticated.tsx` e `admin.tsx`; manter `requireApprovedUser` como a versão server. Um lugar define "quem é admin OU aprovado".
- **Aceite:** o predicado `isAdmin || is_approved` aparece em 1 helper client + 1 server; as rotas chamam o helper.

### A6 — Padronizar mutações de escrita atrás de serverFns (P1)
- **Arquivos:** `_authenticated.inputs.tsx:104,133`, `_authenticated.clientes.tsx:29,36,47`.
- **Sintoma:** regras de escrita (default `priority:"P1"`, chave `onConflict`, gravar `ai_extraction`) vivem na tela; a fatia vertical existe só na leitura.
- **Princípio ferido:** Fatias verticais (2), Módulos profundos (4).
- **Correção:** criar `saveLineInput` / `upsertCustomer` como `serverFn` (com Zod + `requireApprovedUser`), simétricos a `getWaterfall`. As telas param de conhecer a chave de conflito e o default de prioridade. Bônus: fecha o buraco de um usuário aprovado escrever em qualquer BU/depto sem revalidação server-side.
- **Aceite:** `inputs.tsx`/`clientes.tsx` não contêm mais `.upsert(`/`.insert(` direto de tabela de domínio; a lógica de conflito mora no serverFn.

### A7 — Erros tipados em vez de `throw new Error("string")` (P2)
- **Arquivos:** ~20 sites; ex. `waterfall.functions.ts:36–37`, `require-approved.ts:13`, `auth.functions.ts:11–12`.
- **Sintoma:** "Link expirado", "Forbidden", "Rate limit" são indistinguíveis por código; a UI só tem `e.message`.
- **Princípio ferido:** Ocultação de informação / design de sistema (5).
- **Correção:** `class AppError extends Error { constructor(public code: "EXPIRED"|"FORBIDDEN"|"NOT_FOUND"|..., message: string) }`. Server lança `AppError`; `errorMiddleware` (`start.ts`) serializa `code`; client reage por `code` (ex. mostrar CTA "pedir novo link" só em `EXPIRED`).
- **Aceite:** os throws de domínio carregam `code`; `share.$token.tsx` distingue expirado de inválido pela `code`, não pelo texto.

### A8 — Cor fora da paleta escondida em `use-business-units.ts` (P2)
- **Arquivo:** `src/hooks/use-business-units.ts:7–14`.
- **Sintoma:** `BU_COLORS` mistura tokens (`var(--marine)`, `var(--gold)`) com hex crus `#7d3c98`, `#d35400` — a mesma classe de problema que o `README.md` mapeou em `DEPT_COLORS` (já corrigido em `inputs.tsx:15`), mas ainda vivo aqui e consumido por `waterfall.tsx`/`comparativo.tsx` via `colorOf`.
- **Princípio ferido:** Linguagem ubíqua (1) (cor como token de domínio). *(Cruza com o DS; incluído por ser código, não `styles.css`.)*
- **Correção:** trocar os dois hex por tokens da rampa Cascata (ou tint do marinho), como foi feito em `DEPT_COLORS`.
- **Aceite:** `use-business-units.ts` não contém hex literais.

---

## O que já está certo (não regredir)

- **`waterfall-core.ts` + `waterfall.functions.ts`: separação núcleo-profundo/wrapper-fino real.** Um `computeWaterfall` reusado pelo caminho autenticado e pelo público. **É o modelo a seguir** — não desfazer ao aplicar A1/A2.
- **`require-approved.ts`: guard de autorização profundo e reusado** pelos serverFn sensíveis.
- **`supabaseAdmin` contido** em 5 arquivos server-only, via `Proxy` lazy, com aviso de segurança; nunca em client/rota.
- **Fronteira Zod** em toda `serverFn` de entrada, com regex para token e data.
- **Fluxo multi-tenant com gate de aprovação** de ponta a ponta (schema `is_approved`/`user_roles` → `requireApprovedUser` → `beforeLoad`).
- **Substantivos do domínio consistentes** entre migrações, `src/lib/*` e rotas; `bucket`/`priority` como value objects estáveis.
- **Formatação financeira PT-BR** (`Intl.NumberFormat("pt-BR", … BRL)`) centralizada por tela e `tabular-nums` nas colunas numéricas.
- **Auditoria imutável de inputs** (`line_inputs_audit`, migração `...041034`) — trilha de quem mudou qual valor, coerente com app financeiro.

---

## Checklist de verificação

- [x] Os códigos de linha do P&L (`["1".."29"]`) aparecem em **um único** arquivo (`src/lib/pnl.ts`). *(A1)*
- [x] `grep -rn "grossMargin - opex" src/` retorna **1** ocorrência. *(A1)*
- [x] Nenhum rótulo "Pocket Margin" ambíguo: R$ e % têm nomes distintos na UI (`Pocket Margin (R$)` vs `Pocket %`). *(A1)*
- [x] Existe `reduceWaterfall` puro, sem `import` de `@/integrations/supabase`. *(A2)*
- [x] `cost-to-serve` reusa o núcleo (`bestByCell` / `computeRevenueByCustomer` / `findPersonnelLine`) — sem cópia do dedupe nem da detecção de linha de pessoal. *(A2)*
- [x] `npm test` roda; ≥ 3 arquivos de teste cobrindo P&L (`pnl.test.ts`), rateio (`waterfall-reduce.test.ts`) e parse (`file-parse.test.ts`). *(A3)*
- [ ] `extract-inputs`/`extract-customers` retornam 403 para usuário não aprovado. *(A4)*
- [ ] O predicado "admin OU aprovado" vive em 1 helper client + 1 server. *(A5)*
- [ ] `inputs.tsx`/`clientes.tsx` não fazem `.upsert(`/`.insert(` direto em tabela de domínio. *(A6)*
- [ ] Throws de domínio carregam `code`; a UI de share distingue expirado × inválido por `code`. *(A7)*
- [ ] `use-business-units.ts` não contém hex literais. *(A8)*
- [ ] Documentado que a BU **não** é fronteira de segurança (RLS `USING(true)`); é organização visual. *(§5)*
