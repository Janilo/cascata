import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2 } from "lucide-react";
import { fileToText } from "@/lib/file-parse";
import { saveExtractedLineInputs, saveLineInput } from "@/lib/inputs.functions";
import { useBusinessUnits } from "@/hooks/use-business-units";

export const Route = createFileRoute("/_authenticated/inputs")({
  component: InputsPage,
});

type Line = {
  code: string;
  label: string | null;
  department: string | null;
  p1_desc: string | null;
  p2_desc: string | null;
  p3_desc: string | null;
  kind: string;
  main_no: number | null;
  sub_no: number | null;
};
type Customer = { id: string; customer_name: string; bu: string };

const DEPT_COLORS: Record<string, string> = {
  Comercial: "var(--cascata-navy)",
  PS: "var(--cascata-gold)",
  Produto: "var(--cascata-steel)",
  Fiscal: "var(--cascata-inflow)",
  Financeiro: "var(--cascata-outflow)",
  "Tech/Infra": "var(--navy-deep)",
};
const DEPT_FALLBACK = "var(--cascata-mute)";

function InputsPage() {
  const [dept, setDept] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inputs, setInputs] = useState<
    Array<{
      line_code: string;
      customer_id: string;
      value: number | null;
      priority: string;
      department: string;
      ai_extraction: any;
    }>
  >([]);
  const { bus } = useBusinessUnits();
  const [bu, setBu] = useState<string>("B2B");
  useEffect(() => {
    if (bus.length && !bus.find((b) => b.code === bu)) setBu(bus[0].code);
  }, [bus, bu]);
  const [busy, setBusy] = useState<string | null>(null);
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const referenceDate = `${referenceMonth}-01`;

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", u.user.id)
        .maybeSingle();
      setDept(p?.department || "");
      const { data: ls } = await supabase.from("waterfall_lines").select("*").order("sort_order");
      setLines((ls as Line[]) || []);
      const { data: cs } = await supabase
        .from("customers")
        .select("id,customer_name,bu")
        .order("customer_name");
      setCustomers((cs as Customer[]) || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: ins } = await supabase
        .from("line_inputs")
        .select("line_code,customer_id,value,priority,department,ai_extraction")
        .eq("reference_date", referenceDate);
      setInputs(ins || []);
    })();
  }, [referenceDate]);

  const myMainLines = useMemo(
    () => lines.filter((l) => l.kind === "main" && l.department === dept),
    [lines, dept],
  );
  const subsByMain = useMemo(() => {
    const m = new Map<number, Line[]>();
    for (const l of lines) {
      if (l.kind !== "sub" || l.department !== dept || l.main_no == null) continue;
      const arr = m.get(l.main_no) || [];
      arr.push(l);
      m.set(l.main_no, arr);
    }
    return m;
  }, [lines, dept]);
  const myLines = myMainLines;
  const buCustomers = useMemo(() => customers.filter((c) => c.bu === bu), [customers, bu]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Progress bars
  const myTotal = myLines.length * buCustomers.length;
  const myFilled = useMemo(
    () =>
      inputs.filter(
        (i) =>
          i.department === dept &&
          myLines.some((l) => l.code === i.line_code) &&
          buCustomers.some((c) => c.id === i.customer_id) &&
          i.value !== null,
      ).length,
    [inputs, dept, myLines, buCustomers],
  );

  // Global stacked: per dept count
  const allByDept = useMemo(() => {
    const m = new Map<string, { total: number; filled: number }>();
    for (const l of lines) {
      if (!l.department) continue;
      const cur = m.get(l.department) || { total: 0, filled: 0 };
      cur.total += buCustomers.length;
      m.set(l.department, cur);
    }
    for (const i of inputs) {
      if (i.value === null) continue;
      const cur = m.get(i.department);
      if (!cur) continue;
      if (!buCustomers.some((c) => c.id === i.customer_id)) continue;
      cur.filled += 1;
    }
    return Array.from(m.entries()).map(([d, v]) => ({
      dept: d,
      ...v,
      color: DEPT_COLORS[d] ?? DEPT_FALLBACK,
    }));
  }, [lines, inputs, buCustomers]);

  const globalTotal = allByDept.reduce((s, d) => s + d.total, 0);

  // A escrita mora no serverFn (chave de conflito, default de prioridade,
  // departamento derivado do perfil) — a tela só informa a célula e o valor.
  const saveValue = async (
    line_code: string,
    customer_id: string,
    value: number | null,
    priority: string,
  ) => {
    setBusy(`${line_code}:${customer_id}`);
    try {
      await saveLineInput({
        data: { lineCode: line_code, customerId: customer_id, bu, value, priority, referenceDate },
      });
      const { data: ins } = await supabase
        .from("line_inputs")
        .select("line_code,customer_id,value,priority,department,ai_extraction")
        .eq("reference_date", referenceDate);
      setInputs(ins || []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível salvar o input.");
    }
    setBusy(null);
  };

  const uploadAndExtract = async (file: File, line: Line) => {
    setBusy(`upload:${line.code}`);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      alert("Sessão expirada");
      setBusy(null);
      return;
    }
    const path = `${u.user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("inputs").upload(path, file);
    if (upErr) {
      alert(upErr.message);
      setBusy(null);
      return;
    }
    // Parse XLSX/CSV/TXT to plain text (then send to AI)
    const text = await fileToText(file);
    const customerList = buCustomers.map((c) => ({ id: c.id, name: c.customer_name }));
    const { data, error } = await supabase.functions.invoke("extract-inputs", {
      body: {
        fileName: file.name,
        content: text.slice(0, 8000),
        lineLabel: line.label,
        lineCode: line.code,
        customers: customerList,
      },
    });
    if (error) {
      alert(`AI: ${error.message}`);
      setBusy(null);
      return;
    }
    const extracted: Array<{ customer_id: string; value: number }> = data?.matches || [];
    if (extracted.length) {
      try {
        await saveExtractedLineInputs({
          data: { lineCode: line.code, bu, referenceDate, filePath: path, matches: extracted },
        });
      } catch (e) {
        alert(e instanceof Error ? e.message : "Falha ao salvar os valores extraídos.");
      }
    }
    const { data: ins } = await supabase
      .from("line_inputs")
      .select("line_code,customer_id,value,priority,department,ai_extraction")
      .eq("reference_date", referenceDate);
    setInputs(ins || []);
    setBusy(null);
  };

  if (!dept) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Defina seu departamento no cadastro para começar.</p>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-8">
      <div>
        <p className="eyebrow">INPUTS</p>
        <h1 className="font-display text-4xl text-primary mt-2">Departamento: {dept}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Você vê e edita apenas as linhas do seu departamento. Outros departamentos veem totais
          agregados.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="inline-flex border border-border">
          {bus.map((b) => (
            <button
              key={b.code}
              onClick={() => setBu(b.code)}
              className={`px-6 py-2 text-xs uppercase tracking-[0.18em] font-semibold ${bu === b.code ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-secondary"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-[10px]">Período de referência</span>
          <input
            type="month"
            value={referenceMonth}
            onChange={(e) => setReferenceMonth(e.target.value)}
            className="border border-border bg-transparent px-3 py-2 text-xs min-w-[160px] font-mono"
          />
        </div>
      </div>

      {/* Progress: dept */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="eyebrow">PROGRESSO · {dept}</p>
          <span className="text-sm font-mono">
            {myFilled} / {myTotal}
          </span>
        </div>
        <div className="h-3 bg-secondary border border-border">
          <div
            className="h-full bg-primary"
            style={{ width: myTotal ? `${(myFilled / myTotal) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Progress: global stacked by dept */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="eyebrow">PROGRESSO GLOBAL · POR DEPTO</p>
          <span className="text-sm font-mono">
            {allByDept.reduce((s, d) => s + d.filled, 0)} / {globalTotal}
          </span>
        </div>
        <div className="flex h-6 border border-border overflow-hidden">
          {allByDept.map((d) => (
            <div
              key={d.dept}
              title={`${d.dept}: ${d.filled}/${d.total}`}
              style={{
                width: globalTotal ? `${(d.total / globalTotal) * 100}%` : "0%",
                background: `${d.color}33`,
              }}
              className="relative"
            >
              <div
                style={{
                  width: d.total ? `${(d.filled / d.total) * 100}%` : "0%",
                  background: d.color,
                }}
                className="h-full"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {allByDept.map((d) => (
            <span key={d.dept} className="inline-flex items-center gap-2">
              <span className="w-3 h-3" style={{ background: d.color }} /> {d.dept} · {d.filled}/
              {d.total}
            </span>
          ))}
        </div>
      </div>

      {/* Lines × Customers */}
      {myLines.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma linha do waterfall está atribuída ao seu departamento ainda.
        </p>
      )}
      {buCustomers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Cadastre clientes em /clientes para começar a preencher.
        </p>
      )}
      <div className="space-y-6">
        {myLines.map((l) => (
          <div key={l.code} className="bg-card border border-border">
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-mono text-muted-foreground">#{l.code}</p>
                <h3 className="font-display text-lg text-primary mt-1">{l.label}</h3>
                <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground mt-3 max-w-3xl">
                  <span>
                    <b className="text-foreground">P1:</b> {l.p1_desc}
                  </span>
                  <span>
                    <b className="text-foreground">P2:</b> {l.p2_desc}
                  </span>
                  <span>
                    <b className="text-foreground">P3:</b> {l.p3_desc}
                  </span>
                </div>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-2 bg-secondary px-4 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:bg-primary hover:text-primary-foreground">
                {busy === `upload:${l.code}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload + IA
                <input
                  type="file"
                  hidden
                  accept=".csv,.txt,.xlsx,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAndExtract(f, l);
                  }}
                />
              </label>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="text-left px-6 py-2">Cliente</th>
                  <th className="text-left px-6 py-2 w-32">Prioridade</th>
                  <th className="text-right px-6 py-2 w-48">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {buCustomers.map((c) => {
                  const row = inputs.find((i) => i.line_code === l.code && i.customer_id === c.id);
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-6 py-2">{c.customer_name}</td>
                      <td className="px-6 py-2">
                        <select
                          defaultValue={row?.priority || "P1"}
                          className="bg-transparent border border-border px-2 py-1 text-xs"
                          onChange={(e) =>
                            saveValue(l.code, c.id, row?.value ?? null, e.target.value)
                          }
                        >
                          <option>P1</option>
                          <option>P2</option>
                          <option>P3</option>
                          <option>MANUAL</option>
                          <option>RATEIO</option>
                        </select>
                      </td>
                      <td className="px-6 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ConfidenceBadge ext={row?.ai_extraction} />
                          <input
                            type="number"
                            defaultValue={row?.value ?? ""}
                            placeholder="0"
                            className="w-40 bg-transparent border-b border-border focus:border-primary focus:outline-none py-1 text-right font-mono"
                            onBlur={(e) => {
                              const v = e.target.value === "" ? null : Number(e.target.value);
                              saveValue(l.code, c.id, v, row?.priority || "P1");
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(() => {
              const subs = subsByMain.get(l.main_no ?? -1) || [];
              if (subs.length === 0) return null;
              const isOpen = !!expanded[l.code];
              return (
                <div className="border-t border-border">
                  <button
                    onClick={() => setExpanded((s) => ({ ...s, [l.code]: !isOpen }))}
                    className="w-full px-6 py-3 text-left text-xs uppercase tracking-[0.18em] font-semibold hover:bg-secondary/40 flex items-center justify-between"
                  >
                    <span>
                      {isOpen ? "▾" : "▸"} Sublinhas ({subs.length}) · entrada manual
                    </span>
                    <span className="text-muted-foreground normal-case tracking-normal">
                      Use as sublinhas para detalhar a linha #{l.code}, ou preencha só o total
                      acima.
                    </span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-border">
                      {subs.map((s) => (
                        <div key={s.code} className="px-6 py-4">
                          <div className="flex items-baseline gap-3 mb-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{s.code}
                            </span>
                            <span className="text-sm text-foreground">{s.label}</span>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {buCustomers.map((c) => {
                                const row = inputs.find(
                                  (i) => i.line_code === s.code && i.customer_id === c.id,
                                );
                                return (
                                  <tr key={c.id} className="border-t border-border/60">
                                    <td className="px-2 py-1.5">{c.customer_name}</td>
                                    <td className="px-2 py-1.5 w-32">
                                      <select
                                        defaultValue={row?.priority || "P1"}
                                        className="bg-transparent border border-border px-2 py-1 text-xs"
                                        onChange={(e) =>
                                          saveValue(
                                            s.code,
                                            c.id,
                                            row?.value ?? null,
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option>P1</option>
                                        <option>P2</option>
                                        <option>P3</option>
                                        <option>MANUAL</option>
                                        <option>RATEIO</option>
                                      </select>
                                    </td>
                                    <td className="px-2 py-1.5 text-right w-48">
                                      <div className="flex items-center justify-end gap-2">
                                        <ConfidenceBadge ext={row?.ai_extraction} />
                                        <input
                                          type="number"
                                          defaultValue={row?.value ?? ""}
                                          placeholder="0"
                                          className="w-32 bg-transparent border-b border-border focus:border-primary focus:outline-none py-1 text-right font-mono"
                                          onBlur={(e) => {
                                            const v =
                                              e.target.value === "" ? null : Number(e.target.value);
                                            saveValue(s.code, c.id, v, row?.priority || "P1");
                                          }}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceBadge({ ext }: { ext: any }) {
  const c = typeof ext?.confidence === "number" ? ext.confidence : null;
  if (c === null) return null;
  if (c < 0.7) {
    return (
      <span
        title={`Confiança da IA: ${(c * 100).toFixed(0)}%`}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-semibold pill-outflow border border-[var(--cascata-outflow)]/30"
      >
        Revisar · {(c * 100).toFixed(0)}%
      </span>
    );
  }
  return (
    <span
      title={`Confiança da IA: ${(c * 100).toFixed(0)}%`}
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
    >
      {(c * 100).toFixed(0)}%
    </span>
  );
}
