import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldOff, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const isAdmin = (roles || []).some(r => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/waterfall" });
  },
  component: AdminPage,
});

type Row = { id: string; full_name: string | null; department: string | null; role: string; is_approved: boolean };
type AuditRow = {
  id: string; action: string; line_code: string | null; bu: string | null;
  department: string | null; old_value: number | null; new_value: number | null;
  changed_by: string | null; changed_at: string;
};

function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,department,is_approved");
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const roleByUser = new Map<string, string>();
    for (const r of roles || []) roleByUser.set(r.user_id, r.role);
    const merged = (profiles || []).map(p => ({
      id: p.id, full_name: p.full_name, department: p.department,
      is_approved: !!p.is_approved,
      role: roleByUser.get(p.id) || "member",
    }));
    setRows(merged);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, role: "admin" | "member") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role });
    load();
  };

  const setApproved = async (userId: string, approved: boolean) => {
    await supabase.from("profiles").update({ is_approved: approved }).eq("id", userId);
    load();
  };

  return (
    <div className="p-10 space-y-8">
      <div>
        <p className="eyebrow">ADMIN</p>
        <h1 className="font-display text-4xl text-primary mt-2">Gestão de usuários e papéis</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Libere quem pode ler/escrever dados (Aprovado) e quem é admin. Usuários novos entram bloqueados — só veem dados após aprovação.
        </p>
      </div>

      <div className="bg-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">Nome</th>
              <th className="text-left px-6 py-3">Departamento</th>
              <th className="text-left px-6 py-3 w-32">Aprovado</th>
              <th className="text-left px-6 py-3 w-32">Papel</th>
              <th className="text-right px-6 py-3 w-80">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Carregando…</td></tr>}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-6 py-3">{r.full_name || "—"}</td>
                <td className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">{r.department || "—"}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded ${r.is_approved ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    {r.is_approved ? <><Check className="w-3 h-3" /> Sim</> : <><X className="w-3 h-3" /> Não</>}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded ${r.role === "admin" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{r.role}</span>
                </td>
                <td className="px-6 py-3 text-right space-x-4">
                  {r.is_approved ? (
                    <button onClick={() => setApproved(r.id, false)}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" /> Bloquear
                    </button>
                  ) : (
                    <button onClick={() => setApproved(r.id, true)}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-emerald-700 hover:opacity-80">
                      <Check className="w-3.5 h-3.5" /> Aprovar
                    </button>
                  )}
                  {r.role === "admin" ? (
                    <button onClick={() => setRole(r.id, "member")}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-destructive">
                      <ShieldOff className="w-3.5 h-3.5" /> Remover admin
                    </button>
                  ) : (
                    <button onClick={() => setRole(r.id, "admin")}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-primary hover:opacity-80">
                      <ShieldCheck className="w-3.5 h-3.5" /> Tornar admin
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Nenhum usuário cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
