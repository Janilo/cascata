import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { BrandFooter } from "@/components/brand/BrandFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
  head: () => ({
    meta: [
      { title: "Demo — Cascata · Price Waterfall" },
      {
        name: "description",
        content:
          "Veja o Cascata em ação: waterfall de receita bruta ao custo de servir, por cliente, com drill-down nos descontos comerciais.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Demo — Cascata · Price Waterfall" },
      {
        property: "og:description",
        content: "Waterfall do bruto ao custo de servir. Cinco clientes B2B, dados fictícios.",
      },
      { property: "og:image", content: "/og-social.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-social.png" },
    ],
  }),
});

// ── types ─────────────────────────────────────────────────────────────────

type WLine = {
  n: string;
  label: string;
  value: number | null;
  type: "root" | "sub" | "total" | "drill";
  bucket: "revenue" | "deduction" | "cost" | "total";
};

type ChartRow = {
  id: string;
  name: string;
  label: string;
  bucket: "revenue" | "deduction" | "cost" | "total";
  base: number;
  bar: number;
  running: number;
};

// ── per-client datasets ───────────────────────────────────────────────────

const CLIENTS = [
  "Acme Distribuidora",
  "Bolt Industries",
  "Corvin Textil",
  "Delta Pharma",
  "Estela Agro",
];

function makeLines(
  rb: number,
  dv: number,
  df: number,
  bn: number,
  fr: number,
  im: number,
  cmv: number,
  cs: number,
  ca: number,
): WLine[] {
  const rl1 = rb + dv + df + bn;
  const mb = rl1 + fr + im + cmv;
  const pocket = mb + cs + ca;
  return [
    { n: "P0", label: "Receita bruta", value: rb, type: "root", bucket: "revenue" },
    { n: "P1", label: "Desconto de volume", value: dv, type: "sub", bucket: "deduction" },
    { n: "P2", label: "Desconto financeiro", value: df, type: "sub", bucket: "deduction" },
    { n: "P3", label: "Bonificação", value: bn, type: "sub", bucket: "deduction" },
    { n: "R1", label: "Receita líquida 1", value: rl1, type: "total", bucket: "total" },
    { n: "P4", label: "Frete e logística", value: fr, type: "sub", bucket: "cost" },
    { n: "P5", label: "Impostos sobre vendas", value: im, type: "sub", bucket: "cost" },
    { n: "P6", label: "Custo da mercadoria vendida", value: cmv, type: "sub", bucket: "cost" },
    { n: "P7", label: "Margem bruta", value: mb, type: "total", bucket: "total" },
    {
      n: "↳",
      label: "33 sublinhas de desconto comercial…",
      value: null,
      type: "drill",
      bucket: "deduction",
    },
    { n: "P8", label: "Comissão de vendas", value: cs, type: "sub", bucket: "cost" },
    { n: "P9", label: "Custo de atendimento", value: ca, type: "sub", bucket: "cost" },
    { n: "P10", label: "Custo de servir", value: pocket, type: "total", bucket: "total" },
  ];
}

const CLIENTS_DATA: WLine[][] = [
  // Acme Distribuidora — base
  makeLines(1_850_000, -185_000, -55_500, -37_000, -92_500, -277_500, -740_000, -46_250, -27_750),
  // Bolt Industries — menor escala, descontos maiores
  makeLines(1_100_000, -143_000, -33_000, -22_000, -72_000, -171_000, -506_000, -18_000, -12_000),
  // Corvin Textil — porte médio-grande, margens apertadas
  makeLines(
    2_400_000,
    -264_000,
    -72_000,
    -48_000,
    -161_280,
    -342_720,
    -1_008_000,
    -60_480,
    -40_320,
  ),
  // Delta Pharma — maior porte, menores deduções
  makeLines(
    3_200_000,
    -256_000,
    -64_000,
    -32_000,
    -199_360,
    -512_640,
    -1_140_000,
    -99_600,
    -59_760,
  ),
  // Estela Agro — menor porte
  makeLines(820_000, -90_200, -16_400, -24_600, -55_104, -116_896, -344_400, -20_688, -13_792),
];

// ── utilities ────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  const abs = Math.abs(v);
  const s =
    abs >= 1_000_000 ? `R$ ${(abs / 1_000_000).toFixed(2)}M` : `R$ ${(abs / 1_000).toFixed(0)}k`;
  return v < 0 ? `−${s}` : s;
}

function fmtShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

function buildChartRows(lines: WLine[]): ChartRow[] {
  let running = 0;
  const rows: ChartRow[] = [];
  for (const l of lines) {
    if (l.type === "drill" || l.value === null) continue;
    if (l.type === "root") {
      running += l.value;
      rows.push({
        id: l.n,
        name: l.n,
        label: l.label,
        bucket: "revenue",
        base: 0,
        bar: l.value,
        running,
      });
    } else if (l.type === "sub") {
      const delta = l.value;
      const base = delta < 0 ? running + delta : running;
      running += delta;
      rows.push({
        id: l.n,
        name: l.n,
        label: l.label,
        bucket: l.bucket,
        base,
        bar: Math.abs(delta),
        running,
      });
    } else {
      // milestone — does not advance running
      rows.push({
        id: l.n,
        name: l.n,
        label: l.label,
        bucket: "total",
        base: 0,
        bar: running,
        running,
      });
    }
  }
  return rows;
}

