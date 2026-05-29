import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye } from "lucide-react";
import { useState } from "react";
import { CascataWordmark } from "@/components/brand/CascataWordmark";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Cascata — Price Waterfall por cliente" },
      { name: "description", content: "Decompõe receita até o custo de servir. Cada departamento alimenta o seu, a IA lê os arquivos e o waterfall se monta sozinho." },
      { property: "og:title", content: "Cascata — Price Waterfall por cliente" },
      { property: "og:description", content: "Decompõe receita até o custo de servir. Cada departamento alimenta o seu, a IA lê os arquivos e o waterfall se monta sozinho." },
      { property: "og:url", content: "https://cascata.pereirasaraiva.com/" },
    ],
    links: [
      { rel: "canonical", href: "https://cascata.pereirasaraiva.com/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Cascata",
          url: "https://cascata.pereirasaraiva.com/",
          description: "Navegador de Price Waterfall por cliente para operações B2B e B2C.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Pereira Saraiva",
          url: "https://pereirasaraiva.com",
          brand: { "@type": "Brand", name: "Cascata" },
          sameAs: ["https://cascata.pereirasaraiva.com/"],
        }),
      },
    ],
  }),
});

function LandingPage() {
  const navigate = useNavigate();
  const [loadingGuest, setLoadingGuest] = useState(false);

  const enterAsGuest = async () => {
    setLoadingGuest(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: "convidado@cascata.app",
      password: "cascata-demo-2026",
    });
    if (error) {
      toast.error("Não foi possível entrar como convidado", { description: error.message });
      setLoadingGuest(false);
      return;
    }
    navigate({ to: "/waterfall" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-12 py-8 flex items-center justify-between border-b border-border">
        <Link to="/" className="flex items-center gap-3" aria-label="Cascata — início">
          <CascataWordmark height={30} />
          <a href="https://pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="eyebrow">por J P Saraiva</a>
        </Link>
        <nav className="flex items-center gap-8 text-sm">
          <Link to="/metodologia" className="text-foreground hover:text-primary uppercase tracking-[0.18em] text-xs font-semibold">
            Metodologia
          </Link>
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

      {/* Hero + Method */}
      <main className="flex-1">
        <section className="px-12 py-24">
          <div className="max-w-4xl">
            <p className="eyebrow mb-8">Cascata · Pricing · Waterfall</p>
            <h1 className="font-display text-6xl md:text-7xl lg:text-8xl leading-[1.05] text-primary mb-10">
              Da receita bruta <em className="italic font-normal text-[var(--cascata-navy-deep)]">ao custo de servir</em>, cliente a cliente.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mb-12">
              Cada departamento alimenta as linhas que conhece. A IA lê os arquivos enviados, identifica os campos por cliente, e o price waterfall se monta — com drill-down nos 33 tipos de desconto comercial e separação por BU.
            </p>
            <div className="flex flex-wrap items-center gap-8">
              <Link
                to="/signup"
                className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 text-sm font-semibold"
              >
                Criar conta
              </Link>
              <button
                type="button"
                onClick={enterAsGuest}
                disabled={loadingGuest}
                className="inline-flex items-center gap-2 border border-primary text-primary px-8 py-4 text-sm font-semibold uppercase tracking-[0.14em] hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                {loadingGuest ? "Entrando…" : "Entrar como convidado"}
              </button>
              <Link to="/login" className="text-sm text-foreground underline underline-offset-4 hover:text-primary">
                Entrar
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-4 uppercase tracking-[0.14em]">
              Modo demonstração · 5 clientes fictícios · somente leitura
            </p>

          </div>
        </section>

        {/* Method */}
        <section className="border-t border-border px-12 py-20 bg-card/40">
          <h2 className="eyebrow mb-12 font-normal">MÉTODO</h2>
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
      </main>

      <footer className="px-12 border-t border-border text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5 border-b border-border uppercase tracking-[0.18em]">
          <span className="font-semibold">Outros produtos</span>
          <a href="https://prisma.pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Prisma <span className="opacity-50">· Marketing Mix Modeling</span></a>
          <a href="https://lente.pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Lente <span className="opacity-50">· Pesquisa Qualitativa</span></a>
          <a href="https://pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">pereirasaraiva.com</a>
        </div>
        <div className="flex items-center justify-between py-5">
          <span>Cascata · 2026</span>
          <span className="uppercase tracking-[0.18em]">Price waterfall · IA · P&L por cliente</span>
        </div>
      </footer>
    </div>
  );
}
