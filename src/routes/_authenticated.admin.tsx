import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldOff, Check, X, Plus, Trash2 } from "lucide-react";

const DEPARTMENTS = [
  "CEO", "Comercial", "PS", "Produto", "Fiscal", "Financeiro",
  "Tech/Infra", "CS", "Suporte", "PS/Onboarding",
  "Marketing", "Engenharia", "G&A",
];

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

type BU = { code: string; label: string; sort_order: number };

function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());

  const [bus, setBus] = useState<BU[]>([]);
  const [newBuCode, setNewBuCode] = useState("");
  const [newBuLabel, setNewBuLabel] = useState("");

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
    const names = new Map<string, string>();
    for (const p of profiles || []) names.set(p.id, p.full_name || p.id.slice(0, 8));
    setNameById(names);
    const { data: a } = await supabase
      .from("line_inputs_audit")
      .select("id,action,line_code,bu,department,old_value,new_value,changed_by,changed_at")
      .order("changed_at", { ascending: false })
      .limit(200);
    setAudit((a as AuditRow[]) || []);
    const { data: b } = await supabase.from("business_units").select("code,label,sort_order").order("sort_order");
    setBus((b as BU[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addBu = async () => {
    const code = newBuCode.trim().toUpperCase();
    const label = newBuLabel.trim() || code;
    if (!code) return;
    const nextOrder = (bus[bus.length - 1]?.sort_order ?? 0) + 10;
    const { error } = await supabase.from("business_units").insert({ code, label, sort_order: nextOrder });
    if (error) { alert(error.message); return; }
    setNewBuCode(""); setNewBuLabel("");
    load();
  };
  const renameBu = async (code: string, label: string) => {
    await supabase.from("business_units").update({ label }).eq("code", code);
    load();
  };
  const delBu = async (code: string) => {
    if (!confirm(`Excluir BU "${code}"? Dados existentes em customers/line_inputs com este código não serão apagados, mas a BU some dos seletores.`)) return;
    const { error } = await supabase.from("business_units").delete().eq("code", code);
    if (error) { alert(error.message); return; }
    load();
  };

  const setRole = async (userId: string, role: "admin" | "member") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role });
    load();
  };

  const setApproved = async (userId: string, approved: boolean) => {
    await supabase.from("profiles").update({ is_approved: approved }).eq("id", userId);
    load();
  };

  const setDepartment = async (userId: string, department: string) => {
    await supabase.from("profiles").update({ department: department || null }).eq("id", userId);
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
                <td className="px-6 py-3 text-xs">
                  <select
                    value={r.department || ""}
                    onChange={(e) => setDepartment(r.id, e.target.value)}
                    className="bg-transparent border border-border rounded px-2 py-1 text-xs uppercase tracking-wider"
                  >
                    <option value="">—</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded ${r.is_approved ? "pill-inflow" : "bg-muted text-muted-foreground"}`}>
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

      <div>
        <p className="eyebrow">BUSINESS UNITS</p>
        <h2 className="font-display text-2xl text-primary mt-2">Unidades de negócio</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Edite o nome exibido das BUs ou cadastre novas. O código (ex: B2B) é o identificador interno usado em clientes, inputs e organograma — não pode ser alterado depois de criado.
        </p>
      </div>

      <div className="bg-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3 w-32">Código</th>
              <th className="text-left px-6 py-3">Nome exibido</th>
              <th className="text-right px-6 py-3 w-32">Ações</th>
            </tr>
          </thead>
          <tbody>
            {bus.map(b => (
              <tr key={b.code} className="border-t border-border">
                <td className="px-6 py-3 font-mono text-xs">{b.code}</td>
                <td className="px-6 py-3">
                  <input
                    defaultValue={b.label}
                    onBlur={(e) => { if (e.target.value !== b.label) renameBu(b.code, e.target.value); }}
                    className="bg-transparent border border-border rounded px-2 py-1 text-sm w-full max-w-md"
                  />
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => delBu(b.code)}
                    className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-border bg-secondary/20">
              <td className="px-6 py-3">
                <input
                  value={newBuCode}
                  onChange={(e) => setNewBuCode(e.target.value)}
                  placeholder="B2X"
                  className="bg-transparent border border-border rounded px-2 py-1 font-mono text-xs uppercase w-full"
                />
              </td>
              <td className="px-6 py-3">
                <input
                  value={newBuLabel}
                  onChange={(e) => setNewBuLabel(e.target.value)}
                  placeholder="Nome exibido (opcional)"
                  className="bg-transparent border border-border rounded px-2 py-1 text-sm w-full max-w-md"
                />
              </td>
              <td className="px-6 py-3 text-right">
                <button onClick={addBu}
                  className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-primary hover:opacity-80">
                  <Plus className="w-3.5 h-3.5" /> Adicionar BU
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>


      <div>
        <p className="eyebrow">AUDITORIA</p>
        <h2 className="font-display text-2xl text-primary mt-2">Histórico de alterações — Waterfall</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Últimas 200 mudanças nas linhas do waterfall (quem, quando, valor anterior e novo).
        </p>
      </div>

      <div className="bg-card border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">Quando</th>
              <th className="text-left px-6 py-3">Usuário</th>
              <th className="text-left px-6 py-3">Ação</th>
              <th className="text-left px-6 py-3">Linha</th>
              <th className="text-left px-6 py-3">BU</th>
              <th className="text-left px-6 py-3">Depto</th>
              <th className="text-right px-6 py-3">Valor anterior</th>
              <th className="text-right px-6 py-3">Valor novo</th>
              <th className="text-right px-6 py-3">Δ</th>
            </tr>
          </thead>
          <tbody>
            {!loading && audit.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">Nenhuma alteração registrada ainda.</td></tr>
            )}
            {audit.map(a => {
              const delta = (a.new_value ?? 0) - (a.old_value ?? 0);
              const fmt = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-6 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(a.changed_at).toLocaleString("pt-BR")}</td>
                  <td className="px-6 py-2 text-xs">{a.changed_by ? (nameById.get(a.changed_by) || a.changed_by.slice(0, 8)) : "—"}</td>
                  <td className="px-6 py-2">
                    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded ${a.action === "INSERT" ? "bg-emerald-600 text-white" : a.action === "DELETE" ? "bg-destructive text-destructive-foreground" : "bg-secondary"}`}>{a.action}</span>
                  </td>
                  <td className="px-6 py-2 font-mono text-xs">{a.line_code || "—"}</td>
                  <td className="px-6 py-2 text-xs">{a.bu || "—"}</td>
                  <td className="px-6 py-2 text-xs">{a.department || "—"}</td>
                  <td className="px-6 py-2 text-right font-mono text-xs">{fmt(a.old_value)}</td>
                  <td className="px-6 py-2 text-right font-mono text-xs">{fmt(a.new_value)}</td>
                  <td className={`px-6 py-2 text-right font-mono text-xs ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>{delta === 0 ? "—" : fmt(delta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
