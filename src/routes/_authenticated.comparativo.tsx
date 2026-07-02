import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, X } from "lucide-react";
import { getWaterfall } from "@/lib/waterfall.functions";
import { computePnLKpis } from "@/lib/pnl";
import { useBusinessUnits } from "@/hooks/use-business-units";

export const Route = createFileRoute("/_authenticated/comparativo")({
  component: ComparativoPage,
});

type Line = {
  code: string;
  label: string | null;
  kind: "main" | "sub";
  bucket: "revenue" | "deduction" | "cost";
  main_no: number | null;
  sort_order: number;
};

type PeriodData = { month: string; totals: Record<string, number> };

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
const compact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
};

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// KPIs come from the shared ladder in @/lib/pnl (computePnLKpis) — the same one
// the waterfall and share pages use, so "Pocket Margin (R$)" and "Pocket %" mean
// the same thing on every screen.

function ComparativoPage() {
  const { bus } = useBusinessUnits();
  const [bu, setBu] = useState<string>("B2B");
  useEffect(() => {
    if (bus.length && !bus.find((b) => b.code === bu)) setBu(bus[0].code);
  }, [bus, bu]);
  const [months, setMonths] = useState<string[]>(() => lastNMonths(3));
  const [lines, setLines] = useState<Line[]>([]);
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMonth, setNewMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const callWaterfall = useServerFn(getWaterfall);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("waterfall_lines")
        .select("code,label,kind,bucket,main_no,sort_order")
        .order("sort_order");
      setLines((data as Line[]) || []);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const results = await Promise.all(
        months.map(async (m) => {
          const wf = await callWaterfall({ data: { bu, referenceDate: `${m}-01` } });
          return { month: m, totals: wf.totalsByCode as Record<string, number> };
        }),
      );
      if (active) setPeriods(results);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [bu, months, callWaterfall]);

  const kpisByMonth = useMemo(
    () => periods.map((p) => ({ month: p.month, ...computePnLKpis(p.totals) })),
    [periods],
  );

  const trendData = useMemo(
    () =>
      kpisByMonth.map((k) => ({
        month: monthLabel(k.month),
        "Receita Líquida": Math.round(k.netRevenue),
        "Pocket Margin (R$)": Math.round(k.pocket),
        "Pocket %": Number(k.pocketPct.toFixed(1)),
      })),
    [kpisByMonth],
  );

  const mainLines = useMemo(
    () => lines.filter((l) => l.kind === "main").sort((a, b) => a.sort_order - b.sort_order),
    [lines],
  );

  const addMonth = () => {
    if (!newMonth || months.includes(newMonth) || months.length >= 6) return;
    setMonths([...months, newMonth].sort());
  };
  const removeMonth = (m: string) => {
    if (months.length <= 1) return;
    setMonths(months.filter((x) => x !== m));
  };

  const baseline = kpisByMonth[0];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-muted-foreground">Análise temporal</p>
          <h1 className="font-display text-4xl text-foreground mt-1">Comparativo de períodos</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Compare safras ou meses lado a lado. Selecione até 6 períodos para ver evolução de KPIs
            e linhas do P&L.
          </p>
        </div>
        <div className="flex gap-2">
          {bus.map((b) => (
            <button
              key={b.code}
              onClick={() => setBu(b.code)}
              className={`px-4 py-2 text-xs uppercase tracking-[0.12em] font-semibold border border-border ${bu === b.code ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period chips */}
      <div className="border border-border bg-card p-4">
        <p className="eyebrow mb-3">Períodos comparados</p>
        <div className="flex flex-wrap items-center gap-2">
          {months.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground text-sm"
            >
              {monthLabel(m)}
              {months.length > 1 && (
                <button onClick={() => removeMonth(m)} className="opacity-60 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {months.length < 6 && (
            <div className="inline-flex items-center gap-2 border border-border px-2 py-1">
              <input
                type="month"
                value={newMonth}
                onChange={(e) => setNewMonth(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
              <button
                onClick={addMonth}
                className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] font-semibold hover:text-primary"
              >
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpisByMonth.map((k, i) => {
          const delta = baseline && i > 0 ? k.pocketPct - baseline.pocketPct : 0;
          return (
            <div key={k.month} className="border border-border bg-card p-5">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">{monthLabel(k.month)}</p>
                {i > 0 && (
                  <span className={`text-xs tabular ${delta >= 0 ? "delta-up" : "delta-down"}`}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}pp
                  </span>
                )}
              </div>
              <p className="font-display text-3xl text-foreground mt-2">
                {k.pocketPct.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.1em]">Pocket %</p>
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rec. Líquida</span>
                  <span className="font-mono">{brl(k.netRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pocket Margin (R$)</span>
                  <span className="font-mono">{brl(k.pocket)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deduções</span>
                  <span className="font-mono">{brl(k.deductions)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      <div className="border border-border bg-card p-5">
        <p className="eyebrow mb-4">Tendência de KPIs</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis
                yAxisId="left"
                tickFormatter={compact}
                stroke="var(--muted-foreground)"
                fontSize={12}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v}%`}
                stroke="var(--muted-foreground)"
                fontSize={12}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "Pocket %" ? `${value}%` : brl(Number(value))
                }
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="Receita Líquida"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="Pocket Margin (R$)"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="Pocket %"
                stroke="var(--chart-3)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Receita Líquida bar comparison */}
      <div className="border border-border bg-card p-5">
        <p className="eyebrow mb-4">Receita Líquida por período</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis tickFormatter={compact} stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                formatter={(value) => brl(Number(value))}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }}
              />
              <Bar dataKey="Receita Líquida" fill="var(--chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail table by line */}
      <div className="border border-border bg-card">
        <div className="p-5 border-b border-border">
          <p className="eyebrow">Linhas do P&L · valor por período</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-[0.1em]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">#</th>
                <th className="text-left px-4 py-3 font-semibold">Linha</th>
                {periods.map((p) => (
                  <th key={p.month} className="text-right px-4 py-3 font-semibold">
                    {monthLabel(p.month)}
                  </th>
                ))}
                {periods.length > 1 && (
                  <th className="text-right px-4 py-3 font-semibold">
                    Δ vs {monthLabel(periods[0].month)}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {mainLines.map((l) => {
                const values = periods.map((p) => p.totals[l.code] || 0);
                const first = values[0] || 0;
                const last = values[values.length - 1] || 0;
                const delta = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
                return (
                  <tr key={l.code} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {l.main_no}
                    </td>
                    <td className="px-4 py-2">{l.label}</td>
                    {values.map((v, i) => (
                      <td key={i} className="px-4 py-2 text-right font-mono">
                        {v === 0 ? "—" : brl(v)}
                      </td>
                    ))}
                    {periods.length > 1 && (
                      <td
                        className={`px-4 py-2 text-right tabular ${delta === 0 ? "delta-zero" : delta > 0 ? "delta-up" : "delta-down"}`}
                      >
                        {first === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Carregando períodos…</p>}
    </div>
  );
}