const colorFor = (bucket: ChartRow["bucket"]) =>
  bucket === "revenue" ? "var(--marine)" : bucket === "total" ? "var(--gold)" : "var(--outflow)";

// ── WaterfallChart ────────────────────────────────────────────────────────

function WaterfallChart({ data }: { data: ChartRow[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 44 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--stone)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9 }}
            interval={0}
            angle={-40}
            textAnchor="end"
            height={52}
            stroke="var(--soft)"
          />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} width={76} stroke="var(--soft)" />
          <Tooltip
            cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
            contentStyle={{
              fontSize: 12,
              border: "1px solid var(--stone)",
              borderRadius: 0,
              background: "var(--card)",
            }}
            formatter={(_v: unknown, _n: unknown, props: { payload?: ChartRow }) => {
              const row = props.payload;
              if (!row) return ["—", ""];
              if (row.bucket === "total") return [fmtBRL(row.running), row.label];
              return [`${fmtBRL(row.bar)} · acum. ${fmtBRL(row.running)}`, row.label];
            }}
          />
          <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="bar" stackId="a" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.id} fill={colorFor(d.bucket)} />
            ))}
            <LabelList
              dataKey="bar"
              position="top"
              formatter={(v: unknown) => {
                const n = Number(v);
                return n < 80_000 ? "" : fmtShort(n);
              }}
              style={{ fontSize: 9, fill: "var(--ink)" }}
            />
          </Bar>
          <Line
            type="stepAfter"
            dataKey="running"
            stroke="var(--gold)"
            strokeWidth={1.5}
            dot={{ r: 2, fill: "var(--gold)", stroke: "var(--gold)" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── DemoPage ──────────────────────────────────────────────────────────────

function DemoPage() {
  const [activeClient, setActiveClient] = useState(0);
  const lines = CLIENTS_DATA[activeClient];
  const chartRows = buildChartRows(lines);

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
            <span className="text-muted-foreground hidden sm:inline">
              · Não precisa de cadastro
            </span>
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
              <span className="px-2 py-1 bg-[color:var(--cascata-navy)]/10 text-[color:var(--cascata-navy)] uppercase tracking-wider">
                Demo · dados fictícios
              </span>
              <span>Price Waterfall gerado pelo Cascata</span>
            </div>
            <h1
              className="mt-4 font-display italic font-normal text-[color:var(--cascata-ink)] text-3xl md:text-4xl leading-tight"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0' }}
            >
              {CLIENTS[activeClient]}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground font-mono">
              B2B Distribuição · Q4 2025
            </p>
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

              {/* Waterfall chart */}
              <div className="lg:col-span-3 rounded-md border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--cascata-outflow)]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--cascata-gold)]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--cascata-navy)]/60" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">price waterfall</span>
                </div>
                <div className="p-4">
                  <WaterfallChart data={chartRows} />
                </div>
              </div>
            </div>

            {/* P&L table */}
            <div className="mt-6 rounded-md border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                <span className="text-xs text-muted-foreground font-mono">
                  {lines.filter((l) => l.value !== null).length} marcos do P&L
                </span>
              </div>
              <div className="p-4">
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 py-2 border-b border-border/40 last:border-0 ${
                      line.type === "total" ? "bg-muted/30 -mx-4 px-4" : ""
                    }`}
                  >
                    <span
                      className={`w-10 text-[10px] font-mono shrink-0 ${
                        line.type === "total"
                          ? "font-bold text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {line.n}
                    </span>
                    <span
                      className={`flex-1 text-xs ${
                        line.type === "total"
                          ? "font-semibold"
                          : line.type === "drill"
                            ? "italic text-primary/70"
                            : "text-muted-foreground"
                      }`}
                    >
                      {line.label}
                    </span>
                    {line.value !== null && (
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          line.type === "total" ? "font-bold" : ""
                        } ${line.value < 0 ? "text-destructive/70" : ""}`}
                      >
                        {fmtBRL(line.value)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border py-16">
          <div className="mx-auto max-w-5xl px-6 md:px-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <p className="eyebrow">Gostou do que viu?</p>
              <h2
                className="mt-3 font-display italic font-normal text-primary text-2xl leading-snug"
                style={{ fontVariationSettings: '"opsz" 96, "SOFT" 0, "WONK" 0' }}
              >
                Suba seus dados e monte o waterfall
                <br className="hidden md:block" /> em minutos.
              </h2>
            </div>
            <Link
              to="/signup"
              className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Criar conta
            </Link>
          </div>
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}
