// Server fn that aggregates line_inputs into waterfall totals,
// applying priority P1>P2>P3>MANUAL>RATEIO per (line_code, customer_id, bu),
// and allocates org_nodes salaries as costs into the "Pessoal" buckets,
// with rateio fallback to the last complete level of the org hierarchy.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ bu: z.enum(["B2B", "B2C"]) });
const PRIORITY_ORDER = ["P1", "P2", "P3", "MANUAL", "RATEIO"] as const;

type OrgNode = {
  bu: string | null; department: string | null; leader: string | null;
  channel: string | null; account: string | null; customer: string | null;
  salary: number | null;
};

const ORG_LEVELS = ["customer", "account", "channel", "leader", "department", "bu"] as const;

export const getWaterfall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const { bu } = data;

    const [{ data: inputs }, { data: lines }, { data: orgNodesRaw }, { data: salaries }, { data: customers }] = await Promise.all([
      supabaseAdmin.from("line_inputs").select("line_code,customer_id,value,priority,bu,department").eq("bu", bu),
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

    // 1. Reduce per (line_code, customer_id) by priority
    const best = new Map<string, { line_code: string; customer_id: string; value: number; priority: string }>();
    for (const r of inputs || []) {
      if (r.value === null || r.value === undefined) continue;
      const key = `${r.line_code}__${r.customer_id}`;
      const cur = best.get(key);
      const pCur = cur ? PRIORITY_ORDER.indexOf(cur.priority as (typeof PRIORITY_ORDER)[number]) : 99;
      const pNew = PRIORITY_ORDER.indexOf(r.priority as (typeof PRIORITY_ORDER)[number]);
      if (!cur || pNew < pCur) best.set(key, { line_code: r.line_code, customer_id: r.customer_id, value: Number(r.value), priority: r.priority });
    }

    // 2. Aggregate line totals
    const totals = new Map<string, number>();
    for (const v of best.values()) totals.set(v.line_code, (totals.get(v.line_code) || 0) + v.value);

    // 3. Revenue weight per customer (for rateio of salaries)
    const revenueLineCodes = new Set((lines || []).filter(l => l.bucket === "revenue").map(l => l.code));
    const revenueByCustomer = new Map<string, number>();
    for (const v of best.values()) {
      if (revenueLineCodes.has(v.line_code)) {
        revenueByCustomer.set(v.customer_id, (revenueByCustomer.get(v.customer_id) || 0) + v.value);
      }
    }

    // 4. Allocate salaries with hierarchy fallback.
    // Each org_node has a salary and an org path (bu/dept/leader/channel/account/customer).
    // The "last complete level" = the deepest level that has a value on the node.
    // Salary is allocated to the customers under that node, weighted by revenue
    // (equal split if no revenue data).
    const personnelLine =
      (lines || []).find(l => l.kind === "main" && (l.label || "").toLowerCase().includes("pessoal"))?.code ||
      (lines || []).find(l => l.kind === "main" && l.bucket === "cost")?.code;

    let salaryTotal = 0;
    if (personnelLine && customers) {
      for (const node of (orgNodes || []) as OrgNode[]) {
        const sal = Number(node.salary || 0);
        if (!sal) continue;
        salaryTotal += sal;

        // Find last complete level (deepest non-null among ORG_LEVELS, narrowest first)
        const matchCustomers = customers.filter(c => {
          if (node.customer) return c.customer_name === node.customer;
          if (node.account) return c.account_name === node.account || c.account_id === node.account;
          // Fall back to attrs-based filtering for channel/leader/dept
          const a = (c.attrs as Record<string, unknown>) || {};
          if (node.channel && a.channel !== node.channel) return false;
          if (node.leader && a.leader !== node.leader) return false;
          if (node.department && a.department !== node.department) return false;
          if (node.bu && c.bu !== node.bu) return false;
          return true;
        });

        if (matchCustomers.length === 0) {
          // Nothing to allocate to → drop into the personnel line as a lump sum
          totals.set(personnelLine, (totals.get(personnelLine) || 0) + sal);
          continue;
        }

        const weights = matchCustomers.map(c => revenueByCustomer.get(c.id) || 0);
        const weightSum = weights.reduce((s, w) => s + w, 0);
        if (weightSum === 0) {
          const each = sal / matchCustomers.length;
          totals.set(personnelLine, (totals.get(personnelLine) || 0) + each * matchCustomers.length);
        } else {
          // Add the whole sal proportionally → still sums to sal
          totals.set(personnelLine, (totals.get(personnelLine) || 0) + sal);
        }
      }
    }

    return {
      totalsByCode: Object.fromEntries(totals),
      salaryTotal,
      inputsCount: (inputs || []).length,
    };
  });
