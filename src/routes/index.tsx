import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Cascata — Price Waterfall por cliente" },
      { name: "description", content: "Decompõe receita até o custo de servir. Cada departamento alimenta o seu, a IA lê os arquivos e o waterfall se monta sozinho." },
    ],
  }),
});

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-12 py-8 flex items-center justify-between border-b border-border">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-display text-3xl text-primary" style={{ fontVariationSettings: '"opsz" 144' }}>
            Cascata
          </span>
          <a href="https://pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="eyebrow">por J P Saraiva</a>
        </Link>
        <nav className="flex items-center gap-8 text-sm">
          <Link to="/login" className="text-foreground hover:text-primary uppercase tracking-[0.18em] text-xs font-semibold">
            Entrar
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 uppercase tracking-[0.18em] text-xs font-semibold hover:bg-[var(--purple-deep)] transition-colors"
          >
            Criar conta <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 px-12 py-24">
        <div className="max-w-4xl">
          <p className="eyebrow mb-8">PRICING · WATERFALL</p>
          <h1 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[1.05] text-primary mb-10">
            Decompõe a receita até o <span className="italic font-normal text-[var(--purple-deep)]">custo de servir</span>, cliente a cliente.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mb-12">
            Cada departamento alimenta as linhas que conhece. A IA lê os arquivos enviados, identifica os campos por cliente, e o price waterfall se monta — com drill-down nos 33 tipos de desconto comercial e separação por BU.
          </p>
          <div className="flex items-center gap-8">
            <Link
              to="/signup"
              className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 text-sm font-semibold"
            >
              Criar conta
            </Link>
            <Link to="/login" className="text-sm text-foreground underline underline-offset-4 hover:text-primary">
              Entrar
            </Link>
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="border-t border-border px-12 py-20 bg-card/40">
        <p className="eyebrow mb-12">MÉTODO</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { n: "01", title: "Defina os clientes e o organograma", body: "BU, departamentos, contas e clientes. Salários e custos da hierarquia entram como gasto, com rateio quando faltar valor." },
            { n: "02", title: "Cada depto alimenta o seu", body: "Upload de arquivo (PDF, XLSX, CSV) por linha. A IA extrai os campos por cliente, P1 → P2 → P3 como fallback." },
            { n: "03", title: "Waterfall com drill-down", body: "29 marcos do P&L. A linha 7 abre um segundo waterfall com as 33 sublinhas de desconto comercial — sem misturar." },
          ].map((s) => (
            <div key={s.n} className="border-t border-foreground/30 pt-6">
              <div className="font-display text-4xl text-[var(--gold)] mb-6" style={{ fontVariationSettings: '"opsz" 96' }}>
                {s.n}
              </div>
              <h3 className="font-display text-xl text-primary mb-3">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-12 py-8 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Cascata · 2026</span>
        <span className="uppercase tracking-[0.18em]">Price waterfall · IA · P&L por cliente</span>
      </footer>
    </div>
  );
}
