import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getSharedWaterfall } from "@/lib/waterfall.functions";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Waterfall · Visualização compartilhada" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SharedWaterfallPage,
});

type Line = {
  code: string; label: string | null; kind: "main" | "sub";
  bucket: "revenue" | "deduction" | "cost"; main_no: number | null; sort_order: number;
};

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const compact = (n: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function SharedWaterfallPage() {
  const { token } = Route.useParams();
  const call = useServerFn(getSharedWaterfall);
  const [data, setData] = useState<Awaited<ReturnType<typeof getSharedWaterfall>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setData(await call({ data: { token } })); }
      catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro"); }
    })();
  }, [token, call]);

  if (err) return (
    <div className="min-h-screen flex items-center justify-center p-10">
      <div className="max-w-md text-center">
        <p className="eyebrow text-[hsl(var(--cascata-outflow))]">Link indisponível</p>
        <h1 className="font-display text-3xl text-primary mt-3">{err}</h1>
        <p className="text-sm text-muted-foreground mt-3">Solicite um novo link de visualização ao remetente.</p>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>;

  const lines = (data.lines as Line[]) || [];
  const mainLines = lines.filter(l => l.kind === "main").sort((a, b) => (a.main_no || 0) - (b.main_no || 0));
  const totals = new Map(Object.entries(data.totalsByCode || {}));

  const sum = (codes: string[]) => codes.reduce((s, c) => s + (totals.get(c) || 0), 0);
  const grossRevenue = sum(["1", "2", "3", "4", "5"]);
  const deductions = sum(["6", "7", "8"]);
  const netRevenue = grossRevenue - deductions;
  const cogs = sum(["9", "10", "11", "12", "13", "14", "15", "16"]);
  const grossMargin = netRevenue - cogs;
  const opex = sum(["17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29"]);
  const pocket = grossMargin - opex;

  let running = 0;
  const bars = mainLines.map(l => {
    const raw = totals.get(l.code) || 0;
    const delta = l.bucket === "revenue" ? raw : -raw;
    const base = delta >= 0 ? running : running + delta;
    const bar = Math.abs(delta);
    running += delta;
    return { code: l.code, name: `#${l.code}`, label: l.label || "", bucket: l.bucket, base, bar, delta, running };
  });

  const colorFor = (b: string) => b === "revenue" ? "var(--marine)" : b === "deduction" ? "var(--primary)" : "var(--green)";
  const refDate = data.referenceDate ? new Date(data.referenceDate + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : null;
  const expiresIn = Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 86400000));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="px-10 py-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="eyebrow">PRICE WATERFALL · VISUALIZAÇÃO COMPARTILHADA</p>
            <h1 className="font-display text-3xl text-primary mt-2">
              {data.label || `Waterfall ${data.bu}`}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              BU {data.bu}{refDate ? ` · período ${refDate}` : ""} · expira em {expiresIn} dia{expiresIn === 1 ? "" : "s"}
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold px-3 py-2 border border-border text-muted-foreground">Read-only</span>
        </div>
      </header>

      <main className="p-10 space-y-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { l: "Receita Bruta", v: grossRevenue },
            { l: "Deduções", v: -deductions },
            { l: "Receita Líquida", v: netRevenue },
            { l: "Margem Bruta", v: grossMargin },
            { l: "Pocket Margin", v: pocket },
          ].map(k => (
            <div key={k.l} className="border border-border bg-card p-4">
              <p className="eyebrow text-[10px]">{k.l}</p>
              <p className="font-mono text-2xl text-primary mt-2">{compact(k.v)}</p>
            </div>
          ))}
        </div>

        <div className="border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={bars} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" />
              <YAxis tickFormatter={(v) => compact(Number(v))} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={(_, p) => p?.[0]?.payload?.label || ""} />
              <Bar dataKey="base" stackId="a" fill="transparent" />
              <Bar dataKey="bar" stackId="a">
                {bars.map((b, i) => <Cell key={i} fill={colorFor(b.bucket)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="text-left px-6 py-3 w-16">#</th>
                <th className="text-left px-6 py-3">Linha</th>
                <th className="text-right px-6 py-3 w-48">Valor</th>
              </tr>
            </thead>
            <tbody>
              {mainLines.map(l => (
                <tr key={l.code} className="border-t border-border">
                  <td className="px-6 py-2 font-mono text-xs text-muted-foreground">{l.code}</td>
                  <td className="px-6 py-2">{l.label}</td>
                  <td className="px-6 py-2 text-right font-mono">{brl(totals.get(l.code) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="text-center text-xs text-muted-foreground py-6">
          Visualização gerada por <span className="font-semibold text-foreground">Cascata</span>. Os dados refletem o snapshot atual da BU selecionada.
        </footer>
      </main>
    </div>
  );
}
