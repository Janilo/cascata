import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/")({
  component: WaterfallApp,
});

type StepKind = "anchor" | "deduction" | "addition" | "subtotal";

type Step = {
  id: string;
  label: string;
  kind: StepKind;
  // for anchor: absolute value (price per unit or total)
  // for deduction/addition: amount (positive number); applied as -/+ to running total
  // subtotal: computed
  value: number;
};

type Customer = {
  id: string;
  name: string;
  volume: number;
  steps: Step[];
};

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultSteps = (): Step[] => [
  { id: uid(), label: "List Price", kind: "anchor", value: 100 },
  { id: uid(), label: "Desconto de Tabela", kind: "deduction", value: 8 },
  { id: uid(), label: "Desconto por Volume", kind: "deduction", value: 5 },
  { id: uid(), label: "Invoice Price", kind: "subtotal", value: 0 },
  { id: uid(), label: "Promoções", kind: "deduction", value: 4 },
  { id: uid(), label: "Rebates", kind: "deduction", value: 3 },
  { id: uid(), label: "Net Price", kind: "subtotal", value: 0 },
  { id: uid(), label: "COGS", kind: "deduction", value: 55 },
  { id: uid(), label: "Gross Margin", kind: "subtotal", value: 0 },
  { id: uid(), label: "Frete", kind: "deduction", value: 3 },
  { id: uid(), label: "Armazenagem", kind: "deduction", value: 1.5 },
  { id: uid(), label: "Comissão de Vendas", kind: "deduction", value: 2 },
  { id: uid(), label: "Atendimento ao Cliente", kind: "deduction", value: 1 },
  { id: uid(), label: "Pocket Margin", kind: "subtotal", value: 0 },
];

const defaultCustomers = (): Customer[] => [
  { id: uid(), name: "Cliente A — Grande Varejo", volume: 1000, steps: defaultSteps() },
  {
    id: uid(),
    name: "Cliente B — Distribuidor",
    volume: 500,
    steps: defaultSteps().map((s) =>
      s.label === "Desconto por Volume"
        ? { ...s, value: 10 }
        : s.label === "Atendimento ao Cliente"
          ? { ...s, value: 2.5 }
          : s,
    ),
  },
];

