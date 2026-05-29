import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChevronDown, ChevronUp, Upload, FileSpreadsheet, FileText } from "lucide-react";
import { getWaterfall } from "@/lib/waterfall.functions";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/waterfall")({
  component: WaterfallPage,
});

type Line = {
  code: string; category: string | null; label: string | null;
  department: string | null; kind: "main" | "sub"; bucket: "revenue" | "deduction" | "cost";
  main_no: number | null; sub_no: number | null; sort_order: number;
};

type Mode = "B2B" | "B2C" | "COMPARE";

type CustomerOpt = { id: string; customer_name: string; account_name: string | null; account_id: string | null; bu: string; attrs: Record<string, unknown> };

function WaterfallPage() {
  const [mode, setMode] = useState<Mode>("B2B");
  const [lines, setLines] = useState<Line[]>([]);
  const [totalsB2B, setTotalsB2B] = useState<Map<string, number>>(new Map());
  const [totalsB2C, setTotalsB2C] = useState<Map<string, number>>(new Map());
  const [showSub, setShowSub] = useState(false);
  const [subTotalsB2B, setSubTotalsB2B] = useState<Map<string, number>>(new Map());
  const [subTotalsB2C, setSubTotalsB2C] = useState<Map<string, number>>(new Map());
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterLeader, setFilterLeader] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterCustomer, setFilterCustomer] = useState<string>("");
  const [multipliers, setMultipliers] = useState<Record<string, number>>({ "6": 1, "7": 1, "8": 1 });
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const referenceDate = `${referenceMonth}-01`;
  const callWaterfall = useServerFn(getWaterfall);

  useEffect(() => {
    (async () => {
      const [{ data: ls }, { data: cs }] = await Promise.all([
        supabase.from("waterfall_lines").select("*").order("sort_order"),
        supabase.from("customers").select("id,customer_name,account_name,account_id,bu,attrs"),
      ]);
      setLines((ls as Line[]) || []);
      setCustomers((cs as CustomerOpt[]) || []);
    })();
  }, []);

  const filterArgs = useMemo(() => ({
    department: filterDept || undefined,
    leader: filterLeader || undefined,
    account: filterAccount || undefined,
    customerId: filterCustomer || undefined,
    referenceDate,
  }), [filterDept, filterLeader, filterAccount, filterCustomer, referenceDate]);

  useEffect(() => {
    (async () => {
      const need: ("B2B" | "B2C")[] = mode === "COMPARE" ? ["B2B", "B2C"] : [mode];
      for (const bu of need) {
        const wf = await callWaterfall({ data: { bu, ...filterArgs } });
        const totals = new Map(Object.entries(wf.totalsByCode));
        if (bu === "B2B") setTotalsB2B(totals); else setTotalsB2C(totals);
        let q = supabase.from("line_inputs").select("line_code,value,customer_id,department").eq("bu", bu);
        if (filterArgs.department) q = q.eq("department", filterArgs.department);
        const { data: subs } = await q;
        // Build allowed customer ids matching account/leader/customer filters
        const allowed = new Set(
          customers
            .filter(c => {
              if (filterCustomer && c.id !== filterCustomer) return false;
              if (filterAccount && c.account_name !== filterAccount && c.account_id !== filterAccount) return false;
              const a = c.attrs || {};
              if (filterLeader && a.leader !== filterLeader) return false;
              return true;
            })
            .map(c => c.id)
        );
        const anyCustFilter = !!(filterCustomer || filterAccount || filterLeader);
        const m = new Map<string, number>();
        for (const r of subs || []) {
          if (anyCustFilter && !allowed.has(r.customer_id)) continue;
          if (r.line_code.startsWith("7.")) m.set(r.line_code, (m.get(r.line_code) || 0) + Number(r.value || 0));
        }
        if (bu === "B2B") setSubTotalsB2B(m); else setSubTotalsB2C(m);
      }
    })();
  }, [mode, callWaterfall, filterArgs, customers, filterCustomer, filterAccount, filterLeader]);

  const deptOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of customers) {
      const d = (c.attrs as Record<string, unknown>)?.department;
      if (typeof d === "string" && d) s.add(d);
    }
    for (const l of lines) if (l.department) s.add(l.department);
    return Array.from(s).sort();
  }, [customers, lines]);

  const leaderOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of customers) {
      const v = (c.attrs as Record<string, unknown>)?.leader;
      if (typeof v === "string" && v) s.add(v);
    }
    return Array.from(s).sort();
  }, [customers]);

  const accountOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of customers) if (c.account_name) s.add(c.account_name);
    return Array.from(s).sort();
  }, [customers]);

  const customerOptions = useMemo(() => {
    return customers
      .filter(c => {
        if (filterAccount && c.account_name !== filterAccount && c.account_id !== filterAccount) return false;
        const a = c.attrs || {};
        if (filterLeader && a.leader !== filterLeader) return false;
        if (filterDept && a.department !== filterDept) return false;
        return true;
      })
      .sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  }, [customers, filterAccount, filterLeader, filterDept]);

  const activeTotals = mode === "B2C" ? totalsB2C : totalsB2B;
  const activeSub = mode === "B2C" ? subTotalsB2C : subTotalsB2B;

  // Apply sensitivity multipliers to deduction lines (6, 7, 8)
  const adjustedTotals = useMemo(() => {
    const m = new Map(activeTotals);
    for (const code of ["6", "7", "8"]) {
      const mult = multipliers[code] ?? 1;
      if (mult !== 1) m.set(code, (activeTotals.get(code) || 0) * mult);
    }
    return m;
  }, [activeTotals, multipliers]);

  const mainLines = useMemo(() => lines.filter(l => l.kind === "main").sort((a,b) => (a.main_no||0)-(b.main_no||0)), [lines]);
  const subLines = useMemo(() => lines.filter(l => l.kind === "sub").sort((a,b) => (a.sub_no||0)-(b.sub_no||0)), [lines]);

  const waterfallData = useMemo(() => {
    let running = 0;
    return mainLines.map((l, idx) => {
      const raw = adjustedTotals.get(l.code) || 0;
      const delta = l.bucket === "revenue" ? raw : -raw;
      const base = delta >= 0 ? running : running + delta;
      const bar = Math.abs(delta);
      const prev = running;
      running += delta;
      return { idx, code: l.code, name: `#${l.code}`, label: l.label || "", bucket: l.bucket, base, bar, delta, running, prevRunning: prev };
    });
  }, [mainLines, adjustedTotals]);

  const kpisFor = (totals: Map<string, number>) => {
    const sum = (codes: string[]) => codes.reduce((s, c) => s + (totals.get(c) || 0), 0);
    const grossRevenue = sum(["1","2","3","4","5"]);
    const deductions = sum(["6","7","8"]);
    const netRevenue = grossRevenue - deductions;
    const cogs = sum(["9","10","11","12","13","14","15","16"]);
    const grossMargin = netRevenue - cogs;
    const opex = sum(["17","18","19","20","21","22","23","24","25","26","27","28","29"]);
    const pocket = grossMargin - opex;
    return { grossRevenue, deductions, netRevenue, grossMargin, pocket };
  };
  const baselineKpis = useMemo(() => kpisFor(activeTotals), [activeTotals]);
  const kpis = useMemo(() => kpisFor(adjustedTotals), [adjustedTotals]);
  const kpisB2B = useMemo(() => kpisFor(totalsB2B), [totalsB2B]);
  const kpisB2C = useMemo(() => kpisFor(totalsB2C), [totalsB2C]);
  const isAdjusted = useMemo(() => Object.values(multipliers).some(v => v !== 1), [multipliers]);

  const subData = useMemo(() => subLines.map(l => ({
    code: l.code, name: l.code, label: l.label || "",
    value: activeSub.get(l.code) || 0,
    category: (l.category || "").replace("  └ ", ""),
  })), [subLines, activeSub]);

  const colorFor = (bucket: string) =>
    bucket === "revenue" ? "var(--marine)" :
    bucket === "deduction" ? "var(--primary)" : "var(--green)";

  // ====== Exports ======
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (mode === "COMPARE") {
      const rows = mainLines.map(l => ({
        "#": l.code,
        Categoria: l.category || "",
        Linha: l.label || "",
        Depto: l.department || "",
        B2B: totalsB2B.get(l.code) || 0,
        B2C: totalsB2C.get(l.code) || 0,
        "Δ (B2B−B2C)": (totalsB2B.get(l.code) || 0) - (totalsB2C.get(l.code) || 0),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Comparativo");
    } else {
      const rows = mainLines.map(l => ({
        "#": l.code, Categoria: l.category || "", Linha: l.label || "",
        Depto: l.department || "", Valor: activeTotals.get(l.code) || 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Waterfall ${mode}`);
      const subRows = subLines.map(l => ({
        "#": l.code, Tipo: (l.category || "").replace("  └ ", ""),
        Descricao: l.label || "", Valor: activeSub.get(l.code) || 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subRows), "Linha 7 (sub)");
    }
    XLSX.writeFile(wb, `waterfall-${mode.toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = mode === "COMPARE" ? "Waterfall — B2B vs B2C" : `Waterfall — ${mode}`;
    doc.setFontSize(16); doc.text(title, 40, 40);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(new Date().toLocaleString("pt-BR"), 40, 56);

    if (mode === "COMPARE") {
      autoTable(doc, {
        startY: 78,
        head: [["KPI", "B2B", "B2C", "Δ"]],
        body: [
          ["Receita Bruta", fmt(kpisB2B.grossRevenue), fmt(kpisB2C.grossRevenue), fmt(kpisB2B.grossRevenue - kpisB2C.grossRevenue)],
          ["Deduções", fmt(-kpisB2B.deductions), fmt(-kpisB2C.deductions), fmt(-(kpisB2B.deductions - kpisB2C.deductions))],
          ["Receita Líquida", fmt(kpisB2B.netRevenue), fmt(kpisB2C.netRevenue), fmt(kpisB2B.netRevenue - kpisB2C.netRevenue)],
          ["Margem Bruta", fmt(kpisB2B.grossMargin), fmt(kpisB2C.grossMargin), fmt(kpisB2B.grossMargin - kpisB2C.grossMargin)],
          ["Pocket Margin", fmt(kpisB2B.pocket), fmt(kpisB2C.pocket), fmt(kpisB2B.pocket - kpisB2C.pocket)],
        ],
        styles: { fontSize: 9 }, headStyles: { fillColor: [30, 30, 30] },
      });
      autoTable(doc, {
        head: [["#", "Linha", "B2B", "B2C", "Δ"]],
        body: mainLines.map(l => {
          const a = totalsB2B.get(l.code) || 0, b = totalsB2C.get(l.code) || 0;
          return [l.code, l.label || "", fmt(a), fmt(b), fmt(a - b)];
        }),
        styles: { fontSize: 8 }, headStyles: { fillColor: [30, 30, 30] },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      });
    } else {
      autoTable(doc, {
        startY: 78,
        head: [["KPI", "Valor"]],
        body: [
          ["Receita Bruta", fmt(kpis.grossRevenue)],
          ["Deduções", fmt(-kpis.deductions)],
          ["Receita Líquida", fmt(kpis.netRevenue)],
          ["Margem Bruta", fmt(kpis.grossMargin)],
          ["Pocket Margin", fmt(kpis.pocket)],
        ],
        styles: { fontSize: 9 }, headStyles: { fillColor: [30, 30, 30] },
      });
      autoTable(doc, {
        head: [["#", "Categoria", "Linha", "Depto", "Valor"]],
        body: mainLines.map(l => [l.code, l.category || "", l.label || "", l.department || "—", fmt(activeTotals.get(l.code) || 0)]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [30, 30, 30] },
        columnStyles: { 4: { halign: "right" } },
      });
    }
    doc.save(`waterfall-${mode.toLowerCase()}-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="p-10 space-y-10">
      <div className="flex items-end justify-between flex-wrap gap-6">
        <div>
          <p className="eyebrow">PRICE WATERFALL</p>
          <h1 className="font-display text-4xl text-primary mt-2">Da receita bruta ao custo de servir</h1>
          <p className="text-sm text-muted-foreground mt-2">29 marcos do P&L com prioridade P1 → P2 → P3 → Manual. Clique na linha #7 para abrir as 33 sublinhas de desconto comercial.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex border border-border">
            {(["B2B","B2C","COMPARE"] as const).map(b => (
              <button key={b} onClick={() => setMode(b)}
                className={`px-5 py-2 text-xs uppercase tracking-[0.18em] font-semibold ${mode===b ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-secondary"}`}>
                {b === "COMPARE" ? "B2B vs B2C" : b}
              </button>
            ))}
          </div>
          <button onClick={exportExcel} className="inline-flex items-center gap-2 border border-border px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-2 border border-border px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <Link to="/inputs" className="inline-flex items-center gap-2 bg-[var(--gold)] text-ink px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">
            <Upload className="w-4 h-4" /> Inputs
          </Link>
        </div>
      </div>

      <div className="bg-card border border-border p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Departamento</span>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
            className="border border-border bg-transparent px-3 py-2 text-xs min-w-[160px]">
            <option value="">Todos</option>
            {deptOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Líder</span>
          <select value={filterLeader} onChange={(e) => setFilterLeader(e.target.value)}
            className="border border-border bg-transparent px-3 py-2 text-xs min-w-[160px]">
            <option value="">Todos</option>
            {leaderOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Conta</span>
          <select value={filterAccount} onChange={(e) => { setFilterAccount(e.target.value); setFilterCustomer(""); }}
            className="border border-border bg-transparent px-3 py-2 text-xs min-w-[180px]">
            <option value="">Todas</option>
            {accountOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Cliente</span>
          <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
            className="border border-border bg-transparent px-3 py-2 text-xs min-w-[220px]">
            <option value="">Todos</option>
            {customerOptions.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
          </select>
        </div>
        {(filterDept || filterLeader || filterAccount || filterCustomer) && (
          <button onClick={() => { setFilterDept(""); setFilterLeader(""); setFilterAccount(""); setFilterCustomer(""); }}
            className="border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary">
            Limpar filtros
          </button>
        )}
      </div>

      {mode !== "COMPARE" ? (
        <>
          <div className="grid grid-cols-5 gap-px bg-border">
            {[
              { label: "Receita Bruta", v: kpis.grossRevenue, base: baselineKpis.grossRevenue },
              { label: "Deduções", v: -kpis.deductions, base: -baselineKpis.deductions },
              { label: "Receita Líquida", v: kpis.netRevenue, base: baselineKpis.netRevenue },
              { label: "Margem Bruta", v: kpis.grossMargin, base: baselineKpis.grossMargin },
              { label: "Pocket Margin", v: kpis.pocket, base: baselineKpis.pocket, highlight: true },
            ].map((k) => {
              const d = k.v - k.base;
              const pct = k.base !== 0 ? (d / Math.abs(k.base)) * 100 : 0;
              return (
                <div key={k.label} className="bg-card p-6">
                  <p className="eyebrow">{k.label}</p>
                  <p className={`font-display text-3xl mt-3 ${k.highlight ? "text-[var(--gold)]" : "text-primary"}`}>
                    {fmt(k.v)}
                  </p>
                  {isAdjusted && Math.abs(d) > 0.5 && (
                    <p className={`mt-2 text-xs font-mono ${d >= 0 ? "text-[hsl(var(--cascata-inflow))]" : "text-[hsl(var(--cascata-outflow))]"}`}>
                      {d >= 0 ? "▲" : "▼"} {fmtShort(d)} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <SensitivityPanel
            mainLines={mainLines}
            baseTotals={activeTotals}
            multipliers={multipliers}
            setMultipliers={setMultipliers}
            isAdjusted={isAdjusted}
            pocketDelta={kpis.pocket - baselineKpis.pocket}
          />


          <div className="bg-card border border-border">
            <div className="px-8 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-xl text-primary">Waterfall principal — {mode}</h2>
              <span className="text-xs text-muted-foreground uppercase tracking-[0.18em]">Receita → Deduções → Custos · linha mostra acumulado</span>
            </div>
            <div className="h-[520px] p-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={waterfallData} margin={{ top: 36, right: 30, left: 30, bottom: 30 }}>
                  <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--soft)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
                  <Tooltip
                    cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }}
                    formatter={(value: unknown, _name: unknown, props: { payload?: { delta?: number; label?: string; running?: number } }) => [
                      `${fmt(Number(props.payload?.delta ?? value))}  ·  acum. ${fmt(props.payload?.running ?? 0)}`,
                      props.payload?.label || "",
                    ]}
                  />
                  <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="bar" stackId="a" isAnimationActive={false}>
                    {waterfallData.map((d) => (
                      <Cell key={d.code} fill={colorFor(d.bucket)}
                        onClick={() => { if (d.code === "7") setShowSub((v) => !v); }}
                        style={{ cursor: d.code === "7" ? "pointer" : "default" }} />
                    ))}
                    <LabelList dataKey="delta" position="top" formatter={(v: unknown) => fmtShort(Number(v))}
                      style={{ fontSize: 10, fill: "var(--ink)" }} />
                  </Bar>
                  <Line type="stepAfter" dataKey="running" stroke="var(--gold)" strokeWidth={1.5}
                    dot={{ r: 2, fill: "var(--gold)", stroke: "var(--gold)" }} isAnimationActive={false} />
                </ComposedChart>
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

          {showSub && (
            <div className="bg-card border border-border">
              <div className="px-8 py-5 border-b border-border">
                <h2 className="font-display text-xl text-primary">Drill-down · Linha #7 — 33 tipos de desconto comercial</h2>
              </div>
              <div className="h-[420px] p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subData} margin={{ top: 20, right: 30, left: 30, bottom: 50 }}>
                    <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--soft)" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }}
                      formatter={(value: unknown, _n: unknown, props: { payload?: { label?: string; category?: string } }) => [fmt(Number(value)), `${props.payload?.category} · ${props.payload?.label}`]}
                    />
                    <Bar dataKey="value" fill="var(--primary)" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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
                    <td className="px-6 py-3 text-right font-mono">{fmt(adjustedTotals.get(l.code) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <CompareView mainLines={mainLines} totalsB2B={totalsB2B} totalsB2C={totalsB2C} kpisB2B={kpisB2B} kpisB2C={kpisB2C} />
      )}
    </div>
  );
}

function CompareView({
  mainLines, totalsB2B, totalsB2C, kpisB2B, kpisB2C,
}: {
  mainLines: Line[]; totalsB2B: Map<string, number>; totalsB2C: Map<string, number>;
  kpisB2B: { grossRevenue: number; deductions: number; netRevenue: number; grossMargin: number; pocket: number };
  kpisB2C: { grossRevenue: number; deductions: number; netRevenue: number; grossMargin: number; pocket: number };
}) {
  const kpiRows = [
    { label: "Receita Bruta", b2b: kpisB2B.grossRevenue, b2c: kpisB2C.grossRevenue },
    { label: "Deduções", b2b: -kpisB2B.deductions, b2c: -kpisB2C.deductions },
    { label: "Receita Líquida", b2b: kpisB2B.netRevenue, b2c: kpisB2C.netRevenue },
    { label: "Margem Bruta", b2b: kpisB2B.grossMargin, b2c: kpisB2C.grossMargin },
    { label: "Pocket Margin", b2b: kpisB2B.pocket, b2c: kpisB2C.pocket, highlight: true },
  ];
  const chartData = mainLines.map(l => ({
    name: `#${l.code}`,
    B2B: (totalsB2B.get(l.code) || 0) * (l.bucket === "revenue" ? 1 : -1),
    B2C: (totalsB2C.get(l.code) || 0) * (l.bucket === "revenue" ? 1 : -1),
  }));
  return (
    <>
      <div className="grid grid-cols-5 gap-px bg-border">
        {kpiRows.map((k) => (
          <div key={k.label} className="bg-card p-6">
            <p className="eyebrow">{k.label}</p>
            <div className="mt-3 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">B2B</span>
                <span className={`font-display text-lg ${k.highlight ? "text-[var(--gold)]" : "text-primary"}`}>{fmt(k.b2b)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">B2C</span>
                <span className={`font-display text-lg ${k.highlight ? "text-[var(--gold)]" : "text-primary"}`}>{fmt(k.b2c)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-1 mt-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Δ</span>
                <span className="font-mono text-xs">{fmt(k.b2b - k.b2c)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border">
        <div className="px-8 py-5 border-b border-border">
          <h2 className="font-display text-xl text-primary">Comparativo B2B vs B2C — por linha</h2>
        </div>
        <div className="h-[480px] p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 30, bottom: 30 }}>
              <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="name" stroke="var(--soft)" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
              <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }} formatter={(v: unknown) => fmt(Number(v))} />
              <Bar dataKey="B2B" fill="var(--marine)" isAnimationActive={false} />
              <Bar dataKey="B2C" fill="var(--primary)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="px-8 py-5 border-b border-border">
          <h2 className="font-display text-xl text-primary">Tabela comparativa</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">#</th>
              <th className="text-left px-6 py-3">Linha</th>
              <th className="text-right px-6 py-3">B2B</th>
              <th className="text-right px-6 py-3">B2C</th>
              <th className="text-right px-6 py-3">Δ (B2B − B2C)</th>
            </tr>
          </thead>
          <tbody>
            {mainLines.map((l) => {
              const a = totalsB2B.get(l.code) || 0, b = totalsB2C.get(l.code) || 0;
              return (
                <tr key={l.code} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-6 py-3 font-mono text-xs">{l.code}</td>
                  <td className="px-6 py-3">{l.label}</td>
                  <td className="px-6 py-3 text-right font-mono">{fmt(a)}</td>
                  <td className="px-6 py-3 text-right font-mono">{fmt(b)}</td>
                  <td className={`px-6 py-3 text-right font-mono ${a-b >= 0 ? "text-[var(--green)]" : "text-destructive"}`}>{fmt(a - b)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SensitivityPanel({
  mainLines, baseTotals, multipliers, setMultipliers, isAdjusted, pocketDelta,
}: {
  mainLines: Line[];
  baseTotals: Map<string, number>;
  multipliers: Record<string, number>;
  setMultipliers: (m: Record<string, number>) => void;
  isAdjusted: boolean;
  pocketDelta: number;
}) {
  const targets = ["6", "7", "8"]
    .map(code => mainLines.find(l => l.code === code))
    .filter((l): l is Line => !!l);

  const setMult = (code: string, mult: number) => {
    setMultipliers({ ...multipliers, [code]: mult });
  };
  const reset = () => setMultipliers({ "6": 1, "7": 1, "8": 1 });
  const compact = (n: number) =>
    new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  const brl = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-card border border-border">
      <div className="px-8 py-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">ANÁLISE DE SENSIBILIDADE</p>
          <h2 className="font-display text-xl text-primary mt-1">Simule mudanças nas deduções</h2>
        </div>
        <div className="flex items-center gap-4">
          {isAdjusted && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Δ Pocket Margin</p>
              <p className={`font-display text-lg ${pocketDelta >= 0 ? "text-[hsl(var(--cascata-inflow))]" : "text-[hsl(var(--cascata-outflow))]"}`}>
                {pocketDelta >= 0 ? "+" : ""}{brl(pocketDelta)}
              </p>
            </div>
          )}
          <button onClick={reset} disabled={!isAdjusted}
            className="border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">
            Resetar
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
        {targets.map(l => {
          const base = baseTotals.get(l.code) || 0;
          const mult = multipliers[l.code] ?? 1;
          const adjusted = base * mult;
          const pctChange = (mult - 1) * 100;
          return (
            <div key={l.code} className="bg-card p-6 space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-mono text-muted-foreground">#{l.code}</p>
                <span className={`text-xs font-mono font-semibold ${pctChange === 0 ? "text-muted-foreground" : pctChange < 0 ? "text-[hsl(var(--cascata-inflow))]" : "text-[hsl(var(--cascata-outflow))]"}`}>
                  {pctChange > 0 ? "+" : ""}{pctChange.toFixed(0)}%
                </span>
              </div>
              <p className="font-display text-sm text-primary leading-tight">{l.label}</p>
              <input
                type="range" min={-50} max={50} step={1}
                value={Math.round(pctChange)}
                onChange={(e) => setMult(l.code, 1 + Number(e.target.value) / 100)}
                className="w-full accent-[hsl(var(--cascata-gold))]"
              />
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Base</span>
                <span className="font-mono">{compact(base)}</span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Simulado</span>
                <span className={`font-mono font-semibold ${mult !== 1 ? "text-[var(--gold)]" : ""}`}>{compact(adjusted)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-8 py-3 text-xs text-muted-foreground border-t border-border">
        Mova os sliders para ver impacto em tempo real no waterfall e nos KPIs acima. Variação de −50% a +50% sobre o valor atual da linha.
      </p>
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
