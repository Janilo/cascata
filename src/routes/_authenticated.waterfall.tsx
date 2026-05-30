import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GUEST_EMAIL } from "@/lib/config";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChevronDown, ChevronUp, Upload, FileSpreadsheet, FileText, Share2, Copy, Check } from "lucide-react";
import { getWaterfall, createSharedLink } from "@/lib/waterfall.functions";
import { useBusinessUnits, type BusinessUnit } from "@/hooks/use-business-units";
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

type Kpis = { grossRevenue: number; deductions: number; netRevenue: number; grossMargin: number; pocket: number };

const COMPARE = "__COMPARE__";

type CustomerOpt = { id: string; customer_name: string; account_name: string | null; account_id: string | null; bu: string; attrs: Record<string, unknown> };

type ChartRow = {
  id: string; name: string; label: string;
  itemKind: "group" | "sub" | "milestone" | "grouptotal";
  bucket: "revenue" | "deduction" | "cost" | "total";
  base: number; bar: number; delta: number; running: number;
  groupKey?: string;
};

// P&L aggregate groups — codes map to waterfall_lines.code
const PL_GROUPS = [
  { key: "rb",   label: "Receita Bruta",       shortLabel: "Rec. Bruta", codes: ["1","2","3","4","5"],        bucket: "revenue"   },
  { key: "ded",  label: "Deduções de Receita",  shortLabel: "Deduções",   codes: ["6","7","8"],                bucket: "deduction" },
  { key: "cpvt", label: "CPV — Tech / Infra",   shortLabel: "CPV Tech",   codes: ["9","10","11","12","13"],    bucket: "cost"      },
  { key: "cpvo", label: "CPV — Ops de Cliente", shortLabel: "CPV Ops",    codes: ["14","15","16"],             bucket: "cost"      },
  { key: "sls",  label: "OpEx — Sales",         shortLabel: "Sales",      codes: ["17","18","19"],             bucket: "cost"      },
  { key: "mkt",  label: "OpEx — Marketing",     shortLabel: "Marketing",  codes: ["20","21","22"],             bucket: "cost"      },
  { key: "eng",  label: "OpEx — Eng / Produto", shortLabel: "Eng/Prod",   codes: ["23","24","25"],             bucket: "cost"      },
  { key: "ga",   label: "OpEx — G&A",           shortLabel: "G&A",        codes: ["26","27","28","29"],        bucket: "cost"      },
] as const;

// Chart sequence: P&L groups interspersed with milestone totals
type PLGroupKey = typeof PL_GROUPS[number]["key"];
const CHART_SEQUENCE: Array<
  | { kind: "group"; key: PLGroupKey }
  | { kind: "milestone"; id: string; label: string; fullLabel: string }
> = [
  { kind: "group", key: "rb" },
  { kind: "group", key: "ded" },
  { kind: "milestone", id: "rl",    label: "Rec. Líquida",  fullLabel: "Receita Líquida" },
  { kind: "group", key: "cpvt" },
  { kind: "group", key: "cpvo" },
  { kind: "milestone", id: "mb",    label: "M. Bruta",      fullLabel: "Margem Bruta" },
  { kind: "group", key: "sls" },
  { kind: "group", key: "mkt" },
  { kind: "milestone", id: "mc",    label: "M. Contrib.",   fullLabel: "Margem de Contribuição" },
  { kind: "group", key: "eng" },
  { kind: "group", key: "ga" },
  { kind: "milestone", id: "ebitda",label: "EBITDA",        fullLabel: "EBITDA" },
];

// Values in DB may be stored as positive OR negative for non-revenue lines.
// Normalize by treating the magnitude as the absolute value.
function absOf(totals: Map<string, number>, ...codes: string[]) {
  return codes.reduce((s, c) => s + Math.abs(totals.get(c) || 0), 0);
}

function kpisFor(totals: Map<string, number>): Kpis {
  const sumRaw = (codes: string[]) => codes.reduce((s, c) => s + (totals.get(c) || 0), 0);
  const grossRevenue = sumRaw(["1","2","3","4","5"]);
  const deductions = absOf(totals, "6","7","8");
  const netRevenue = grossRevenue - deductions;
  const cogs = absOf(totals, "9","10","11","12","13","14","15","16");
  const grossMargin = netRevenue - cogs;
  const opex = absOf(totals, "17","18","19","20","21","22","23","24","25","26","27","28","29");
  const pocket = grossMargin - opex;
  return { grossRevenue, deductions, netRevenue, grossMargin, pocket };
}

