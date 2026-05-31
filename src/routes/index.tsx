import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { BrandFooter } from "@/components/brand/BrandFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";

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

const PREVIEW_LINES = [
  { n: "P0",   label: "Receita bruta",             value: "R$ 1.850k", type: "root"  },
  { n: "P1–3", label: "Descontos comerciais",       value: "−R$ 278k",  type: "sub"   },
  { n: "R1",   label: "Receita líquida 1",           value: "R$ 1.573k", type: "total" },
  { n: "P5",   label: "Impostos sobre vendas",       value: "−R$ 278k",  type: "sub"   },
  { n: "P6",   label: "Custo da mercadoria",         value: "−R$ 740k",  type: "sub"   },
  { n: "P7",   label: "Margem bruta",                value: "R$ 555k",   type: "total" },
  { n: "↳",    label: "33 sublinhas de desconto…",  value: null,         type: "drill" },
  { n: "P8–9", label: "Custo de atendimento",        value: "−R$ 74k",   type: "sub"   },
  { n: "P10",  label: "Custo de servir",             value: "R$ 481k",   type: "total" },
];

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-24">
          <div className="mx-auto max-w-5xl px-6 md:px-10">
            <p className="eyebrow mb-8">Cascata · Pricing · Waterfall</p>
            <h1
              className="font-display italic font-normal text-[color:var(--cascata-ink)] mb-10"
              style={{
                fontSize: "clamp(46px, 6vw, 76px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0',
                maxWidth: "20ch",
              }}
            >
              Da receita bruta <em className="font-normal text-[color:var(--cascata-navy)]">ao custo de servir</em>, cliente a cliente.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mb-12">
              Cada departamento alimenta as linhas que conhece. A IA lê os arquivos enviados, identifica os campos por cliente, e o price waterfall se monta — com drill-down nos 33 tipos de desconto comercial e separação por BU.
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 h-10 px-8 text-xs font-semibold uppercase tracking-[0.18em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Criar conta
              </Link>
              <div className="inline-flex flex-col gap-1">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 h-10 px-8 text-xs font-semibold uppercase tracking-[0.18em] border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Ver demo
                </Link>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Modo demonstração · 5 clientes fictícios · somente leitura
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center h-10 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground transition-colors"
              >
                Entrar
              </Link>
            </div>
          </div>
        </section>

        {/* O que você recebe */}
        <section className="border-t border-border bg-card/40 py-20">
          <div className="mx-auto max-w-5xl px-6 md:px-10">
            <div className="flex items-end justify-between gap-8 mb-10">
              <div>
                <p className="eyebrow">O que você recebe</p>
                <h2
                  className="mt-4 font-display italic font-normal text-[color:var(--cascata-ink)] text-4xl md:text-5xl leading-[1.05] max-w-2xl"
                  style={{ fontVariationSettings: '"opsz" 96, "SOFT" 0, "WONK" 0' }}
                >
                  Um waterfall <em className="font-normal text-[color:var(--cascata-navy)]">por cliente</em>, do bruto ao custo de servir.
                </h2>
              </div>
              <p className="hidden md:block text-sm text-muted-foreground max-w-xs">
                29 marcos do P&L. A linha 7 abre um segundo waterfall com os 33 tipos de desconto comercial — por cliente, auditável.
              </p>
            </div>

            <div className="rounded-md border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">Acme Distribuidora · Q4 2025 · 29 marcos do P&L</span>
              </div>
              <div className="p-4">
                {PREVIEW_LINES.map((line, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 py-2 border-b border-border/40 last:border-0 ${
                      line.type === "total" ? "bg-muted/30 -mx-4 px-4" : ""
                    }`}
                  >
                    <span className={`w-12 text-[10px] font-mono shrink-0 ${
                      line.type === "total" ? "font-bold text-foreground" : "text-muted-foreground"
                    }`}>
                      {line.n}
                    </span>
                    <span className={`flex-1 text-sm ${
                      line.type === "total"
                        ? "font-semibold"
                        : line.type === "drill"
                        ? "italic text-primary/70"
                        : "text-muted-foreground"
                    }`}>
                      {line.label}
                    </span>
                    {line.value !== null && (
                      <span className={`font-mono text-sm tabular-nums ${
                        line.type === "total" ? "font-bold" : ""
                      } ${line.value.startsWith("−") ? "text-destructive/70" : ""}`}>
                        {line.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Antes / depois */}
        <section className="border-t border-border py-20">
          <div className="mx-auto max-w-5xl px-6 md:px-10">
            <p className="eyebrow">Antes / depois</p>
            <h2
              className="mt-4 font-display italic font-normal text-[color:var(--cascata-ink)] text-4xl md:text-5xl leading-[1.05] max-w-3xl"
              style={{ fontVariationSettings: '"opsz" 96, "SOFT" 0, "WONK" 0' }}
            >
              De planilhas isoladas ao waterfall <em className="font-normal text-[color:var(--cascata-navy)]">unificado por cliente</em>.
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/30 p-6">
                <p className="eyebrow text-muted-foreground">Antes — consolidação manual</p>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground font-mono leading-relaxed">
                  <p>vendas_2025_final_v3.xlsx — P1 por cliente</p>
                  <p>frete_clientes_Q4.csv — campos sem chave comum</p>
                  <p>descontos_clientes.pdf — tabela escaneada</p>
                  <p>custos_atend_BU2.xlsx — sem separação por conta</p>
                  <p className="text-muted-foreground/60">… + 3 dias de reconciliação manual</p>
                </div>
              </div>

              <div className="rounded-md border border-primary/30 bg-background p-6">
                <p className="eyebrow text-primary">Depois — waterfall automático</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">MAPEAMENTO</p>
                    <p className="mt-1 text-base leading-snug">A IA lê cada arquivo, identifica os campos por cliente e reconcilia chaves (código, nome ou CNPJ).</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">WATERFALL</p>
                    <p className="mt-1 text-base leading-snug">29 marcos do P&L, linha por linha, por cliente — em minutos.</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">DRILL-DOWN</p>
                    <p className="mt-1 text-base leading-snug">Linha 7 abre os 33 subtipos de desconto comercial, auditáveis e exportáveis.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Método */}
        <section className="border-t border-border py-20 bg-card/40">
          <div className="mx-auto max-w-5xl px-6 md:px-10">
            <p className="eyebrow mb-10">Método</p>
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
          </div>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
