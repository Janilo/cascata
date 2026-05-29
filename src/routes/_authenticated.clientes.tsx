import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { fileToText } from "@/lib/file-parse";
import { useBusinessUnits } from "@/hooks/use-business-units";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientsPage,
});

type Customer = { id: string; account_id: string | null; account_name: string | null; customer_name: string; cnpj: string | null; bu: string };

function ClientsPage() {
  const [list, setList] = useState<Customer[]>([]);
  const { bus } = useBusinessUnits();
  const defaultBu = bus[0]?.code ?? "B2B";
  const [form, setForm] = useState<Partial<Customer>>({ bu: defaultBu });
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { data } = await supabase.from("customers").select("*").order("customer_name");
    setList((data as Customer[]) || []);
  };
  useEffect(() => { reload(); }, []);

  const add = async () => {
    if (!form.customer_name) return;
    await supabase.from("customers").insert({
      customer_name: form.customer_name, account_id: form.account_id || null,
      account_name: form.account_name || null, cnpj: form.cnpj || null, bu: form.bu || defaultBu,
    });
    setForm({ bu: defaultBu });
    reload();
  };
  const del = async (id: string) => { await supabase.from("customers").delete().eq("id", id); reload(); };

  const upload = async (file: File) => {
    setBusy(true);
    const text = await fileToText(file);
    const { data, error } = await supabase.functions.invoke("extract-customers", {
      body: { fileName: file.name, content: text.slice(0, 8000) },
    });
    if (!error && data?.customers) {
      for (const c of data.customers as Array<Partial<Customer>>) {
        if (!c.customer_name) continue;
        await supabase.from("customers").insert({
          customer_name: c.customer_name, account_id: c.account_id || null,
          account_name: c.account_name || null, cnpj: c.cnpj || null, bu: c.bu || defaultBu,
        });
      }
      reload();
    } else if (error) {
      alert(error.message);
    }
    setBusy(false);
  };

  return (
    <div className="p-10 space-y-8">
      <div>
        <p className="eyebrow">CLIENTES</p>
        <h1 className="font-display text-4xl text-primary mt-2">Base de clientes para o waterfall</h1>
      </div>

      <div className="bg-card border border-border p-6 space-y-4">
        <p className="eyebrow">CADASTRAR MANUAL</p>
        <div className="grid grid-cols-6 gap-3">
          <input placeholder="ID conta" value={form.account_id || ""} onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            className="border border-border bg-transparent px-3 py-2 text-sm" />
          <input placeholder="Conta" value={form.account_name || ""} onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            className="border border-border bg-transparent px-3 py-2 text-sm" />
          <input placeholder="Nome cliente *" value={form.customer_name || ""} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            className="border border-border bg-transparent px-3 py-2 text-sm" />
          <input placeholder="CNPJ" value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            className="border border-border bg-transparent px-3 py-2 text-sm" />
          <select value={form.bu || defaultBu} onChange={(e) => setForm({ ...form, bu: e.target.value })}
            className="border border-border bg-transparent px-3 py-2 text-sm">
            {bus.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
          <button onClick={add} className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
        <div className="pt-4 border-t border-border">
          <label className="inline-flex items-center gap-2 bg-secondary px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-primary hover:text-primary-foreground cursor-pointer">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar arquivo + IA
            <input type="file" hidden accept=".csv,.txt,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </label>
        </div>
      </div>

      <div className="bg-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">ID Conta</th>
              <th className="text-left px-6 py-3">Conta</th>
              <th className="text-left px-6 py-3">Cliente</th>
              <th className="text-left px-6 py-3">CNPJ</th>
              <th className="text-left px-6 py-3">BU</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-6 py-3 font-mono text-xs">{c.account_id}</td>
                <td className="px-6 py-3">{c.account_name}</td>
                <td className="px-6 py-3">{c.customer_name}</td>
                <td className="px-6 py-3 font-mono text-xs">{c.cnpj}</td>
                <td className="px-6 py-3">{c.bu}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">Nenhum cliente cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
