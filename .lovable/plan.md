
# Cascata — plano de implementação

App de Price Waterfall multiusuário com 5 páginas, separação por departamento, leitura de arquivos com IA e visual do design system J P Saraiva (Fraunces + Inter Tight, roxo `#4A1942` + marinho + mostarda, hairlines, sem cantos arredondados, fundo cream).

## Stack & infra

- **Lovable Cloud** (auth email/senha + Postgres + Storage para uploads).
- **Lovable AI Gateway** (`google/gemini-3-flash-preview`) chamado via `createServerFn` para extrair campos de arquivos enviados.
- **Recharts** para waterfall e barras de progresso compostas.
- **Design system J P Saraiva** copiado para `src/styles.css` (tokens CSS + fontes Fraunces/Inter Tight locais em `public/fonts/`), aplicado globalmente. Componentes shadcn re-tematizados via tokens semânticos.

## Modelo de dados (Supabase)

- `profiles` (id, full_name, department, created_at) — depto definido por admin.
- `user_roles` (user_id, role: `admin`|`member`) — função `has_role()` security-definer.
- `customers` (id, account_id, account_name, customer_name, cnpj, bu `B2B|B2C`, attrs jsonb p/ rateios).
- `org_nodes` (id, parent_id, bu, department, leader, channel, account, customer, salary numeric) — estrutura hierárquica.
- `waterfall_lines` (seed estática derivada da planilha: code `'1'..'29'`, sub_code `'7.1'..'7.33'`, category, label, department, p1_desc, p2_desc, p3_desc, kind `revenue|deduction|cost|subtotal`, sort_order).
- `line_inputs` (id, line_code, customer_id, bu, department, priority `P1|P2|P3|MANUAL|RATEIO`, value numeric, rateio_key text, file_path, ai_extraction jsonb, updated_by, updated_at) — RLS: SELECT/UPDATE só do próprio depto (ou admin); leitura agregada para waterfall via server fn `supabaseAdmin` que devolve só totais.
- Bucket `inputs` no Storage com RLS por depto.

GRANTs explícitos em todas as tabelas + RLS por `auth.uid()`/`has_role()`/`profiles.department`.

## Páginas

### 1. `/` — Landing & login (estilo lente.pereirasaraiva.com)
- Header com wordmark "Cascata" em Fraunces + selo, links "Entrar" / "Criar conta".
- Hero esquerda-alinhado: eyebrow `PRICING · WATERFALL`, h1 grande serif com 1 palavra em itálico ("que se _aprofunda_ por cliente"), parágrafo em Inter Tight, dois CTAs (botão sólido roxo + link "Entrar").
- Seção "Método" 01/02/03 em mostarda (Definir → Inputs por depto → Síntese P&L).
- Fundo cream com paper-grain, hairlines, sem cards arredondados.
- Formulários `/login` e `/signup` em modal-route ou rota dedicada, mesmo layout sóbrio.

### 2. `/waterfall` (protegida) — Price Waterfall
- Toggle BU `B2B | B2C` no topo (segmented control hairline).
- KPIs: Receita Bruta, Deduções, Receita Líquida, Margem Pocket, Custo de Servir.
- **Gráfico waterfall principal** (Recharts BarChart stacked): uma barra por marco do P&L #1..#29 com subtotais destacados. Cores: receitas marinho, deduções roxo, custos verde, subtotais mostarda. Hairlines, labels no fim, sem legend box.
- Linha 7 ("Descontos comerciais") é clicável → abre **gráfico secundário abaixo** (slide-down) com waterfall só das sublinhas 7.1–7.33 agrupadas por categoria (Volume/Prazo/Segmento/Promo/Bundle/Estratégico/Canal/Retenção/Contratual). Esse subgráfico nunca se mistura ao principal.
- Botão "Inputs por departamento" → `/inputs`.
- Tabela detalhada por cliente ao final, com export CSV.

