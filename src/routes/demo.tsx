import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enterAsGuestFn } from "@/lib/auth.functions";
import { BrandFooter } from "@/components/brand/BrandFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
  head: () => ({
    meta: [
      { title: "Demo — Cascata · Price Waterfall" },
      { name: "description", content: "Veja o Cascata em ação: waterfall de receita bruta ao custo de servir, por cliente, com drill-down nos descontos comerciais." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const CLIENTS = [
  "Acme Distribuidora",
  "Bolt Industries",
  "Corvin Textil",
  "Delta Pharma",
  "Estela Agro",
];

const WATERFALL = [
  { n: "P0",  label: "Receita bruta",                       value:  1_850_000, type: "root"  },
  { n: "P1",  label: "Desconto de volume",                   value:   -185_000, type: "sub"   },
  { n: "P2",  label: "Desconto financeiro",                  value:    -55_500, type: "sub"   },
  { n: "P3",  label: "Bonificação",                         value:    -37_000, type: "sub"   },
  { n: "R1",  label: "Receita líquida 1",                    value:  1_572_500, type: "total" },
  { n: "P4",  label: "Frete e logística",                    value:    -92_500, type: "sub"   },
  { n: "P5",  label: "Impostos sobre vendas",                value:   -277_500, type: "sub"   },
  { n: "P6",  label: "Custo da mercadoria vendida",          value:   -740_000, type: "sub"   },
  { n: "P7",  label: "Margem bruta",                         value:    462_500, type: "total" },
  { n: "↳",   label: "33 sublinhas de desconto comercial…", value:       null, type: "drill" },
  { n: "P8",  label: "Comissão de vendas",                   value:    -46_250, type: "sub"   },
  { n: "P9",  label: "Custo de atendimento",                 value:    -27_750, type: "sub"   },
  { n: "P10", label: "Custo de servir",                      value:    388_500, type: "total" },
];

function fmtBRL(v: number) {
  const abs = Math.abs(v);
  const s = abs >= 1_000_000
    ? `R$ ${(abs / 1_000_000).toFixed(2)}M`
    : `R$ ${(abs / 1_000).toFixed(0)}k`;
  return v < 0 ? `−${s}` : s;
}

function DemoPage() {
  const navigate = useNavigate();
  const [activeClient, setActiveClient] = useState(0);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const enterAsGuest = useServerFn(enterAsGuestFn);

  const handleGuestEntry = async () => {
    setLoadingGuest(true);
    try {
      const session = await enterAsGuest();
      const { error } = await supabase.auth.setSession(session);
      if (error) throw error;
      navigate({ to: "/waterfall" });
    } catch (e) {
      toast.error("Não foi possível entrar como convidado", {
        description: e instanceof Error ? e.message : undefined,
      });
      setLoadingGuest(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Faixa demo-ready */}
      <div className="border-b border-border bg-[color:var(--cascata-navy)]/5">
        <div className="mx-auto max-w-5xl px-6 md:px-10 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[color:var(--cascata-navy)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--cascata-navy)]/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--cascata-navy)]" />
            </span>
            <span className="font-mono uppercase tracking-wider">Demo-ready</span>
            <span className="text-muted-foreground hidden sm:inline">· Não precisa de cadastro</span>
          </div>
          <Link
            to="/signup"
            className="rounded-sm border border-[color:var(--cascata-navy)]/40 bg-background px-2.5 py-1 font-medium text-[color:var(--cascata-navy)] hover:bg-[color:var(--cascata-navy)] hover:text-white transition-colors"
          >
            Criar conta →
          </Link>
        </div>
      </div>

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-5xl px-6 md:px-10 py-10">
            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
              <span className="px-2 py-1 bg-[color:var(--cascata-navy)]/10 text-[color:var(--cascata-navy)] uppercase tracking-wider">Demo · dados fictícios</span>
              <span>Price Waterfall gerado pelo Cascata</span>
            </div>
            <h1
              className="mt-4 font-display italic font-normal text-[color:var(--cascata-ink)] text-3xl md:text-4xl leading-tight"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0' }}
            >
              {CLIENTS[activeClient]}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground font-mono">B2B Distribuição · Q4 2025</p>
          </div>
        </section>

        {/* Waterfall + clients */}
        <section>
          <div className="mx-auto max-w-5xl px-6 md:px-10 py-12">
            <p className="eyebrow">Price Waterfall</p>
            <h2
              className="mt-3 font-display italic font-normal text-[color:var(--cascata-ink)] text-2xl md:text-3xl"
              style={{ fontVariationSettings: '"opsz" 96, "SOFT" 0, "WONK" 0' }}
            >
              Do bruto ao custo de servir, cliente a cliente.
            </h2>

            <div className="mt-10 grid gap-6 lg:grid-cols-5">
              {/* Client list */}
              <aside className="lg:col-span-2 space-y-2">
                <p className="eyebrow mb-4">Clientes</p>
                {CLIENTS.map((c, i) => (
                  <button
                    key={c}
                    onClick={() => setActiveClient(i)}
                    className={`w-full text-left px-4 py-3 border transition-colors text-sm font-semibold ${
                      i === activeClient
                        ? "border-[color:var(--cascata-navy)] bg-[color:var(--cascata-navy)]/5 text-[color:var(--cascata-navy)]"
                        : "border-border bg-background hover:border-[color:var(--cascata-navy)]/40 text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </aside>

              {/* Waterfall */}
              <div className="lg:col-span-3 rounded-md border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">29 marcos do P&L</span>
                </div>
                <div className="p-4">
                  {WATERFALL.map((line, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 py-2 border-b border-border/40 last:border-0 ${
                        line.type === "total" ? "bg-muted/30 -mx-4 px-4" : ""
                      }`}
                    >
                      <span className={`w-10 text-[10px] font-mono shrink-0 ${
                        line.type === "total" ? "font-bold text-foreground" : "text-muted-foreground"
                      }`}>
                        {line.n}
                      </span>
                      <span className={`flex-1 text-xs ${
                        line.type === "total" ? "font-semibold" : line.type === "drill" ? "italic text-primary/70" : "text-muted-foreground"
                      }`}>
                        {line.label}
                      </span>
                      {line.value !== null && (
                        <span className={`font-mono text-xs tabular-nums ${
                          line.type === "total" ? "font-bold" : ""
                        } ${line.value < 0 ? "text-destructive/70" : ""}`}>
                          {fmtBRL(line.value)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gostou do que viu? */}
        <section className="border-t border-border py-16">
          <div className="mx-auto max-w-5xl px-6 md:px-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <p className="eyebrow">Gostou do que viu?</p>
              <h2
                className="mt-3 font-display italic font-normal text-primary text-2xl leading-snug"
                style={{ fontVariationSettings: '"opsz" 96, "SOFT" 0, "WONK" 0' }}
              >
                Suba seus dados e monte o waterfall<br className="hidden md:block" /> em minutos.
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 items-start">
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleGuestEntry}
                  disabled={loadingGuest}
                  className="inline-flex items-center gap-2 border border-primary text-primary px-8 py-4 text-sm font-semibold uppercase tracking-[0.14em] hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  {loadingGuest ? "Entrando…" : "Entrar como convidado"}
                </button>
                <p className="text-[10px] text-muted-foreground font-mono">Não precisa de cadastro</p>
              </div>
              <Link
                to="/signup"
                className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Criar conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