function computeRunning(steps: Step[]) {
  let running = 0;
  return steps.map((s) => {
    if (s.kind === "anchor") {
      running = s.value;
      return { ...s, running, delta: s.value };
    }
    if (s.kind === "subtotal") {
      return { ...s, running, delta: running };
    }
    const delta = s.kind === "deduction" ? -s.value : s.value;
    running = running + delta;
    return { ...s, running, delta };
  });
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtUnit = (n: number) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function WaterfallApp() {
  const [customers, setCustomers] = useState<Customer[]>(defaultCustomers);
  const [selectedId, setSelectedId] = useState<string>(() => defaultCustomers()[0].id);
  const [view, setView] = useState<"unit" | "total">("unit");

  const selected =
    customers.find((c) => c.id === selectedId) ?? customers[0];

  const computed = useMemo(() => computeRunning(selected.steps), [selected.steps]);
  const multiplier = view === "total" ? selected.volume : 1;

  const chartData = computed.map((s, idx) => {
    const value = s.running * multiplier;
    const delta = s.delta * multiplier;
    if (s.kind === "anchor" || s.kind === "subtotal") {
      return {
        name: s.label,
        base: 0,
        bar: value,
        kind: s.kind,
        display: value,
        idx,
      };
    }
    // floating bar: from prev running to current running
    const prev = (computed[idx - 1]?.running ?? 0) * multiplier;
    const curr = value;
    const base = Math.min(prev, curr);
    const bar = Math.abs(curr - prev);
    return {
      name: s.label,
      base,
      bar,
      kind: s.kind,
      display: delta,
      idx,
    };
  });

  const colorFor = (kind: string) => {
    if (kind === "anchor") return "var(--color-chart-3)";
    if (kind === "subtotal") return "var(--color-primary)";
    if (kind === "deduction") return "var(--color-destructive)";
    return "var(--color-chart-2)";
  };

  const updateStep = (id: string, patch: Partial<Step>) => {
    setCustomers((cs) =>
      cs.map((c) =>
        c.id !== selected.id
          ? c
          : { ...c, steps: c.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) },
      ),
    );
  };

  const addStep = () => {
    setCustomers((cs) =>
      cs.map((c) =>
        c.id !== selected.id
          ? c
          : {
              ...c,
              steps: [
                ...c.steps.slice(0, c.steps.length - 1),
                { id: uid(), label: "Novo componente", kind: "deduction", value: 0 },
                c.steps[c.steps.length - 1],
              ],
            },
      ),
    );
  };

  const removeStep = (id: string) => {
    setCustomers((cs) =>
      cs.map((c) =>
        c.id !== selected.id ? c : { ...c, steps: c.steps.filter((s) => s.id !== id) },
      ),
    );
  };

  const addCustomer = () => {
    const c: Customer = {
      id: uid(),
      name: `Novo Cliente ${customers.length + 1}`,
      volume: 100,
      steps: defaultSteps(),
    };
    setCustomers((cs) => [...cs, c]);
    setSelectedId(c.id);
  };

  const updateCustomer = (patch: Partial<Customer>) => {
    setCustomers((cs) => cs.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)));
  };

  const removeCustomer = () => {
    if (customers.length <= 1) return;
    const remaining = customers.filter((c) => c.id !== selected.id);
    setCustomers(remaining);
    setSelectedId(remaining[0].id);
  };

  const listPrice = computed[0]?.running ?? 0;
  const pocket = computed[computed.length - 1]?.running ?? 0;
  const pocketPct = listPrice > 0 ? (pocket / listPrice) * 100 : 0;
  const totalPocket = pocket * selected.volume;

  // Cross-customer comparison
  const comparison = customers.map((c) => {
    const comp = computeRunning(c.steps);
    const lp = comp[0]?.running ?? 0;
    const pm = comp[comp.length - 1]?.running ?? 0;
    return {
      name: c.name,
      volume: c.volume,
      listPrice: lp,
      pocket: pm,
      pocketPct: lp > 0 ? (pm / lp) * 100 : 0,
      totalPocket: pm * c.volume,
    };
  });

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push(["Cliente", "Volume", "Etapa", "Tipo", "Valor unitário", "Acumulado unitário"].join(","));
    customers.forEach((c) => {
      const comp = computeRunning(c.steps);
      comp.forEach((s) => {
        rows.push(
          [
            `"${c.name}"`,
            c.volume,
            `"${s.label}"`,
            s.kind,
            s.delta.toFixed(2),
            s.running.toFixed(2),
          ].join(","),
        );
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "price-waterfall.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Price Waterfall</h1>
            <p className="text-sm text-muted-foreground">
              Da lista de preços ao pocket margin — incluindo custo de servir por cliente.
            </p>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
            <CardDescription>
              Selecione um cliente, ajuste o volume e os componentes do waterfall.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-4">
                <Label className="mb-2 block">Cliente</Label>
                <Select value={selected.id} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-4">
                <Label className="mb-2 block">Nome</Label>
                <Input
                  value={selected.name}
                  onChange={(e) => updateCustomer({ name: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-2 block">Volume (un.)</Label>
                <Input
                  type="number"
                  value={selected.volume}
                  onChange={(e) =>
                    updateCustomer({ volume: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button variant="outline" onClick={addCustomer} className="flex-1">
                  <Plus className="mr-1 h-4 w-4" /> Novo
                </Button>
                <Button
                  variant="ghost"
                  onClick={removeCustomer}
                  disabled={customers.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="List Price (un.)" value={fmt(listPrice)} />
          <KPI label="Pocket Margin (un.)" value={fmt(pocket)} accent />
          <KPI label="Pocket %" value={`${pocketPct.toFixed(1)}%`} />
          <KPI label="Pocket Total" value={fmt(totalPocket)} />
        </div>

        {/* Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Waterfall</CardTitle>
              <CardDescription>
                Visualização cascata — barras vermelhas reduzem, azuis somam, subtotais em destaque.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={view === "unit" ? "default" : "outline"}
                onClick={() => setView("unit")}
              >
                Por unidade
              </Button>
              <Button
                size="sm"
                variant={view === "total" ? "default" : "outline"}
                onClick={() => setView("total")}
              >
                Total
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[460px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 30, right: 16, left: 8, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tickFormatter={(v) => fmtUnit(Number(v))} width={80} />
                  <Tooltip
                    formatter={(_v, _n, item) => {
                      const d = item?.payload as { display: number; kind: string };
                      const prefix =
                        d.kind === "deduction" ? "−" : d.kind === "addition" ? "+" : "";
                      return [`${prefix}${fmt(Math.abs(d.display))}`, "Valor"];
                    }}
                  />
                  <Bar dataKey="base" stackId="a" fill="transparent" />
                  <Bar dataKey="bar" stackId="a" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={colorFor(d.kind)} />
                    ))}
                    <LabelList
                      dataKey="display"
                      position="top"
                      formatter={(v: number) => fmtUnit(Math.abs(v))}
                      style={{ fontSize: 11, fill: "var(--color-foreground)" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Editor + Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Componentes</CardTitle>
                <CardDescription>Edite valores e tipos de cada etapa.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selected.steps.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-12 gap-2 items-center"
                  >
                    <Input
                      className="col-span-5"
                      value={s.label}
                      onChange={(e) => updateStep(s.id, { label: e.target.value })}
                    />
                    <Select
                      value={s.kind}
                      onValueChange={(v) => updateStep(s.id, { kind: v as StepKind })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anchor">Âncora</SelectItem>
                        <SelectItem value="deduction">Redução (−)</SelectItem>
                        <SelectItem value="addition">Adição (+)</SelectItem>
                        <SelectItem value="subtotal">Subtotal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="col-span-3"
                      type="number"
                      step="0.01"
                      value={s.kind === "subtotal" ? "" : s.value}
                      disabled={s.kind === "subtotal"}
                      onChange={(e) =>
                        updateStep(s.id, { value: Number(e.target.value) || 0 })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeStep(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento</CardTitle>
              <CardDescription>
                Acumulado e % do List Price em cada etapa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Δ unit.</TableHead>
                    <TableHead className="text-right">Acumulado</TableHead>
                    <TableHead className="text-right">% List</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computed.map((s) => {
                    const pct = listPrice > 0 ? (s.running / listPrice) * 100 : 0;
                    const isSubtotal = s.kind === "subtotal" || s.kind === "anchor";
                    return (
                      <TableRow key={s.id} className={isSubtotal ? "font-semibold" : ""}>
                        <TableCell>{s.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.kind === "subtotal"
                            ? "—"
                            : s.kind === "anchor"
                              ? fmt(s.value)
                              : `${s.kind === "deduction" ? "−" : "+"}${fmt(Math.abs(s.value))}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(s.running)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Comparação entre clientes</CardTitle>
            <CardDescription>
              Pocket margin por cliente, considerando custo de servir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">List Price</TableHead>
                  <TableHead className="text-right">Pocket / un.</TableHead>
                  <TableHead className="text-right">Pocket %</TableHead>
                  <TableHead className="text-right">Pocket Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.volume.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(c.listPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(c.pocket)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.pocketPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmt(c.totalPocket)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
