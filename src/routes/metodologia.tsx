import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/metodologia")({
  component: MetodologiaPage,
  head: () => ({
    meta: [
      { title: "Metodologia — Cascata" },
      { name: "description", content: "Como funciona a Cascata: as 29 linhas do waterfall, os três níveis de precisão (P1, P2, P3) e o rateio de salário pelo organograma." },
      { property: "og:title", content: "Metodologia — Cascata" },
      { property: "og:description", content: "As 29 linhas do waterfall, os três níveis de precisão (P1, P2, P3) e o rateio de salário pelo organograma." },
      { property: "og:url", content: "https://cascata.pereirasaraiva.com/metodologia" },
    ],
    links: [
      { rel: "canonical", href: "https://cascata.pereirasaraiva.com/metodologia" },
    ],
  }),
});

function MetodologiaPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="font-display text-3xl text-primary" style={{ fontVariationSettings: '"opsz" 144' }}>
              Cascata
            </span>
            <span className="eyebrow">por J P Saraiva</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-20">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <p className="eyebrow mb-8">METODOLOGIA</p>
          <h1 className="font-display text-5xl md:text-6xl text-primary leading-[1.05] mb-14">
            Como funciona o <em className="italic font-normal text-[var(--purple-deep)]">price waterfall</em> por cliente
          </h1>

          {/* Section 1 */}
          <section className="mb-16">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="font-display text-3xl text-[var(--gold)]">01</span>
              <h2 className="text-2xl font-semibold text-primary">Por que 29 linhas?</h2>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              O price waterfall decompõe a receita bruta até o custo de servir num passo a passo que qualquer profissional de pricing consegue explicar a um diretor comercial em três minutos. Foram 29 linhas porque &mdash; depois de testar com mais de quarenta variações em setores diferentes (indústria, varejo, serviços financeiros, saúde) &mdash; esse é o ponto em que a cascata mostra o que importa sem quebrar o interesse do leitor. Menos linhas escondem o defeito; mais linhas escondem o padrão. As 29 linhas vão da lista de preços ao lucro operacional por cliente, separando receita de produto e serviço, quebra comercial, descontos táticos, subsídios, custos logísticos, salários rateados, incentivos e, por fim, o imposto sobre lucro. Cada linha tem um dono claro no organograma.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-16">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="font-display text-3xl text-[var(--gold)]">02</span>
              <h2 className="text-2xl font-semibold text-primary">P1, P2 e P3: três níveis de precisão</h2>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed mb-6">
              Nem todo cliente nasce com a mesma maturidade de dados. Por isso a Cascata trabalha com três níveis de precisão, e o usuário escolhe qual usar antes de montar o waterfall:
            </p>
            <div className="space-y-5">
              <div className="border-l-2 border-[var(--gold)] pl-5">
                <h3 className="text-base font-semibold text-primary mb-1">P1 &mdash; Cliente por cliente</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O nível mais preciso. Cada linha do waterfall recebe o valor real atribuído a esse cliente: preço faturado, desconto aplicado, custo de entrega para aquele CEP, horas da equipe de atendimento específica. Usa quando a empresa já tem CRM enriquecido, DRE por cliente ou contratos detalhados. É o cenário ideal para tomada de decisão de preço.
                </p>
              </div>
              <div className="border-l-2 border-[var(--steel)] pl-5">
                <h3 className="text-base font-semibold text-primary mb-1">P2 &mdash; Média por tipo de cliente</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Quando não se tem o dado individualizado, agrupa os clientes em tipos (B2B estratégico, B2B volume, B2C premium, B2C massa etc.) e aplica médias. O preço médio, o desconto médio e o custo médio de cada tipo alimentam a cascata. É o nível mais comum em empresas que têm ERP, mas ainda não segmentam a operação por cliente.
                </p>
              </div>
              <div className="border-l-2 border-[var(--stone)] pl-5">
                <h3 className="text-base font-semibold text-primary mb-1">P3 &mdash; Razão sobre o total da empresa</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O nível de partida. Cada cliente recebe uma fatia proporcional do total da empresa segundo um driver racional: receita, volume, transações ou margem esperada. É útil quando o único dado disponível é o consolidado da DRE e a empresa quer começar a conversa sobre pricing antes de investir em sistemas. Não é preciso, mas é honesto: mostra exatamente o que se sabe e o que se supõe.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-16">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="font-display text-3xl text-[var(--gold)]">03</span>
              <h2 className="text-2xl font-semibold text-primary">Rateio de salário pelo organograma</h2>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              O custo de servir um cliente não está numa nota fiscal &mdash; está nas pessoas que atendem, vendem, entregam e cobram. A Cascata lê o organograma da empresa (BU, departamentos e funções) e, para cada função, calcula o custo total anual: salário + encargos + benefícios + rateio de infraestrutura e administrativo. Depois distribui esse custo pelos clientes de acordo com o tempo que cada departamento dedica a cada tipo de conta. Se o departamento de vendas dedica 40% do tempo a clientes B2B e 60% a B2C, o custo de vendas se rateia nessa proporção. Se dentro de B2B há três clientes que consomem diferentes intensidades de atendimento, o rateio desce mais um nível. O resultado é um custo de servir por cliente que reflete a estrutura real da empresa &mdash; não um percentual genérico sobre a receita.
            </p>
          </section>

          {/* CTA */}
          <div className="border-t border-border pt-10 mt-16 flex flex-wrap items-center gap-6">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 text-sm font-semibold uppercase tracking-[0.14em] hover:bg-[var(--purple-deep)] transition-colors"
            >
              Criar conta
            </Link>
            <Link
              to="/"
              className="text-sm text-foreground underline underline-offset-4 hover:text-primary"
            >
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="flex items-center justify-between py-5">
            <span>Cascata · 2026</span>
            <span className="uppercase tracking-[0.18em]">Price waterfall · IA · P&L por cliente</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
