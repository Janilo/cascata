import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerPnL } from "@/lib/cost-to-serve.functions";

export const Route = createFileRoute("/_authenticated/custo-de-servir")({
  component: CostToServePage,
});

type Customer = { id: string; customer_name: string; account_name: string | null; bu: string };

function CostToServePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("customers").select("id,customer_name,account_name,bu").order("customer_name");
      setCustomers((data as Customer[]) || []);
      if (data && data.length && !selected) setSelected(data[0].id);
    })();
  }, []);

  const fetchPnL = useServerFn(getCustomerPnL);
  const { data, isLoading } = useQuery({
    queryKey: ["customer-pnl", selected],
    queryFn: () => fetchPnL({ data: { customer_id: selected } }),
    enabled: !!selected,
  });

  return (
    <div className="p-10 space-y-8">
      <div>
        <p className="eyebrow">CUSTO DE SERVIR</p>
        <h1 className="font-display text-4xl text-primary mt-2">P&L por cliente</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Receita líquida menos custos alocados (inclui rateio de salário do organograma).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="eyebrow">Cliente</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          className="border border-border bg-transparent px-4 py-2 text-sm min-w-[320px]">
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.customer_name} {c.account_name ? `· ${c.account_name}` : ""} · {c.bu}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Calculando…</p>}

      {data?.totals && (
        <>
          <div className="grid grid-cols-5 gap-4">
            <Kpi label="Receita bruta" value={data.totals.revenue} />
            <Kpi label="Deduções" value={-data.totals.deductions} />
            <Kpi label="Receita líquida" value={data.totals.netRevenue} accent />
            <Kpi label="Custos alocados" value={-data.totals.costs} />
            <Kpi label="Margem" value={data.totals.margin} accent={data.totals.margin >= 0} negative={data.totals.margin < 0} />
          </div>

          <div className="bg-card border border-border">
            <div className="px-6 py-3 border-b border-border flex items-center justify-between">
              <p className="eyebrow">DETALHE POR LINHA</p>
              <p className="text-xs text-muted-foreground">Salário alocado: {fmt(data.totals.salaryAllocated)}</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-3 w-16">#</th>
                  <th className="text-left px-6 py-3">Linha</th>
                  <th className="text-left px-6 py-3 w-32">Tipo</th>
                  <th className="text-left px-6 py-3 w-40">Depto</th>
                  <th className="text-right px-6 py-3 w-40">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map(l => (
                  <tr key={l.code} className="border-t border-border">
                    <td className="px-6 py-2 font-mono text-xs text-muted-foreground">{l.code}</td>
                    <td className="px-6 py-2">{l.label}</td>
                    <td className="px-6 py-2"><BucketBadge bucket={l.bucket} /></td>
                    <td className="px-6 py-2 text-muted-foreground text-xs uppercase tracking-wider">{l.department || "—"}</td>
                    <td className={`px-6 py-2 text-right font-mono text-xs ${l.bucket === "revenue" ? "text-foreground" : "text-muted-foreground"}`}>
                      {fmt(l.bucket === "revenue" ? l.value : -l.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent, negative }: { label: string; value: number; accent?: boolean; negative?: boolean }) {
  return (
    <div className={`p-5 border ${accent ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-mono text-2xl ${negative ? "text-destructive" : accent ? "text-primary" : "text-foreground"}`}>{fmt(value)}</p>
    </div>
  );
}

function BucketBadge({ bucket }: { bucket: string | null }) {
  const m: Record<string, string> = {
    revenue: "bg-emerald-100 text-emerald-900",
    deduction: "bg-amber-100 text-amber-900",
    cost: "bg-rose-100 text-rose-900",
  };
  const label: Record<string, string> = { revenue: "Receita", deduction: "Dedução", cost: "Custo" };
  return <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded ${m[bucket || ""] || "bg-secondary"}`}>{label[bucket || ""] || bucket}</span>;
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}
