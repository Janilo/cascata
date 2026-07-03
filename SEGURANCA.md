# Fronteiras de segurança do Cascata

> Item §5 da auditoria (`AUDITORIA-ARQUITETURA.md`): deixar explícito **o que o
> banco impõe** (RLS) e o que é só organização visual — para ninguém assumir
> proteção onde não existe.

## As fronteiras reais (impostas por RLS + re-checadas no servidor)

| Fronteira | Regra | Onde vive |
|---|---|---|
| **Gate de aprovação** | entrar no app exige `profiles.is_approved` OU role `admin` | client: `src/lib/access.ts` (`getAccessState`) · server: `src/lib/require-approved.ts` (todo serverFn sensível) · edge: `supabase/functions/extract-*` (403 para não aprovado) |
| **Departamento** | escrever em `line_inputs` exige `admin` OU `department = current_department()` (o departamento do próprio perfil) | RLS em `...003917.sql`; o serverFn `saveLineInput` deriva o `department` do perfil, nunca do payload |
| **Dono da linha** | escrever em `customers` e `org_nodes` exige `admin` OU `created_by = auth.uid()` | RLS em `...010826.sql`; `addCustomers` grava `created_by` explicitamente |
| **Admin-only** | `org_node_salaries` (tudo), `line_inputs_audit` (leitura), aprovação/roles | RLS em `...010826.sql` e `...041034.sql` |

A trilha `line_inputs_audit` é preenchida por trigger com `changed_by = auth.uid()` —
por isso os serverFns de escrita usam o client **do usuário** (`context.supabase`),
nunca `supabaseAdmin` (que apagaria a atribuição e pularia o RLS).

## BU **não** é fronteira de segurança

A separação por BU (B2B/B2C/…) é **filtro de coluna no app** (`.eq("bu", ...)`)
e organização visual (abas, cores em `use-business-units.ts`). O banco não a
impõe: as leituras de `customers`, `waterfall_lines` e `line_inputs` são
`USING (true)` para qualquer autenticado — **todo usuário aprovado enxerga
todas as BUs**, e escreve em qualquer BU dentro do seu departamento.

Se um dia BUs precisarem virar tenants de verdade, o caminho é:

1. mapear usuário→BU (ex.: coluna `bu` em `profiles`);
2. policies por `bu` nas tabelas de domínio (como hoje existe por `department`);
3. re-checar a BU nos serverFns de escrita (como hoje se faz com `department`).

Até lá: não tratar a BU como isolamento entre clientes/áreas — é UX, não ACL.
