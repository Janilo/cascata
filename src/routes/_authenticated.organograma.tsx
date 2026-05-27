import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organograma")({
  component: OrgPage,
});

type Node = { id: string; parent_id: string | null; bu: string | null; department: string | null; leader: string | null; channel: string | null; account: string | null; customer: string | null; salary: number | null };

function OrgPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [form, setForm] = useState<Partial<Node>>({ bu: "B2B" });

  const reload = async () => {
    const { data } = await supabase.from("org_nodes").select("*").order("created_at");
    setNodes((data as Node[]) || []);
  };
  useEffect(() => { reload(); }, []);

  const add = async () => {
    await supabase.from("org_nodes").insert({ ...form, salary: form.salary || 0 });
    setForm({ bu: "B2B" });
    reload();
  };
  const del = async (id: string) => { await supabase.from("org_nodes").delete().eq("id", id); reload(); };

  return (
    <div className="p-10 space-y-8">
      <div>
        <p className="eyebrow">ORGANOGRAMA</p>
        <h1 className="font-display text-4xl text-primary mt-2">BU · Departamento · Líder · Canal · Conta · Cliente</h1>
        <p className="text-sm text-muted-foreground mt-2">Quando faltar valor em algum nível, o rateio do último nível completo é aplicado. Salários entram como gasto no waterfall.</p>
      </div>

      <div className="bg-card border border-border p-6">
        <p className="eyebrow mb-4">NOVO NÓ</p>
        <div className="grid grid-cols-7 gap-3">
          <select value={form.bu || "B2B"} onChange={(e) => setForm({ ...form, bu: e.target.value })} className="border border-border bg-transparent px-3 py-2 text-sm">
            <option>B2B</option><option>B2C</option>
          </select>
          {(["department","leader","channel","account","customer"] as const).map(k => (
            <input key={k} placeholder={k} value={(form as Record<string, unknown>)[k] as string || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="border border-border bg-transparent px-3 py-2 text-sm" />
          ))}
          <input type="number" placeholder="Salário" value={form.salary || ""} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
            className="border border-border bg-transparent px-3 py-2 text-sm" />
        </div>
        <button onClick={add} className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 text-xs uppercase tracking-[0.18em] font-semibold">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      <div className="bg-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">BU</th>
              <th className="text-left px-6 py-3">Depto</th>
              <th className="text-left px-6 py-3">Líder</th>
              <th className="text-left px-6 py-3">Canal</th>
              <th className="text-left px-6 py-3">Conta</th>
              <th className="text-left px-6 py-3">Cliente</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(n => (
              <tr key={n.id} className="border-t border-border">
                <td className="px-6 py-3">{n.bu}</td>
                <td className="px-6 py-3">{n.department}</td>
                <td className="px-6 py-3">{n.leader}</td>
                <td className="px-6 py-3">{n.channel}</td>
                <td className="px-6 py-3">{n.account}</td>
                <td className="px-6 py-3">{n.customer}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => del(n.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {nodes.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-sm">Nenhum nó ainda. Importação de planilha em breve.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
