import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/waterfall")({
  component: WaterfallPage,
});

type Line = {
  code: string; category: string | null; label: string | null;
  department: string | null; kind: "main" | "sub"; bucket: "revenue" | "deduction" | "cost";
  main_no: number | null; sub_no: number | null; sort_order: number;
};

type Input = { line_code: string; bu: string; value: number | null };

function WaterfallPage() {
  const [bu, setBu] = useState<"B2B" | "B2C">("B2B");
  const [lines, setLines] = useState<Line[]>([]);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [showSub, setShowSub] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: ls } = await supabase.from("waterfall_lines").select("*").order("sort_order");
      const { data: ins } = await supabase.from("line_inputs").select("line_code,bu,value").eq("bu", bu);
      setLines((ls as Line[]) || []);
      setInputs((ins as Input[]) || []);
    })();
  }, [bu]);

  // Aggregate by line_code
  const totalsByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inputs) m.set(r.line_code, (m.get(r.line_code) || 0) + (Number(r.value) || 0));
    return m;
  }, [inputs]);

  // Main waterfall: codes 1..29 (skip 7.x)
  const mainLines = useMemo(() => lines.filter(l => l.kind === "main").sort((a,b) => (a.main_no||0)-(b.main_no||0)), [lines]);
  const subLines = useMemo(() => lines.filter(l => l.kind === "sub").sort((a,b) => (a.sub_no||0)-(b.sub_no||0)), [lines]);

  // Build waterfall data with running totals
  const waterfallData = useMemo(() => {
    let running = 0;
    return mainLines.map((l) => {
      const raw = totalsByCode.get(l.code) || 0;
      const delta = l.bucket === "revenue" ? raw : -raw;
      const base = delta >= 0 ? running : running + delta;
      const bar = Math.abs(delta);
      running += delta;
      return {
        code: l.code,
        name: `#${l.code}`,
        label: l.label || "",
        bucket: l.bucket,
        base,
        bar,
        delta,
        running,
      };
    });
  }, [mainLines, totalsByCode]);

  const kpis = useMemo(() => {
    const sum = (codes: string[]) => codes.reduce((s, c) => s + (totalsByCode.get(c) || 0), 0);
    const grossRevenue = sum(["1","2","3","4","5"]);
    const deductions = sum(["6","7","8"]);
    const netRevenue = grossRevenue - deductions;
    const cogs = sum(["9","10","11","12","13","14","15","16"]);
    const grossMargin = netRevenue - cogs;
    const opex = sum(["17","18","19","20","21","22","23","24","25","26","27","28","29"]);
    const pocket = grossMargin - opex;
    return { grossRevenue, deductions, netRevenue, grossMargin, pocket };
  }, [totalsByCode]);

  const subData = useMemo(() => {
    return subLines.map(l => ({
      code: l.code,
      name: l.code,
      label: l.label || "",
      value: totalsByCode.get(l.code) || 0,
      category: (l.category || "").replace("  └ ", ""),
    }));
  }, [subLines, totalsByCode]);

  const colorFor = (bucket: string) =>
    bucket === "revenue" ? "var(--marine)" :
    bucket === "deduction" ? "var(--primary)" : "var(--green)";

  return (
    <div className="p-10 space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">PRICE WATERFALL</p>
          <h1 className="font-display text-4xl text-primary mt-2">Da receita bruta ao custo de servir</h1>
          <p className="text-sm text-muted-foreground mt-2">29 marcos do P&L. Clique na linha #7 para ver as 33 sublinhas de desconto comercial.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="inline-flex border border-border">
            {(["B2B","B2C"] as const).map(b => (
              <button key={b} onClick={() => setBu(b)}
                className={`px-6 py-2 text-xs uppercase tracking-[0.18em] font-semibold ${bu===b ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-secondary"}`}>
                {b}
              </button>
            ))}
          </div>
          <Link to="/inputs" className="inline-flex items-center gap-2 bg-[var(--gold)] text-ink px-5 py-3 text-xs uppercase tracking-[0.18em] font-semibold">
            <Upload className="w-4 h-4" /> Inputs por depto
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-px bg-border">
        {[
          { label: "Receita Bruta", v: kpis.grossRevenue },
          { label: "Deduções", v: -kpis.deductions },
          { label: "Receita Líquida", v: kpis.netRevenue },
          { label: "Margem Bruta", v: kpis.grossMargin },
          { label: "Pocket Margin", v: kpis.pocket, highlight: true },
        ].map((k) => (
          <div key={k.label} className="bg-card p-6">
            <p className="eyebrow">{k.label}</p>
            <p className={`font-display text-3xl mt-3 ${k.highlight ? "text-[var(--gold)]" : "text-primary"}`}>
              {fmt(k.v)}
            </p>
          </div>
        ))}
      </div>

      {/* Main waterfall */}
      <div className="bg-card border border-border">
        <div className="px-8 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl text-primary">Waterfall principal — {bu}</h2>
          <span className="text-xs text-muted-foreground uppercase tracking-[0.18em]">Receita → Deduções → Custos</span>
        </div>
        <div className="h-[460px] p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 30, bottom: 30 }}>
              <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="name" stroke="var(--soft)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }}
                formatter={(value: unknown, _name: unknown, props: { payload?: { delta?: number; label?: string } }) => [
                  fmt(Number(props.payload?.delta ?? value)),
                  props.payload?.label || "",
                ]}
              />
              <Bar dataKey="base" stackId="a" fill="transparent" />
              <Bar dataKey="bar" stackId="a">
                {waterfallData.map((d) => (
                  <Cell key={d.code} fill={colorFor(d.bucket)}
                    onClick={() => { if (d.code === "7") setShowSub((v) => !v); }}
                    style={{ cursor: d.code === "7" ? "pointer" : "default" }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="px-8 py-4 border-t border-border flex items-center justify-between bg-secondary/40">
          <button onClick={() => setShowSub(v => !v)}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-semibold text-primary">
            {showSub ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Linha #7 — Descontos comerciais (sublinhas 7.1–7.33)
          </button>
          <span className="text-xs text-muted-foreground">Clique também na barra #7 do gráfico</span>
        </div>
      </div>

      {/* Sub waterfall for line 7 */}
      {showSub && (
        <div className="bg-card border border-border">
          <div className="px-8 py-5 border-b border-border">
            <h2 className="font-display text-xl text-primary">Drill-down · Linha #7 — 33 tipos de desconto comercial</h2>
            <p className="text-xs text-muted-foreground mt-1">Gráfico separado para preservar a leitura do waterfall principal.</p>
          </div>
          <div className="h-[400px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subData} margin={{ top: 20, right: 30, left: 30, bottom: 50 }}>
                <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" stroke="var(--soft)" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }}
                  formatter={(value: unknown, _n: unknown, props: { payload?: { label?: string; category?: string } }) => [fmt(Number(value)), `${props.payload?.category} · ${props.payload?.label}`]}
                />
                <Bar dataKey="value" fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Line table */}
      <div className="bg-card border border-border overflow-hidden">
        <div className="px-8 py-5 border-b border-border">
          <h2 className="font-display text-xl text-primary">Detalhe por linha</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">#</th>
              <th className="text-left px-6 py-3">Categoria</th>
              <th className="text-left px-6 py-3">Linha</th>
              <th className="text-left px-6 py-3">Depto</th>
              <th className="text-right px-6 py-3">Valor</th>
            </tr>
          </thead>
          <tbody>
            {mainLines.map((l) => (
              <tr key={l.code} className="border-t border-border hover:bg-secondary/30">
                <td className="px-6 py-3 font-mono text-xs">{l.code}</td>
                <td className="px-6 py-3 text-xs text-muted-foreground">{l.category}</td>
                <td className="px-6 py-3">{l.label}</td>
                <td className="px-6 py-3 text-xs">{l.department || "—"}</td>
                <td className="px-6 py-3 text-right font-mono">{fmt(totalsByCode.get(l.code) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n/1_000).toFixed(0)}k`;
  return `${n}`;
}