### 3. `/inputs` (protegida) — Inputs por departamento
- Server fn descobre `profile.department` e filtra `waterfall_lines.department = X`. Admins veem todos via toggle.
- Para cada linha do depto × cada cliente: card com 4 opções de fonte:
  - **P1 / P2 / P3** (textos vindos das colunas E/F/G) — escolhe priorização (P1 default; P2/P3 fallback).
  - **Manual** — input numérico.
  - Quando o tipo escolhido for "Rateio" (P3), só marca a chave de rateio (#seats, ARR, etc.); valor é calculado server-side.
- **Upload de arquivo** (PDF/XLSX/CSV) por linha ou em lote. Server fn `extractInputs`:
  1. salva no bucket `inputs`,
  2. extrai texto (xlsx via SheetJS, pdf via pdf-parse no Worker; fallback texto bruto),
  3. envia ao Lovable AI Gateway com schema tool-calling pedindo `{ customer_match, line_code, value, currency, confidence }[]`,
  4. grava em `line_inputs` com `ai_extraction` para auditoria.
- Toast com 402/429 do gateway.
- **Barras de progresso**:
  - **Barra do depto**: % de campos do próprio depto preenchidos.
  - **Barra global empilhada**: largura total = todos os campos; cada depto tem cor distinta (marinho/roxo/verde/mostarda/teal/…); a parte preenchida do depto desenhada sólida sobre a parte translúcida da mesma cor — assim dá pra ver visualmente qual depto está atrasado.

### 4. `/organograma` (protegida) — Organograma
- Estrutura vazia inicial + botão "Importar planilha de organograma" (upload XLSX, IA mapeia colunas).
- Visualização em árvore colapsável: BU → Departamento → Líder direto → Canal → Conta → Cliente. Apenas esses campos visíveis (salário oculto na UI mas usado nos cálculos).
- **Alocação de salário como gasto**: server fn calcula, para cada nó com salário, o cliente final; quando faltar valor em algum nível da hierarquia, faz rateio no último nível completo (proporcional à receita bruta daquele nível). Resultado flui para a linha "Pessoal" do waterfall.
- CRUD manual de nós para ajustes pontuais.

### 5. `/clientes` (protegida) — Clientes
- Tabela: ID conta, Conta, Nome cliente, CNPJ, + colunas dinâmicas para cada chave de rateio do waterfall (# seats, ARR, consumo, vertical, etc.).
- Ações: "Cadastrar manualmente" (form) e "Importar arquivo" (upload → IA extrai linhas → preview → confirmar).
- Filtro por BU, busca por nome/CNPJ, export CSV.

## Layout app

- Sidebar fixa esquerda (hairline) com links Waterfall / Inputs / Organograma / Clientes + avatar + logout. Header com breadcrumb e selo "Cascata".
- Rotas protegidas sob `_authenticated/` (TanStack), `beforeLoad` redireciona para `/login` mantendo `redirect=` search param.

## Detalhes técnicos

- Seed dos 29 marcos + 33 sublinhas vem de um JSON gerado da planilha enviada (cores E/F/G + departamentos preservados).
- Cálculo do waterfall: server fn agrega `line_inputs` por `line_code`+`bu`, aplicando priorização P1>P2>P3>MANUAL e rateios; retorna `{lineCode, value, runningTotal}[]` para o gráfico.
- Edge function de IA usa tool-calling para retornar JSON estruturado (sem parsing frágil); confidence < 0.7 marca a linha como "revisar".
- Single root `__root.tsx` mantido; rotas em `src/routes/` com convenção plana.

## Entregáveis nesta primeira iteração

1. Habilitar Lovable Cloud + criar tabelas, RLS, bucket e seed das linhas.
2. Aplicar design system JPS globalmente (fontes locais, tokens, base components).
3. Página 1 (landing + auth) — visual lente-like.
4. Página 2 (waterfall) com dados de exemplo, toggle BU e drill-down da linha 7.
5. Página 3 (inputs) com upload + IA + duas barras de progresso.
6. Página 4 (organograma) com import e árvore.
7. Página 5 (clientes) com CRUD + import.

Próximos itens (em iteração seguinte, se você quiser): permissões finas por linha, histórico/auditoria, exports PDF do waterfall, e dashboards comparativos entre BUs.
