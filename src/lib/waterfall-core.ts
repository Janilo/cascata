// Data-access wrapper: fetches the rows for a BU/filter and delegates the
// arithmetic to the pure `reduceWaterfall` (waterfall-reduce.ts). Used by both
// the authenticated and public (token-shared) waterfall server fns.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reduceWaterfall } from "./waterfall-reduce";
import type { Customer, LineInput, OrgNode, WaterfallLine } from "./waterfall-reduce";

export type WaterfallArgs = {
  bu: string;
  department?: string;
  leader?: string;
  account?: string;
  customerId?: string;
  referenceDate?: string;
};

export async function computeWaterfall(args: WaterfallArgs) {
  const { bu, referenceDate } = args;

  const inputsQuery = supabaseAdmin
    .from("line_inputs")
    .select("line_code,customer_id,value,priority,bu,department,reference_date")
    .eq("bu", bu);
  if (referenceDate) inputsQuery.eq("reference_date", referenceDate);

  const [
    { data: inputs },
    { data: lines },
    { data: orgNodesRaw },
    { data: salaries },
    { data: customers },
  ] = await Promise.all([
    inputsQuery,
    supabaseAdmin
      .from("waterfall_lines")
      .select("code,department,kind,bucket,label,main_no,sub_no,sort_order"),
    supabaseAdmin
      .from("org_nodes")
      .select("id,bu,department,leader,channel,account,customer")
      .eq("bu", bu),
    supabaseAdmin.from("org_node_salaries").select("org_node_id,salary"),
    supabaseAdmin
      .from("customers")
      .select("id,customer_name,account_id,account_name,attrs,bu")
      .eq("bu", bu),
  ]);

  const salaryByNodeId = new Map<string, number>();
  for (const s of salaries || []) salaryByNodeId.set(s.org_node_id, Number(s.salary || 0));
  const orgNodes: OrgNode[] = (orgNodesRaw || []).map((n) => ({
    bu: n.bu,
    department: n.department,
    leader: n.leader,
    channel: n.channel,
    account: n.account,
    customer: n.customer,
    salary: salaryByNodeId.get(n.id) || 0,
  }));

  const result = reduceWaterfall(
    (inputs || []) as LineInput[],
    (lines || []) as WaterfallLine[],
    orgNodes,
    (customers ?? null) as Customer[] | null,
    args,
  );

  return {
    ...result,
    inputsCount: (inputs || []).length,
    lines: lines || [],
  };
}
