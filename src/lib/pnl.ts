// Single source of truth for the P&L line taxonomy and its KPI ladder.
//
// The output of this app *is money*: every screen must derive the same
//   Receita Bruta → Deduções → Receita Líquida → CPV → Margem Bruta → OpEx → Pocket
// ladder from the same line codes. Before this module that ladder was
// re-implemented in waterfall.tsx, comparativo.tsx and share.$token.tsx, and had
// already drifted — "Pocket Margin" meant R$ (grossMargin − opex) on the waterfall
// but a percentage on the comparativo, the same label for two different concepts.
//
// Pure by design (a Map/Record of totals-by-code in, numbers out — no I/O), so it
// is trivially testable (see pnl.test.ts), in the spirit of waterfall-reduce.ts.

// Canonical P&L line codes. These are the `waterfall_lines.code` values (main_no
// 1..29) and live in exactly one place — this array. `roll` is the P&L bucket a
// group rolls up into (revenue/deduction/cogs/opex); `bucket` mirrors the DB's
// coarser revenue/deduction/cost. The waterfall chart consumes the groups too.
export const PNL_LINE_GROUPS = [
  {
    key: "rb",
    label: "Receita Bruta",
    shortLabel: "Rec. Bruta",
    roll: "revenue",
    bucket: "revenue",
    codes: ["1", "2", "3", "4", "5"],
  },
  {
    key: "ded",
    label: "Deduções de Receita",
    shortLabel: "Deduções",
    roll: "deduction",
    bucket: "deduction",
    codes: ["6", "7", "8"],
  },
  {
    key: "cpvt",
    label: "CPV — Tech / Infra",
    shortLabel: "CPV Tech",
    roll: "cogs",
    bucket: "cost",
    codes: ["9", "10", "11", "12", "13"],
  },
  {
    key: "cpvo",
    label: "CPV — Ops de Cliente",
    shortLabel: "CPV Ops",
    roll: "cogs",
    bucket: "cost",
    codes: ["14", "15", "16"],
  },
  {
    key: "sls",
    label: "OpEx — Sales",
    shortLabel: "Sales",
    roll: "opex",
    bucket: "cost",
    codes: ["17", "18", "19"],
  },
  {
    key: "mkt",
    label: "OpEx — Marketing",
    shortLabel: "Marketing",
    roll: "opex",
    bucket: "cost",
    codes: ["20", "21", "22"],
  },
  {
    key: "eng",
    label: "OpEx — Eng / Produto",
    shortLabel: "Eng/Prod",
    roll: "opex",
    bucket: "cost",
    codes: ["23", "24", "25"],
  },
  {
    key: "ga",
    label: "OpEx — G&A",
    shortLabel: "G&A",
    roll: "opex",
    bucket: "cost",
    codes: ["26", "27", "28", "29"],
  },
] as const;

type Roll = "revenue" | "deduction" | "cogs" | "opex";
const codesFor = (roll: Roll): string[] =>
  PNL_LINE_GROUPS.filter((g) => g.roll === roll).flatMap((g) => [...g.codes]);

// Coarse code sets, derived from the groups above — never hand-maintained.
export const PNL_CODES = {
  revenue: codesFor("revenue"),
  deduction: codesFor("deduction"),
  cogs: codesFor("cogs"),
  opex: codesFor("opex"),
};

export type PnLKpis = {
  grossRevenue: number; // Receita Bruta      — Σ revenue
  deductions: number; // Deduções           — Σ deduction (magnitude)
  netRevenue: number; // Receita Líquida     — grossRevenue − deductions
  cogs: number; // CPV                — Σ cogs (magnitude)
  grossMargin: number; // Margem Bruta       — netRevenue − cogs
  opex: number; // Despesas OpEx      — Σ opex (magnitude)
  pocket: number; // Pocket Margin (R$)  — grossMargin − opex
  pocketPct: number; // Pocket %           — pocket / netRevenue × 100 (0 if netRevenue = 0)
};

// Accepts the totals-by-code produced by reduceWaterfall (Record) or a Map.
// Deductions/CPV/OpEx are summed as magnitudes: the waterfall stores them as
// positive rows and subtracts them by bucket, so abs keeps the ladder correct
// even if a value is ever entered signed.
export function computePnLKpis(totals: Record<string, number> | Map<string, number>): PnLKpis {
  const get = (c: string): number => (totals instanceof Map ? totals.get(c) : totals[c]) || 0;
  const sum = (codes: string[]) => codes.reduce((s, c) => s + get(c), 0);
  const sumAbs = (codes: string[]) => codes.reduce((s, c) => s + Math.abs(get(c)), 0);

  const grossRevenue = sum(PNL_CODES.revenue);
  const deductions = sumAbs(PNL_CODES.deduction);
  const netRevenue = grossRevenue - deductions;
  const cogs = sumAbs(PNL_CODES.cogs);
  const grossMargin = netRevenue - cogs;
  const opex = sumAbs(PNL_CODES.opex);
  const pocket = grossMargin - opex;
  const pocketPct = netRevenue === 0 ? 0 : (pocket / netRevenue) * 100;

  return { grossRevenue, deductions, netRevenue, cogs, grossMargin, opex, pocket, pocketPct };
}
