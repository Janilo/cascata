// Pure compute helper used by both authenticated and public (token-shared) waterfall fns.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PRIORITY_ORDER = ["P1", "P2", "P3", "MANUAL", "RATEIO"] as const;

export type WaterfallArgs = {
  bu: "B2B" | "B2C";
  department?: string;
  leader?: string;
  account?: string;
  customerId?: string;
  referenceDate?: string;
};

type OrgNode = {
  bu: string | null; department: string | null; leader: string | null;
  channel: string | null; account: string | null; customer: string | null;
  salary: number | null;
};

export async function computeWaterfall(args: WaterfallArgs) {
  const { bu, department, leader, account, customerId, referenceDate } = args;

  const inputsQuery = supabaseAdmin
    .from("line_inputs")
    .select("line_code,customer_id,value,priority,bu,department,reference_date")
    .eq("bu", bu);
  if (referenceDate) inputsQuery.eq("reference_date", referenceDate);

  const [{ data: inputs }, { data: lines }, { data: orgNodesRaw }, { data: salaries }, { data: customers }] = await Promise.all([
    inputsQuery,
    supabaseAdmin.from("waterfall_lines").select("code,department,kind,bucket,label,main_no,sub_no,sort_order"),
    supabaseAdmin.from("org_nodes").select("id,bu,department,leader,channel,account,customer").eq("bu", bu),
    supabaseAdmin.from("org_node_salaries").select("org_node_id,salary"),
    supabaseAdmin.from("customers").select("id,customer_name,account_id,account_name,attrs,bu").eq("bu", bu),
  ]);

  const salaryByNodeId = new Map<string, number>();
  for (const s of salaries || []) salaryByNodeId.set(s.org_node_id, Number(s.salary || 0));
  const orgNodes: OrgNode[] = (orgNodesRaw || []).map((n) => ({
    bu: n.bu, department: n.department, leader: n.leader, channel: n.channel,
    account: n.account, customer: n.customer,
    salary: salaryByNodeId.get(n.id) || 0,
  }));

  const filteredCustomers = (customers || []).filter(c => {
    if (customerId && c.id !== customerId) return false;
    if (account && c.account_name !== account && c.account_id !== account) return false;
    const a = (c.attrs as Record<string, unknown>) || {};
    if (leader && a.leader !== leader) return false;
    if (department && a.department !== department) return false;
    return true;
  });
  const allowedCustomerIds = new Set<string>(filteredCustomers.map(c => c.id));
  const anyCustomerFilter = !!(customerId || account || leader);

  const best = new Map<string, { line_code: string; customer_id: string; value: number; priority: string }>();
  for (const r of inputs || []) {
    if (r.value === null || r.value === undefined) continue;
    if (department && r.department !== department) continue;
    if (anyCustomerFilter && !allowedCustomerIds.has(r.customer_id)) continue;
    const key = `${r.line_code}__${r.customer_id}`;
    const cur = best.get(key);
    const pCur = cur ? PRIORITY_ORDER.indexOf(cur.priority as (typeof PRIORITY_ORDER)[number]) : 99;
    const pNew = PRIORITY_ORDER.indexOf(r.priority as (typeof PRIORITY_ORDER)[number]);
    if (!cur || pNew < pCur) best.set(key, { line_code: r.line_code, customer_id: r.customer_id, value: Number(r.value), priority: r.priority });
  }

  const totals = new Map<string, number>();
  for (const v of best.values()) totals.set(v.line_code, (totals.get(v.line_code) || 0) + v.value);

  const revenueLineCodes = new Set((lines || []).filter(l => l.bucket === "revenue").map(l => l.code));
  const revenueByCustomer = new Map<string, number>();
  for (const v of best.values()) {
    if (revenueLineCodes.has(v.line_code)) {
      revenueByCustomer.set(v.customer_id, (revenueByCustomer.get(v.customer_id) || 0) + v.value);
    }
  }

  const personnelLine =
    (lines || []).find(l => l.kind === "main" && (l.label || "").toLowerCase().includes("pessoal"))?.code ||
    (lines || []).find(l => l.kind === "main" && l.bucket === "cost")?.code;

  let salaryTotal = 0;
  if (personnelLine && customers) {
    for (const node of orgNodes) {
      if (department && node.department && node.department !== department) continue;
      if (leader && node.leader && node.leader !== leader) continue;
      if (account && node.account && node.account !== account) continue;
      const sal = Number(node.salary || 0);
      if (!sal) continue;

      const matchCustomers = filteredCustomers.filter(c => {
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

      const weights = matchCustomers.map(c => revenueByCustomer.get(c.id) || 0);
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
  for (const r of inputs || []) {
    if (r.value === null || r.value === undefined) continue;
    if (department && r.department !== department) continue;
    if (anyCustomerFilter && !allowedCustomerIds.has(r.customer_id)) continue;
    if (r.line_code.startsWith("7.")) subTotals.set(r.line_code, (subTotals.get(r.line_code) || 0) + Number(r.value));
  }

  return {
    totalsByCode: Object.fromEntries(totals),
    subTotalsByCode: Object.fromEntries(subTotals),
    salaryTotal,
    inputsCount: (inputs || []).length,
    lines: lines || [],
  };
}
