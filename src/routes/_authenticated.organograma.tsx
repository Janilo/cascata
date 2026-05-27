import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, ChevronRight, ChevronDown, Upload, Loader2 } from "lucide-react";
import { fileToText } from "@/lib/file-parse";

export const Route = createFileRoute("/_authenticated/organograma")({
  component: OrgPage,
});

type Node = {
  id: string; parent_id: string | null;
  bu: string | null; department: string | null; leader: string | null;
  channel: string | null; account: string | null; customer: string | null;
  salary: number | null;
};

const LEVELS = ["bu", "department", "leader", "channel", "account", "customer"] as const;
type Level = (typeof LEVELS)[number];

type TreeNode = {
  level: Level;
  value: string;
  children: TreeNode[];
  salary: number; // sum of salaries below
  count: number;
};

function buildTree(nodes: Node[]): TreeNode[] {
  const root: TreeNode = { level: "bu", value: "_root", children: [], salary: 0, count: 0 };
  for (const n of nodes) {
    let cursor = root;
    for (const lvl of LEVELS) {
      const val = (n[lvl] || "—") as string;
      let child = cursor.children.find((c) => c.value === val && c.level === lvl);
      if (!child) {
        child = { level: lvl, value: val, children: [], salary: 0, count: 0 };
        cursor.children.push(child);
      }
      child.salary += Number(n.salary || 0);
      child.count += 1;
      cursor = child;
    }
  }
  return root.children;
}

function OrgPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [form, setForm] = useState<Partial<Node>>({ bu: "B2B" });
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"tree" | "table">("tree");

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

  const importFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await fileToText(file);
      // Heuristic CSV import: expects header row with BU,Departamento,Líder,Canal,Conta,Cliente,Salário
      const rows = text.split(/\r?\n/).filter((r) => r.trim()).map((r) => r.split(","));
      if (rows.length < 2) { alert("Não consegui ler o arquivo. Esperado: BU,Departamento,Líder,Canal,Conta,Cliente,Salário"); setBusy(false); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (k: string) => header.findIndex((h) => h.includes(k));
      const iBu = idx("bu"), iDept = idx("depart"), iLead = idx("líder") >= 0 ? idx("líder") : idx("lider"),
        iCh = idx("canal"), iAcc = idx("conta"), iCust = idx("cliente"), iSal = idx("salár") >= 0 ? idx("salár") : idx("salar");
      const inserts: Partial<Node>[] = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row.some((c) => c?.trim())) continue;
        inserts.push({
          bu: iBu >= 0 ? row[iBu]?.trim() : "B2B",
          department: iDept >= 0 ? row[iDept]?.trim() : null,
          leader: iLead >= 0 ? row[iLead]?.trim() : null,
          channel: iCh >= 0 ? row[iCh]?.trim() : null,
          account: iAcc >= 0 ? row[iAcc]?.trim() : null,
          customer: iCust >= 0 ? row[iCust]?.trim() : null,
          salary: iSal >= 0 ? Number((row[iSal] || "0").replace(/[^\d.-]/g, "")) || 0 : 0,
        });
      }
      if (inserts.length === 0) { alert("Nenhuma linha encontrada."); setBusy(false); return; }
      const { error } = await supabase.from("org_nodes").insert(inserts);
      if (error) alert(error.message);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  return (
    <div className="p-10 space-y-8">
      <div>
        <p className="eyebrow">ORGANOGRAMA</p>
        <h1 className="font-display text-4xl text-primary mt-2">BU · Departamento · Líder · Canal · Conta · Cliente</h1>
        <p className="text-sm text-muted-foreground mt-2">Quando faltar valor em algum nível, o rateio do último nível completo é aplicado. Salários entram como gasto no waterfall.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="inline-flex border border-border">
          {(["tree", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-5 py-2 text-xs uppercase tracking-[0.18em] font-semibold ${view === v ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-secondary"}`}>
              {v === "tree" ? "Árvore" : "Tabela"}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 bg-secondary px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-primary hover:text-primary-foreground cursor-pointer">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Importar planilha
          <input type="file" hidden accept=".csv,.txt,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} />
        </label>
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

      {view === "tree" ? (
        <div className="bg-card border border-border p-6">
          {tree.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum nó ainda. Importe uma planilha ou cadastre manualmente.</p>
          ) : (
            <ul className="space-y-1">{tree.map((n, i) => <TreeRow key={i} node={n} depth={0} />)}</ul>
          )}
        </div>
      ) : (
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
                <th className="text-right px-6 py-3">Salário</th>
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
                  <td className="px-6 py-3 text-right font-mono text-xs">{fmt(Number(n.salary || 0))}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => del(n.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {nodes.length === 0 && <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground text-sm">Nenhum nó ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = node.children.length > 0;
  return (
    <li>
      <button onClick={() => hasKids && setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-secondary text-left">
        <span style={{ width: depth * 18 }} />
        {hasKids ? (open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />) : <span className="w-3.5" />}
        <span className="text-xs uppercase tracking-wider text-muted-foreground w-24">{node.level}</span>
        <span className="text-sm font-medium text-foreground flex-1">{node.value}</span>
        <span className="text-xs text-muted-foreground">{node.count} {node.count === 1 ? "pessoa" : "pessoas"}</span>
        <span className="text-xs font-mono text-primary w-32 text-right">{fmt(node.salary)}</span>
      </button>
      {hasKids && open && (
        <ul className="space-y-0.5">
          {node.children.map((c, i) => <TreeRow key={i} node={c} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}
