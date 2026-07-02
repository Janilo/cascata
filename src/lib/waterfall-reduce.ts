// Pure waterfall arithmetic — no I/O, no Supabase. Given the already-fetched
// rows, it does the dedupe-by-priority, per-line totals, revenue-weighted
// personnel allocation, and 7.* subtotals. `computeWaterfall` (waterfall-core.ts)
// is the thin data-access wrapper that fetches the rows and calls this.
//
// Keeping the math pure is what makes it testable (see waterfall-reduce.test.ts):
// the output of this app *is money*, so the reducer must have a safety net.

export const PRIORITY_ORDER = ["P1", "P2", "P3", "MANUAL", "RATEIO"] as const;

export type LineInput = {
  line_code: string;
  customer_id: string;
  value: number | null;
  priority: string;
  department?: string | null;
};

export type WaterfallLine = {
  code: string;
  kind?: string | null;
  bucket?: string | null;
  label?: string | null;
};

export type OrgNode = {
  bu: string | null;
  department: string | null;
  leader: string | null;
  channel: string | null;
  account: string | null;
  customer: string | null;
  salary: number | null;
};

export type Customer = {
  id: string;
  customer_name: string | null;
  account_id: string | null;
  account_name: string | null;
  attrs: Record<string, unknown> | null;
  bu: string | null;
};

export type WaterfallReduceArgs = {
  department?: string;
  leader?: string;
  account?: string;
  customerId?: string;
};

export type WaterfallReduceResult = {
  totalsByCode: Record<string, number>;
  subTotalsByCode: Record<string, number>;
  salaryTotal: number;
};

export type WinningCell = {
  line_code: string;
  customer_id: string;
  value: number;
  priority: string;
};

// Highest-priority value per (line_code, customer_id) — the P1>P2>P3>MANUAL>RATEIO
// dedupe both the aggregate waterfall and the per-customer "custo de servir"
// depend on. `keep` optionally scopes which inputs are eligible (by
// department/customer); custo-de-servir passes none (whole BU).
export function bestByCell(
  inputs: LineInput[],
  keep?: (r: LineInput) => boolean,
): Map<string, WinningCell> {
  const best = new Map<string, WinningCell>();
  for (const r of inputs) {
    if (r.value === null || r.value === undefined) continue;
    if (keep && !keep(r)) continue;
    const key = `${r.line_code}__${r.customer_id}`;
    const cur = best.get(key);
    const pCur = cur ? PRIORITY_ORDER.indexOf(cur.priority as (typeof PRIORITY_ORDER)[number]) : 99;
    const pNew = PRIORITY_ORDER.indexOf(r.priority as (typeof PRIORITY_ORDER)[number]);
    if (!cur || pNew < pCur)
      best.set(key, {
        line_code: r.line_code,
        customer_id: r.customer_id,
        value: Number(r.value),
        priority: r.priority,
      });
  }
  return best;
}

// The waterfall_lines.code that carries personnel ("pessoal") cost: the named
// main line if present, else the first main cost line.
export function findPersonnelLine(lines: WaterfallLine[]): string | undefined {
  return (
    lines.find((l) => l.kind === "main" && (l.label || "").toLowerCase().includes("pessoal"))
      ?.code || lines.find((l) => l.kind === "main" && l.bucket === "cost")?.code
  );
}

// Revenue booked per customer from the winning cells — the weight used to
// allocate salaries across the customers an org node serves.
export function computeRevenueByCustomer(
  best: Map<string, WinningCell>,
  revenueLineCodes: Set<string>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of best.values()) {
    if (revenueLineCodes.has(v.line_code)) {
      out.set(v.customer_id, (out.get(v.customer_id) || 0) + v.value);
    }
  }
  return out;
}

export function reduceWaterfall(
  inputs: LineInput[],
  lines: WaterfallLine[],
  orgNodes: OrgNode[],
  customers: Customer[] | null,
  args: WaterfallReduceArgs,
): WaterfallReduceResult {
  const { department, leader, account, customerId } = args;

  const filteredCustomers = (customers || []).filter((c) => {
    if (customerId && c.id !== customerId) return false;
    if (account && c.account_name !== account && c.account_id !== account) return false;
    const a = (c.attrs as Record<string, unknown>) || {};
    if (leader && a.leader !== leader) return false;
    if (department && a.department !== department) return false;
    return true;
  });
  const allowedCustomerIds = new Set<string>(filteredCustomers.map((c) => c.id));
  const anyCustomerFilter = !!(customerId || account || leader);

  const best = bestByCell(inputs, (r) => {
    if (department && r.department !== department) return false;
    if (anyCustomerFilter && !allowedCustomerIds.has(r.customer_id)) return false;
    return true;
  });

  const totals = new Map<string, number>();
  for (const v of best.values()) totals.set(v.line_code, (totals.get(v.line_code) || 0) + v.value);

  const revenueLineCodes = new Set(lines.filter((l) => l.bucket === "revenue").map((l) => l.code));
  const revenueByCustomer = computeRevenueByCustomer(best, revenueLineCodes);

  const personnelLine = findPersonnelLine(lines);

  let salaryTotal = 0;
  if (personnelLine && customers) {
    for (const node of orgNodes) {
      if (department && node.department && node.department !== department) continue;
      if (leader && node.leader && node.leader !== leader) continue;
      if (account && node.account && node.account !== account) continue;
      const sal = Number(node.salary || 0);
      if (!sal) continue;

      const matchCustomers = filteredCustomers.filter((c) => {
        if (node.customer) return c.customer_name === node.customer;
        if (node.account) return c.account_name === node.account || c.account_id === node.account;
        const a = (c.attrs as Record<string, unknown>) || {};
        if (node.channel && a.channel !== node.channel) return false;
        if (node.leader && a.leader !== node.leader) return false;
        if (node.department && a.department !== node.department) return false;
        if (node.bu && c.bu !== node.bu) return false;
        return true;
      });

      salaryTotal += sal;

      if (matchCustomers.length === 0) {
        totals.set(personnelLine, (totals.get(personnelLine) || 0) + sal);
        continue;
      }

      const weights = matchCustomers.map((c) => revenueByCustomer.get(c.id) || 0);
      const weightSum = weights.reduce((s, w) => s + w, 0);
      if (weightSum === 0) {
        const each = sal / matchCustomers.length;
        totals.set(personnelLine, (totals.get(personnelLine) || 0) + each * matchCustomers.length);
      } else {
        totals.set(personnelLine, (totals.get(personnelLine) || 0) + sal);
      }
    }
  }

  // Subline 7.* totals (used by the waterfall detail panel)
  const subTotals = new Map<string, number>();
  for (const r of inputs) {
    if (r.value === null || r.value === undefined) continue;
    if (department && r.department !== department) continue;
    if (anyCustomerFilter && !allowedCustomerIds.has(r.customer_id)) continue;
    if (r.line_code.startsWith("7."))
      subTotals.set(r.line_code, (subTotals.get(r.line_code) || 0) + Number(r.value));
  }

  return {
    totalsByCode: Object.fromEntries(totals),
    subTotalsByCode: Object.fromEntries(subTotals),
    salaryTotal,
  };
}
