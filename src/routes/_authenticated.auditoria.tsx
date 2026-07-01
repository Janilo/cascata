import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, Filter } from "lucide-react";
import { useBusinessUnits } from "@/hooks/use-business-units";

export const Route = createFileRoute("/_authenticated/auditoria")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);
    const isAdmin = (roles || []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/waterfall" });
  },
  component: AuditoriaPage,
});

type AuditRow = {
  id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  line_input_id: string | null;
  line_code: string | null;
  bu: string | null;
  customer_id: string | null;
  department: string | null;
  old_value: number | null;
  new_value: number | null;
  changed_by: string | null;
  changed_at: string;
};

const fmt = (n: number | null) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(n);

function AuditoriaPage() {
  const { bus } = useBusinessUnits();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [users, setUsers] = useState<Map<string, string>>(new Map());
  const [customers, setCustomers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fAction, setFAction] = useState<string>("");
  const [fBu, setFBu] = useState<string>("");
  const [fDept, setFDept] = useState<string>("");
  const [fLine, setFLine] = useState<string>("");
  const [limit, setLimit] = useState(200);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: audit }, { data: profiles }, { data: custs }] = await Promise.all([
        supabase
          .from("line_inputs_audit")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(limit),
        supabase.from("profiles").select("id,full_name"),
        supabase.from("customers").select("id,customer_name"),
      ]);
      setRows((audit as AuditRow[]) || []);
      const um = new Map<string, string>();
      for (const p of profiles || []) um.set(p.id, p.full_name || p.id.slice(0, 8));
      setUsers(um);
      const cm = new Map<string, string>();
      for (const c of custs || []) cm.set(c.id, c.customer_name);
      setCustomers(cm);
      setLoading(false);
    })();
  }, [limit]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fAction && r.action !== fAction) return false;
      if (fBu && r.bu !== fBu) return false;
      if (fDept && r.department !== fDept) return false;
      if (fLine && r.line_code !== fLine) return false;
      return true;
    });
  }, [rows, fAction, fBu, fDept, fLine]);

  const depts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.department).filter(Boolean))) as string[],
    [rows],
  );
  const codes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.line_code).filter(Boolean))) as string[],
    [rows],
  );

  const delta = (r: AuditRow) => {
    if (r.action === "INSERT") return r.new_value ?? 0;
    if (r.action === "DELETE") return -(r.old_value ?? 0);
    return (r.new_value ?? 0) - (r.old_value ?? 0);
  };

  return (
    <div className="p-10 space-y-8">
      <div>
        <p className="eyebrow flex items-center gap-2">
          <History className="w-3 h-3" /> AUDITORIA
        </p>
        <h1 className="font-display text-4xl text-primary mt-2">Histórico de alterações</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Todas as inserções, edições e exclusões em <code>line_inputs</code>, com diff de valor e
          autor.
        </p>
      </div>

      <div className="bg-card border border-border p-4 flex flex-wrap items-end gap-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Ação</span>
          <select
            value={fAction}
            onChange={(e) => setFAction(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">BU</span>
          <select
            value={fBu}
            onChange={(e) => setFBu(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {bus.map((b) => (
              <option key={b.code} value={b.code}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Depto</span>
          <select
            value={fDept}
            onChange={(e) => setFDept(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Linha</span>
          <select
            value={fLine}
            onChange={(e) => setFLine(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {codes.sort().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Limite</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-background border border-border px-3 py-2 text-sm"
          >
            {[100, 200, 500, 1000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-xs text-muted-foreground uppercase tracking-[0.12em]">
          {filtered.length} de {rows.length} registros
        </div>
      </div>

      <div className="bg-card border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr className="text-left">
              <th className="px-4 py-3 eyebrow text-[10px]">Quando</th>
              <th className="px-4 py-3 eyebrow text-[10px]">Quem</th>
              <th className="px-4 py-3 eyebrow text-[10px]">Ação</th>
              <th className="px-4 py-3 eyebrow text-[10px]">BU</th>
              <th className="px-4 py-3 eyebrow text-[10px]">Depto</th>
              <th className="px-4 py-3 eyebrow text-[10px]">Linha</th>
              <th className="px-4 py-3 eyebrow text-[10px]">Cliente</th>
              <th className="px-4 py-3 eyebrow text-[10px] text-right">De</th>
              <th className="px-4 py-3 eyebrow text-[10px] text-right">Para</th>
              <th className="px-4 py-3 eyebrow text-[10px] text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum registro.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const d = delta(r);
              const badge =
                r.action === "INSERT"
                  ? "bg-[var(--gold)] text-ink"
                  : r.action === "DELETE"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground";
              return (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(r.changed_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.changed_by ? users.get(r.changed_by) || r.changed_by.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold ${badge}`}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{r.bu || "—"}</td>
                  <td className="px-4 py-2 text-xs">{r.department || "—"}</td>
                  <td className="px-4 py-2 text-xs font-mono">{r.line_code || "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.customer_id
                      ? customers.get(r.customer_id) || r.customer_id.slice(0, 8)
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-right tabular-nums text-muted-foreground">
                    {fmt(r.old_value)}
                  </td>
                  <td className="px-4 py-2 text-xs text-right tabular-nums">{fmt(r.new_value)}</td>
                  <td
                    className={`px-4 py-2 text-xs text-right tabular-nums font-semibold ${d > 0 ? "text-[var(--gold)]" : d < 0 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {d > 0 ? "▲ " : d < 0 ? "▼ " : ""}
                    {fmt(Math.abs(d))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
