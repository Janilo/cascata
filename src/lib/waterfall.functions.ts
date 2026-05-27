// Server fn that aggregates line_inputs into waterfall totals,
// applying priority P1>P2>P3>MANUAL per (line_code, customer_id, bu),
// and allocates org_nodes salaries as costs into the "Pessoal" buckets.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({ bu: z.enum(["B2B", "B2C"]) });

const PRIORITY_ORDER = ["P1", "P2", "P3", "MANUAL", "RATEIO"] as const;

export const getWaterfall = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const { bu } = data;

    const [{ data: inputs }, { data: lines }, { data: orgNodes }] = await Promise.all([
      supabaseAdmin.from("line_inputs").select("line_code,customer_id,value,priority,bu,department").eq("bu", bu),
      supabaseAdmin.from("waterfall_lines").select("code,department,kind,bucket,label,main_no,sub_no,sort_order"),
      supabaseAdmin.from("org_nodes").select("bu,department,leader,channel,account,customer,salary").eq("bu", bu),
    ]);

    // Reduce per (line_code, customer_id) by priority
    const best = new Map<string, { line_code: string; value: number; priority: string }>();
    for (const r of inputs || []) {
      if (r.value === null || r.value === undefined) continue;
      const key = `${r.line_code}__${r.customer_id}`;
      const cur = best.get(key);
      const pCur = cur ? PRIORITY_ORDER.indexOf(cur.priority as (typeof PRIORITY_ORDER)[number]) : 99;
      const pNew = PRIORITY_ORDER.indexOf(r.priority as (typeof PRIORITY_ORDER)[number]);
      if (!cur || pNew < pCur) best.set(key, { line_code: r.line_code, value: Number(r.value), priority: r.priority });
    }

    // Aggregate per line_code
    const totals = new Map<string, number>();
    for (const v of best.values()) totals.set(v.line_code, (totals.get(v.line_code) || 0) + v.value);

    // Allocate salaries from org_nodes into "Pessoal" line.
    // Rule: when a salary node has no customer, allocate to the last complete level
    // proportional to gross revenue at that level. For now we sum all salaries
    // into the personnel line (#20 by convention; falls back to first cost line).
    const personnelLine =
      (lines || []).find((l) => l.kind === "main" && (l.label || "").toLowerCase().includes("pessoal"))?.code ||
      (lines || []).find((l) => l.kind === "main" && l.bucket === "cost")?.code;

    if (personnelLine) {
      const salaryTotal = (orgNodes || []).reduce((s, n) => s + Number(n.salary || 0), 0);
      if (salaryTotal > 0) totals.set(personnelLine, (totals.get(personnelLine) || 0) + salaryTotal);
    }

    return {
      totalsByCode: Object.fromEntries(totals),
      salaryTotal: (orgNodes || []).reduce((s, n) => s + Number(n.salary || 0), 0),
      inputsCount: (inputs || []).length,
    };
  });
