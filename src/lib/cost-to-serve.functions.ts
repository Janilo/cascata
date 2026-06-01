// Per-customer P&L (custo de servir). Returns line-level totals and the
// resulting margin for a single customer, applying the same P1>P2>P3>MANUAL>RATEIO
// rule and allocating salary from the org hierarchy (last complete level).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireApprovedUser } from "./require-approved";

const Input = z.object({ customer_id: z.string().uuid() });
const PRIORITY_ORDER = ["P1", "P2", "P3", "MANUAL", "RATEIO"] as const;

export const getCustomerPnL = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const { customer_id } = data;

    const [{ data: customerRow }, { data: lines }] = await Promise.all([
      supabaseAdmin.from("customers").select("id,customer_name,account_id,account_name,bu,attrs").eq("id", customer_id).maybeSingle(),
      supabaseAdmin.from("waterfall_lines").select("code,label,kind,bucket,department,main_no,sort_order").order("sort_order"),
    ]);
    if (!customerRow) return { customer: null, lines: [], totals: null };

    const bu = customerRow.bu as string;

    const [{ data: inputs }, { data: orgNodes }, { data: salaries }, { data: allCustomers }] = await Promise.all([
      supabaseAdmin.from("line_inputs").select("line_code,customer_id,value,priority").eq("bu", bu),
      supabaseAdmin.from("org_nodes").select("id,bu,department,leader,channel,account,customer").eq("bu", bu),
      supabaseAdmin.from("org_node_salaries").select("org_node_id,salary"),
      supabaseAdmin.from("customers").select("id,customer_name,account_id,account_name,attrs").eq("bu", bu),
    ]);

    const salaryById = new Map<string, number>();
    for (const s of salaries || []) salaryById.set(s.org_node_id, Number(s.salary || 0));

    // Best value per (line_code, customer_id)
    const best = new Map<string, { line_code: string; customer_id: string; value: number; priority: string }>();
    for (const r of inputs || []) {
      if (r.value === null || r.value === undefined) continue;
      const key = `${r.line_code}__${r.customer_id}`;
      const cur = best.get(key);
      const pCur = cur ? PRIORITY_ORDER.indexOf(cur.priority as (typeof PRIORITY_ORDER)[number]) : 99;
      const pNew = PRIORITY_ORDER.indexOf(r.priority as (typeof PRIORITY_ORDER)[number]);
      if (!cur || pNew < pCur) best.set(key, { line_code: r.line_code, customer_id: r.customer_id, value: Number(r.value), priority: r.priority });
    }

    // Revenue per customer (used as salary allocation weight)
    const revenueLineCodes = new Set((lines || []).filter(l => l.bucket === "revenue").map(l => l.code));
    const revenueByCustomer = new Map<string, number>();
    for (const v of best.values()) {
      if (revenueLineCodes.has(v.line_code)) {
        revenueByCustomer.set(v.customer_id, (revenueByCustomer.get(v.customer_id) || 0) + v.value);
      }
    }

    // Per-customer line totals — only this customer
    const lineTotals = new Map<string, number>();
    for (const v of best.values()) {
      if (v.customer_id !== customer_id) continue;
      lineTotals.set(v.line_code, (lineTotals.get(v.line_code) || 0) + v.value);
    }

    // Salary allocation: this customer's slice of each matching org node
    const personnelLine =
      (lines || []).find(l => l.kind === "main" && (l.label || "").toLowerCase().includes("pessoal"))?.code ||
      (lines || []).find(l => l.kind === "main" && l.bucket === "cost")?.code;

    let salaryAllocated = 0;
    if (personnelLine && allCustomers) {
      for (const node of orgNodes || []) {
        const sal = salaryById.get(node.id) || 0;
        if (!sal) continue;
        const matched = (allCustomers || []).filter(c => {
          if (node.customer) return c.customer_name === node.customer;
          if (node.account) return c.account_name === node.account || c.account_id === node.account;
          const a = (c.attrs as Record<string, unknown>) || {};
          if (node.channel && a.channel !== node.channel) return false;
          if (node.leader && a.leader !== node.leader) return false;
          if (node.department && a.department !== node.department) return false;
          return true;
        });
        if (matched.length === 0) continue;
        if (!matched.find(c => c.id === customer_id)) continue;
        const weights = matched.map(c => revenueByCustomer.get(c.id) || 0);
        const total = weights.reduce((s, w) => s + w, 0);
        const myWeight = revenueByCustomer.get(customer_id) || 0;
        const slice = total > 0 ? sal * (myWeight / total) : sal / matched.length;
        salaryAllocated += slice;
      }
      if (salaryAllocated > 0) {
        lineTotals.set(personnelLine, (lineTotals.get(personnelLine) || 0) + salaryAllocated);
      }
    }

    // Build response rows in sort_order
    const rows = (lines || [])
      .filter(l => l.kind === "main")
      .map(l => ({
        code: l.code,
        label: l.label,
        bucket: l.bucket,
        department: l.department,
        value: lineTotals.get(l.code) || 0,
      }));

    const sum = (pred: (l: { bucket: string | null }) => boolean) =>
      rows.filter(pred).reduce((s, r) => s + r.value, 0);

    const revenue = sum(l => l.bucket === "revenue");
    const deductions = sum(l => l.bucket === "deduction");
    const costs = sum(l => l.bucket === "cost");
    const netRevenue = revenue - deductions;
    const margin = netRevenue - costs;

    return {
      customer: customerRow,
      lines: rows,
      totals: { revenue, deductions, netRevenue, costs, margin, salaryAllocated },
    };
  });