function WaterfallPage() {
  const { bus, labelOf, colorOf } = useBusinessUnits();
  const [mode, setMode] = useState<string>("B2B");
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsGuest(data.user?.email === GUEST_EMAIL);
    });
  }, []);
  useEffect(() => {
    if (bus.length && mode !== COMPARE && !bus.find(b => b.code === mode)) setMode(bus[0].code);
  }, [bus, mode]);

  const [lines, setLines] = useState<Line[]>([]);
  const [totalsByBu, setTotalsByBu] = useState<Map<string, Map<string, number>>>(new Map());
  const [subTotalsByBu, setSubTotalsByBu] = useState<Map<string, Map<string, number>>>(new Map());
  const [showSub, setShowSub] = useState(false);
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
  const callCreateShare = useServerFn(createSharedLink);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedSubCat, setExpandedSubCat] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState("");
  const [shareDays, setShareDays] = useState(14);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    // customers for filter dropdowns — may return empty for guest users (RLS), that's fine
    supabase.from("customers").select("id,customer_name,account_name,account_id,bu,attrs")
      .then(({ data: cs }) => setCustomers((cs as CustomerOpt[]) || []));
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
      if (!bus.length) return;
      const need: BusinessUnit[] = mode === COMPARE ? bus : bus.filter(b => b.code === mode);
      if (need.length === 0) return;
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

      const totalsNext = new Map(totalsByBu);
      const subNext = new Map(subTotalsByBu);
      for (const b of need) {
        const wf = await callWaterfall({ data: { bu: b.code, ...filterArgs } });
        totalsNext.set(b.code, new Map(Object.entries(wf.totalsByCode)));
        // Lines and sub-totals come from the server (bypasses RLS for guest users)
        if (wf.lines && wf.lines.length > 0) setLines(wf.lines as Line[]);
        subNext.set(b.code, new Map(Object.entries(wf.subTotalsByCode || {})));
      }
      setTotalsByBu(totalsNext);
      setSubTotalsByBu(subNext);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bus, callWaterfall, filterArgs, customers, filterCustomer, filterAccount, filterLeader, referenceDate]);

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

  const EMPTY = useMemo(() => new Map<string, number>(), []);
  const activeTotals = mode === COMPARE ? EMPTY : (totalsByBu.get(mode) ?? EMPTY);
  const activeSub = mode === COMPARE ? EMPTY : (subTotalsByBu.get(mode) ?? EMPTY);

  // Apply sensitivity multipliers to deduction lines (6, 7, 8).
  // Normalise to positive magnitude first so the sign convention is consistent.
  const adjustedTotals = useMemo(() => {
    const m = new Map(activeTotals);
    for (const code of ["6", "7", "8"]) {
      const mult = multipliers[code] ?? 1;
      const base = Math.abs(activeTotals.get(code) || 0);
      m.set(code, base * mult);
    }
    return m;
  }, [activeTotals, multipliers]);

  const mainLines = useMemo(() => lines.filter(l => l.kind === "main").sort((a,b) => (a.main_no||0)-(b.main_no||0)), [lines]);
  const subLines = useMemo(() => lines.filter(l => l.kind === "sub").sort((a,b) => (a.sub_no||0)-(b.sub_no||0)), [lines]);

  const expandedChartData = useMemo((): ChartRow[] => {
    let running = 0;
    const rows: ChartRow[] = [];

    for (const seq of CHART_SEQUENCE) {
      if (seq.kind === "milestone") {
        rows.push({
          id: `ms-${seq.id}`, name: seq.label, label: seq.fullLabel,
          itemKind: "milestone", bucket: "total",
          base: Math.min(0, running), bar: Math.abs(running), delta: 0, running,
        });
      } else {
        const g = PL_GROUPS.find(g => g.key === seq.key)!;
        const gVal = g.codes.reduce((s, c) => s + Math.abs(adjustedTotals.get(c) || 0), 0);
        const gDelta = g.bucket === "revenue" ? gVal : -gVal;

        if (expandedGroup === seq.key) {
          const groupStartRunning = running;
          // Individual sub-line bars (lighter) — appear to the LEFT of the group total
          for (const code of g.codes) {
            const lVal = Math.abs(adjustedTotals.get(code) || 0);
            const lDelta = g.bucket === "revenue" ? lVal : -lVal;
            const lBase = lDelta >= 0 ? running : running + lDelta;
            const lineLine = mainLines.find(l => l.code === code);
            rows.push({
              id: `sub-${code}`, name: `#${code}`, label: lineLine?.label || `#${code}`,
              itemKind: "sub", bucket: g.bucket,
              base: lBase, bar: lVal, delta: lDelta, running: running + lDelta,
              groupKey: seq.key,
            });
            running += lDelta;
          }
          // Group total bar (darker, same visual position as unexpanded bar, delta=0)
          const gtBase = gDelta >= 0 ? groupStartRunning : groupStartRunning + gDelta;
          rows.push({
            id: `gt-${seq.key}`, name: g.shortLabel, label: g.label,
            itemKind: "grouptotal", bucket: g.bucket,
            base: gtBase, bar: Math.abs(gDelta), delta: 0, running,
            groupKey: seq.key,
          });
        } else {
          const base = gDelta >= 0 ? running : running + gDelta;
          rows.push({
            id: `g-${seq.key}`, name: g.shortLabel, label: g.label,
            itemKind: "group", bucket: g.bucket,
            base, bar: Math.abs(gDelta), delta: gDelta, running: running + gDelta,
            groupKey: seq.key,
          });
          running += gDelta;
        }
      }
    }
    return rows;
  }, [adjustedTotals, expandedGroup, mainLines]);

  const baselineKpis = useMemo(() => kpisFor(activeTotals), [activeTotals]);
  const kpis = useMemo(() => kpisFor(adjustedTotals), [adjustedTotals]);
  const kpisByBu = useMemo(() => {
    const out = new Map<string, Kpis>();
    for (const b of bus) out.set(b.code, kpisFor(totalsByBu.get(b.code) ?? EMPTY));
    return out;
  }, [bus, totalsByBu, EMPTY]);
  const isAdjusted = useMemo(() => Object.values(multipliers).some(v => v !== 1), [multipliers]);

  const subData = useMemo(() => subLines.map(l => ({
    code: l.code, name: l.code, label: l.label || "",
    value: Math.abs(activeSub.get(l.code) || 0),
    category: (l.category || "Outros").replace(/^\s*└\s*/, "").trim(),
  })), [subLines, activeSub]);

  // Sub-lines grouped by category (column B in the Excel template)
  const subCatData = useMemo(() => {
    const map = new Map<string, { lines: typeof subData; total: number }>();
    for (const d of subData) {
      const entry = map.get(d.category) || { lines: [], total: 0 };
      entry.lines.push(d);
      entry.total += d.value;
      map.set(d.category, entry);
    }
    return Array.from(map.entries())
      .map(([cat, { lines, total }]) => ({ cat, lines, total }))
      .sort((a, b) => b.total - a.total);
  }, [subData]);

  const colorFor = (bucket: string) =>
    bucket === "revenue" ? "var(--marine)" :
    bucket === "deduction" ? "var(--primary)" :
    bucket === "total" ? "var(--gold)" : "var(--green)";

  // ====== Exports ======
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (mode === COMPARE) {
      const rows = mainLines.map(l => {
        const row: Record<string, unknown> = { "#": l.code, Linha: l.label };
        for (const b of bus) row[b.label] = totalsByBu.get(b.code)?.get(l.code) || 0;
        return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Comparativo");
    } else {
      const rows = mainLines.map(l => ({
        "#": l.code, Categoria: l.category || "", Linha: l.label || "",
        Depto: l.department || "", Valor: adjustedTotals.get(l.code) || 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Waterfall ${labelOf(mode)}`);
      const subRows = subLines.map(l => ({ "#": l.code, Categoria: l.category || "", Sublinha: l.label || "", Valor: activeSub.get(l.code) || 0 }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subRows), "Linha 7 (sub)");
    }
    XLSX.writeFile(wb, `waterfall-${mode === COMPARE ? "compare" : mode.toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = mode === COMPARE
      ? `Waterfall — Comparativo (${bus.map(b => b.label).join(" vs ")})`
      : `Waterfall — ${labelOf(mode)}`;
    doc.setFontSize(16); doc.text(title, 40, 40);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(new Date().toLocaleString("pt-BR"), 40, 56);

    if (mode === COMPARE) {
      const kpiHead = ["KPI", ...bus.map(b => b.label)];
      const kpiRows: (string)[][] = (
        [
          ["Receita Bruta", (k: Kpis) => k.grossRevenue],
          ["Deduções", (k: Kpis) => -k.deductions],
          ["Receita Líquida", (k: Kpis) => k.netRevenue],
          ["Margem Bruta", (k: Kpis) => k.grossMargin],
          ["Pocket Margin", (k: Kpis) => k.pocket],
        ] as Array<[string, (k: Kpis) => number]>
      ).map(([label, pick]) => [label, ...bus.map(b => fmt(pick(kpisByBu.get(b.code) ?? kpisFor(EMPTY))))]);
      autoTable(doc, {
        startY: 78, head: [kpiHead], body: kpiRows,
        styles: { fontSize: 9 }, headStyles: { fillColor: [30, 30, 30] },
      });
      autoTable(doc, {
        head: [["#", "Linha", ...bus.map(b => b.label)]],
        body: mainLines.map(l => [
          l.code, l.label || "",
          ...bus.map(b => fmt(totalsByBu.get(b.code)?.get(l.code) || 0)),
        ]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [30, 30, 30] },
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
    doc.save(`waterfall-${mode === COMPARE ? "compare" : mode.toLowerCase()}-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <>
      {isGuest && (
        <div className="border-b border-primary/20 bg-primary/5">
          <div className="mx-auto max-w-6xl px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="font-mono uppercase tracking-wider">Demo-ready</span>
              <span className="text-muted-foreground hidden sm:inline">· 5 clientes fictícios, waterfall com drill-down, pronto para apresentar</span>
            </div>
            <Link
              to="/signup"
              className="rounded-sm border border-primary/40 bg-background px-2.5 py-1 font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Rodar com meus dados →
            </Link>
          </div>
        </div>
      )}
      <div className="p-10 space-y-10">
      <div className="flex items-end justify-between flex-wrap gap-6">
        <div>
          <p className="eyebrow">PRICE WATERFALL</p>
          <h1 className="font-display text-4xl text-primary mt-2">Da receita bruta ao custo de servir</h1>
          <p className="text-sm text-muted-foreground mt-2">29 marcos do P&L com prioridade P1 → P2 → P3 → Manual. Clique na linha #7 para abrir as 33 sublinhas de desconto comercial.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex border border-border flex-wrap">
            {bus.map(b => (
              <button key={b.code} onClick={() => setMode(b.code)}
                className={`px-5 py-2 text-xs uppercase tracking-[0.18em] font-semibold ${mode===b.code ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-secondary"}`}>
                {b.label}
              </button>
            ))}
            {bus.length >= 2 && (
              <button onClick={() => setMode(COMPARE)}
                className={`px-5 py-2 text-xs uppercase tracking-[0.18em] font-semibold ${mode===COMPARE ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-secondary"}`}>
                Comparar
              </button>
            )}
          </div>
          <button onClick={exportExcel} className="inline-flex items-center gap-2 border border-border px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-2 border border-border px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => { setShareOpen(true); setShareUrl(null); setShareCopied(false); }}
            disabled={mode === COMPARE}
            title={mode === COMPARE ? "Selecione uma BU para compartilhar" : "Gerar link read-only"}
            className="inline-flex items-center gap-2 border border-border px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">
            <Share2 className="w-4 h-4" /> Compartilhar
          </button>
          <Link to="/inputs" className="inline-flex items-center gap-2 bg-[var(--gold)] text-ink px-4 py-3 text-xs uppercase tracking-[0.18em] font-semibold">
            <Upload className="w-4 h-4" /> Inputs
          </Link>
        </div>
      </div>

      <div className="bg-card border border-border p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Período</span>
          <input type="month" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)}
            className="border border-border bg-transparent px-3 py-2 text-xs min-w-[140px] font-mono" />
        </div>
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

      {mode !== COMPARE ? (
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
                    <p className={`mt-2 text-xs font-mono ${d >= 0 ? "delta-up" : "delta-down"}`}>
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
            <div className="px-8 py-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-display text-xl text-primary">Waterfall principal — {labelOf(mode)}</h2>
              <span className="text-xs text-muted-foreground uppercase tracking-[0.18em] hidden sm:inline">
                Receita → Deduções → Custos → EBITDA · Clique num grupo para detalhar
              </span>
            </div>
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(900, expandedChartData.length * 90) }}>
                <ComposedChart width={Math.max(900, expandedChartData.length * 90)} height={480}
                  data={expandedChartData} margin={{ top: 36, right: 40, left: 40, bottom: 60 }}>
                  <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--soft)"
                    tick={{ fontSize: 10 }} interval={0} angle={-38} textAnchor="end" height={70} />
                  <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
                  <Tooltip
                    cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }}
                    formatter={(_value: unknown, _name: unknown, props: { payload?: ChartRow }) => {
                      const row = props.payload;
                      if (!row) return ["—", ""];
                      if (row.itemKind === "milestone") return [fmt(row.running), row.label];
                      if (row.itemKind === "grouptotal") return [`${fmt(row.bar)}  ·  acum. ${fmt(row.running)}`, row.label];
                      return [`${fmt(row.bar)}  ·  acum. ${fmt(row.running)}`, row.label];
                    }}
                  />
                  <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="bar" stackId="a" isAnimationActive={false}>
                    {expandedChartData.map((d) => {
                      const isMilestone = d.itemKind === "milestone" || d.itemKind === "grouptotal";
                      const fill = isMilestone ? colorFor("total") : colorFor(d.bucket);
                      const opacity = d.itemKind === "sub" ? 0.42 : 1;
                      const cursor = d.itemKind === "group" || d.itemKind === "grouptotal" ? "pointer" : "default";
                      return (
                        <Cell key={d.id} fill={fill} style={{ opacity, cursor }}
                          onClick={() => {
                            if (d.itemKind === "group") setExpandedGroup(g => g === d.groupKey ? null : (d.groupKey ?? null));
                            if (d.itemKind === "grouptotal") setExpandedGroup(null);
                          }} />
                      );
                    })}
                    <LabelList dataKey="bar" position="top"
                      formatter={(v: unknown) => { const n = Number(v); return n < 5000 ? "" : fmtShort(n); }}
                      style={{ fontSize: 10, fill: "var(--ink)" }} />
                  </Bar>
                  <Line type="stepAfter" dataKey="running" stroke="var(--gold)" strokeWidth={1.5}
                    dot={{ r: 2, fill: "var(--gold)", stroke: "var(--gold)" }} isAnimationActive={false} />
                </ComposedChart>
              </div>
            </div>
            <div className="px-8 py-4 border-t border-border flex items-center justify-between bg-secondary/40">
              <button onClick={() => setShowSub(v => !v)}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-semibold text-primary">
                {showSub ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Linha #7 — Descontos comerciais (sublinhas 7.1–7.33)
              </button>
              {expandedGroup && (
                <button onClick={() => setExpandedGroup(null)}
                  className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-[0.14em]">
                  Fechar detalhe ×
                </button>
              )}
            </div>
          </div>

          {showSub && (
            <div className="bg-card border border-border">
              <div className="px-8 py-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-display text-xl text-primary">Drill-down · Linha #7 — 33 tipos de desconto comercial</h2>
                {expandedSubCat && (
                  <button onClick={() => setExpandedSubCat(null)}
                    className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-[0.14em]">
                    Ver todas as categorias ×
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(600, subCatData.length * 120) }}>
                  <BarChart width={Math.max(600, subCatData.length * 120)} height={340}
                    data={subCatData} margin={{ top: 20, right: 30, left: 30, bottom: 90 }}>
                    <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="cat" stroke="var(--soft)" tick={{ fontSize: 10 }} interval={0} angle={-40} textAnchor="end" height={100} />
                    <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }}
                      formatter={(value: unknown, _n: unknown, props: { payload?: { cat?: string } }) => [fmt(Number(value)), props.payload?.cat || ""]}
                    />
                    <Bar dataKey="total" isAnimationActive={false}>
                      {subCatData.map((d) => (
                        <Cell key={d.cat}
                          fill={expandedSubCat === d.cat ? "var(--marine)" : "var(--primary)"}
                          onClick={() => setExpandedSubCat(c => c === d.cat ? null : d.cat)}
                          style={{ cursor: "pointer", opacity: expandedSubCat && expandedSubCat !== d.cat ? 0.45 : 1 }} />
                      ))}
                      <LabelList dataKey="total" position="top"
                        formatter={(v: unknown) => fmtShort(Number(v))}
                        style={{ fontSize: 10, fill: "var(--ink)" }} />
                    </Bar>
                  </BarChart>
                </div>
              </div>
              {expandedSubCat && (() => {
                const group = subCatData.find(d => d.cat === expandedSubCat);
                if (!group) return null;
                return (
                  <div className="border-t border-border bg-secondary/20">
                    <div className="px-8 py-3 flex items-center justify-between border-b border-border">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{expandedSubCat} — sublinhas</p>
                      <button onClick={() => setExpandedSubCat(null)}
                        className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-[0.14em]">Fechar ×</button>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {[...group.lines].sort((a, b) => b.value - a.value).map(l => (
                          <tr key={l.code} className="border-t border-border/60">
                            <td className="px-8 py-2 font-mono text-xs text-muted-foreground w-16">#{l.code}</td>
                            <td className="px-3 py-2">{l.label}</td>
                            <td className="px-8 py-2 text-right font-mono">{fmt(l.value)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-border bg-secondary/30">
                          <td className="px-8 py-2 font-mono text-xs font-semibold" colSpan={2}>Total {expandedSubCat}</td>
                          <td className="px-8 py-2 text-right font-mono font-semibold">{fmt(group.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              <div className="px-8 py-3 border-t border-border text-xs text-muted-foreground bg-secondary/40">
                {subCatData.length} categorias · {subData.length} sublinhas · Clique numa barra para expandir as sublinhas da categoria
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
        <CompareView mainLines={mainLines} bus={bus} totalsByBu={totalsByBu} kpisByBu={kpisByBu} colorOf={colorOf} />
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-50 bg-[color:var(--cascata-abyss)]/70 flex items-center justify-center p-6" onClick={() => setShareOpen(false)}>
          <div className="bg-card border border-border max-w-lg w-full p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="eyebrow">Link de visualização</p>
              <h2 className="font-display text-2xl text-primary mt-2">Compartilhar waterfall {labelOf(mode)}</h2>
              <p className="text-xs text-muted-foreground mt-2">
                URL pública, read-only, sem login. Reflete a BU {labelOf(mode)}{referenceMonth ? ` no período ${referenceMonth}` : ""}.
              </p>
            </div>

            {!shareUrl ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="eyebrow text-[10px] block mb-1">Rótulo (opcional)</label>
                    <input value={shareLabel} onChange={(e) => setShareLabel(e.target.value)} placeholder="Ex: Reunião Cliente X"
                      className="w-full border border-border bg-transparent px-3 py-2 text-sm" maxLength={120} />
                  </div>
                  <div>
                    <label className="eyebrow text-[10px] block mb-1">Expira em</label>
                    <select value={shareDays} onChange={(e) => setShareDays(Number(e.target.value))}
                      className="w-full border border-border bg-transparent px-3 py-2 text-sm">
                      <option value={1}>1 dia</option>
                      <option value={7}>7 dias</option>
                      <option value={14}>14 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={90}>90 dias</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShareOpen(false)}
                    className="border border-border px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary">Cancelar</button>
                  <button disabled={shareBusy || mode === COMPARE}
                    onClick={async () => {
                      setShareBusy(true);
                      try {
                        const row = await callCreateShare({ data: {
                          bu: mode,
                          referenceDate,
                          label: shareLabel || undefined,
                          expiresInDays: shareDays,
                        } });
                        setShareUrl(`${window.location.origin}/share/${row.token}`);
                      } catch (e) { alert(e instanceof Error ? e.message : "Erro"); }
                      setShareBusy(false);
                    }}
                    className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold disabled:opacity-40">
                    {shareBusy ? "Gerando…" : "Gerar link"}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 border border-border p-3 bg-background">
                  <code className="flex-1 text-xs font-mono truncate">{shareUrl}</code>
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                    className="inline-flex items-center gap-1 border border-border px-3 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary shrink-0">
                    {shareCopied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Qualquer pessoa com este link verá o waterfall até a data de expiração. Nenhuma edição é possível.</p>
                <div className="flex justify-end pt-2">
                  <button onClick={() => setShareOpen(false)}
                    className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold">Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

function CompareView({
  mainLines, bus, totalsByBu, kpisByBu, colorOf,
}: {
  mainLines: Line[];
  bus: BusinessUnit[];
  totalsByBu: Map<string, Map<string, number>>;
  kpisByBu: Map<string, Kpis>;
  colorOf: (code: string) => string;
}) {
  const kpiDefs: Array<[string, (k: Kpis) => number, boolean?]> = [
    ["Receita Bruta", (k) => k.grossRevenue],
    ["Deduções", (k) => -k.deductions],
    ["Receita Líquida", (k) => k.netRevenue],
    ["Margem Bruta", (k) => k.grossMargin],
    ["Pocket Margin", (k) => k.pocket, true],
  ];
  const EMPTY_K = { grossRevenue: 0, deductions: 0, netRevenue: 0, grossMargin: 0, pocket: 0 };

  const chartData = mainLines.map(l => {
    const row: Record<string, number | string> = { name: `#${l.code}` };
    for (const b of bus) {
      const t = totalsByBu.get(b.code)?.get(l.code) || 0;
      row[b.label] = t * (l.bucket === "revenue" ? 1 : -1);
    }
    return row;
  });

  return (
    <>
      <div className="grid grid-cols-5 gap-px bg-border">
        {kpiDefs.map(([label, pick, highlight]) => {
          const values = bus.map(b => pick(kpisByBu.get(b.code) ?? EMPTY_K));
          const max = Math.max(...values), min = Math.min(...values);
          return (
            <div key={label} className="bg-card p-5">
              <p className="eyebrow">{label}</p>
              <div className="mt-3 space-y-1">
                {bus.map((b, i) => (
                  <div key={b.code} className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">{b.label}</span>
                    <span className={`font-display text-base ${highlight ? "text-[var(--gold)]" : "text-primary"}`}>{fmt(values[i])}</span>
                  </div>
                ))}
                {bus.length >= 2 && (
                  <div className="flex items-baseline justify-between border-t border-border pt-1 mt-1">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Δ (máx − mín)</span>
                    <span className="font-mono text-xs">{fmt(max - min)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border">
        <div className="px-8 py-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-xl text-primary">Comparativo entre BUs — por linha</h2>
          <div className="flex items-center gap-3 text-xs">
            {bus.map(b => (
              <span key={b.code} className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3" style={{ background: colorOf(b.code) }} />
                {b.label}
              </span>
            ))}
          </div>
        </div>
        <div className="h-[480px] p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 30, bottom: 30 }}>
              <CartesianGrid stroke="var(--stone)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="name" stroke="var(--soft)" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
              <YAxis stroke="var(--soft)" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0, fontSize: 12 }} formatter={(v: unknown) => fmt(Number(v))} />
              {bus.map(b => (
                <Bar key={b.code} dataKey={b.label} fill={colorOf(b.code)} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border overflow-x-auto">
        <div className="px-8 py-5 border-b border-border">
          <h2 className="font-display text-xl text-primary">Tabela comparativa</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">#</th>
              <th className="text-left px-6 py-3">Linha</th>
              {bus.map(b => (
                <th key={b.code} className="text-right px-6 py-3">{b.label}</th>
              ))}
              {bus.length >= 2 && <th className="text-right px-6 py-3">Δ (máx − mín)</th>}
            </tr>
          </thead>
          <tbody>
            {mainLines.map((l) => {
              const vals = bus.map(b => totalsByBu.get(b.code)?.get(l.code) || 0);
              const max = Math.max(...vals), min = Math.min(...vals);
              const spread = max - min;
              return (
                <tr key={l.code} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-6 py-3 font-mono text-xs">{l.code}</td>
                  <td className="px-6 py-3">{l.label}</td>
                  {vals.map((v, i) => (
                    <td key={bus[i].code} className="px-6 py-3 text-right font-mono">{fmt(v)}</td>
                  ))}
                  {bus.length >= 2 && (
                    <td className="px-6 py-3 text-right font-mono text-muted-foreground">{fmt(spread)}</td>
                  )}
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
              <p className={`font-display text-lg ${pocketDelta >= 0 ? "delta-up" : "delta-down"}`}>
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
          const base = Math.abs(baseTotals.get(l.code) || 0);
          const mult = multipliers[l.code] ?? 1;
          const adjusted = base * mult;
          const pctChange = (mult - 1) * 100;
          return (
            <div key={l.code} className="bg-card p-6 space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-mono text-muted-foreground">#{l.code}</p>
                <span className={`text-xs font-mono font-semibold ${pctChange === 0 ? "text-muted-foreground" : pctChange < 0 ? "delta-up" : "delta-down"}`}>
                  {pctChange > 0 ? "+" : ""}{pctChange.toFixed(0)}%
                </span>
              </div>
              <p className="font-display text-sm text-primary leading-tight">{l.label}</p>
              <input
                type="range" min={-50} max={50} step={1}
                value={Math.round(pctChange)}
                onChange={(e) => setMult(l.code, 1 + Number(e.target.value) / 100)}
                className="w-full accent-gold"
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
