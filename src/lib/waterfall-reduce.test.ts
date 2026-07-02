import { describe, it, expect } from "vitest";
import {
  reduceWaterfall,
  bestByCell,
  findPersonnelLine,
  computeRevenueByCustomer,
  type Customer,
  type LineInput,
  type OrgNode,
  type WaterfallLine,
} from "./waterfall-reduce";

// Minimal chart of accounts: one revenue line, one personnel (cost) line.
const LINES: WaterfallLine[] = [
  { code: "1", kind: "main", bucket: "revenue", label: "Receita" },
  { code: "9", kind: "main", bucket: "cost", label: "Pessoal" },
];

function customer(id: string, name: string): Customer {
  return {
    id,
    customer_name: name,
    account_id: null,
    account_name: null,
    attrs: {},
    bu: "BU1",
  };
}

function node(customerName: string | null, salary: number): OrgNode {
  return {
    bu: "BU1",
    department: null,
    leader: null,
    channel: null,
    account: null,
    customer: customerName,
    salary,
  };
}

describe("reduceWaterfall — priority dedupe", () => {
  it("keeps the highest-priority value per (line, customer): P1 > P2 > P3", () => {
    const inputs: LineInput[] = [
      { line_code: "1", customer_id: "c1", value: 100, priority: "P2" },
      { line_code: "1", customer_id: "c1", value: 999, priority: "P1" },
      { line_code: "1", customer_id: "c2", value: 5, priority: "P3" },
      { line_code: "1", customer_id: "c2", value: 50, priority: "P2" },
    ];
    const r = reduceWaterfall(inputs, LINES, [], [customer("c1", "A"), customer("c2", "B")], {});
    // c1 → P1 (999), c2 → P2 (50); line total sums the winners.
    expect(r.totalsByCode["1"]).toBe(999 + 50);
  });
});

describe("reduceWaterfall — revenue-weighted personnel allocation", () => {
  it("adds the full salary to the personnel line when the node's customers have revenue", () => {
    const inputs: LineInput[] = [
      { line_code: "1", customer_id: "c1", value: 1000, priority: "P1" },
    ];
    const r = reduceWaterfall(inputs, LINES, [node("Alpha", 500)], [customer("c1", "Alpha")], {});
    expect(r.totalsByCode["1"]).toBe(1000);
    expect(r.totalsByCode["9"]).toBe(500);
    expect(r.salaryTotal).toBe(500);
  });

  it("weightSum === 0 (matched customers, zero revenue) still charges the full salary", () => {
    // No revenue input → revenueByCustomer is empty → weightSum 0 → each*len === salary.
    const r = reduceWaterfall([], LINES, [node("Alpha", 500)], [customer("c1", "Alpha")], {});
    expect(r.totalsByCode["9"]).toBe(500);
    expect(r.salaryTotal).toBe(500);
  });

  it("charges the salary as unallocated when the node matches no customer", () => {
    const inputs: LineInput[] = [
      { line_code: "1", customer_id: "c1", value: 1000, priority: "P1" },
    ];
    const r = reduceWaterfall(inputs, LINES, [node("Ghost", 500)], [customer("c1", "Alpha")], {});
    expect(r.totalsByCode["9"]).toBe(500);
    expect(r.salaryTotal).toBe(500);
  });

  it("does not allocate salaries when customers is null (query failure path)", () => {
    const r = reduceWaterfall([], LINES, [node("Alpha", 500)], null, {});
    expect(r.totalsByCode["9"]).toBeUndefined();
    expect(r.salaryTotal).toBe(0);
  });
});

describe("reduceWaterfall — filters and subtotals", () => {
  it("drops inputs whose department differs from the requested one", () => {
    const inputs: LineInput[] = [
      { line_code: "1", customer_id: "c1", value: 100, priority: "P1", department: "Vendas" },
    ];
    const r = reduceWaterfall(inputs, LINES, [], [customer("c1", "A")], { department: "Fiscal" });
    expect(r.totalsByCode["1"]).toBeUndefined();
  });

  it("accumulates 7.* sublines into subTotalsByCode", () => {
    const inputs: LineInput[] = [
      { line_code: "7.1", customer_id: "c1", value: 30, priority: "P1" },
      { line_code: "7.1", customer_id: "c2", value: 20, priority: "P1" },
      { line_code: "7.2", customer_id: "c1", value: 5, priority: "P1" },
    ];
    const r = reduceWaterfall(inputs, LINES, [], [customer("c1", "A"), customer("c2", "B")], {});
    expect(r.subTotalsByCode["7.1"]).toBe(50);
    expect(r.subTotalsByCode["7.2"]).toBe(5);
  });
});

// The shared primitives that custo-de-servir and the waterfall both build on
// (extracted so there is one implementation, not two — see cost-to-serve.functions.ts).
describe("bestByCell — shared priority dedupe", () => {
  it("keeps the highest-priority value per (line, customer) and skips null values", () => {
    const inputs: LineInput[] = [
      { line_code: "1", customer_id: "c1", value: 100, priority: "P2" },
      { line_code: "1", customer_id: "c1", value: 999, priority: "P1" },
      { line_code: "1", customer_id: "c1", value: null, priority: "P1" },
      { line_code: "2", customer_id: "c1", value: 5, priority: "RATEIO" },
    ];
    const best = bestByCell(inputs);
    expect(best.get("1__c1")?.value).toBe(999);
    expect(best.get("2__c1")?.value).toBe(5);
    expect(best.size).toBe(2);
  });

  it("honours the keep predicate (scoping by department/customer)", () => {
    const inputs: LineInput[] = [
      { line_code: "1", customer_id: "c1", value: 10, priority: "P1", department: "Vendas" },
      { line_code: "1", customer_id: "c2", value: 20, priority: "P1", department: "Fiscal" },
    ];
    const best = bestByCell(inputs, (r) => r.department === "Vendas");
    expect(best.has("1__c1")).toBe(true);
    expect(best.has("1__c2")).toBe(false);
  });
});

describe("findPersonnelLine", () => {
  it("prefers the main line labelled 'pessoal'", () => {
    const lines: WaterfallLine[] = [
      { code: "9", kind: "main", bucket: "cost", label: "Infra" },
      { code: "12", kind: "main", bucket: "cost", label: "Custo de Pessoal" },
    ];
    expect(findPersonnelLine(lines)).toBe("12");
  });

  it("falls back to the first main cost line when none is named 'pessoal'", () => {
    const lines: WaterfallLine[] = [
      { code: "1", kind: "main", bucket: "revenue", label: "Receita" },
      { code: "9", kind: "main", bucket: "cost", label: "Infra" },
      { code: "10", kind: "main", bucket: "cost", label: "Outro" },
    ];
    expect(findPersonnelLine(lines)).toBe("9");
  });
});

describe("computeRevenueByCustomer", () => {
  it("sums only revenue-line winners, per customer", () => {
    const best = bestByCell([
      { line_code: "1", customer_id: "c1", value: 100, priority: "P1" },
      { line_code: "1", customer_id: "c2", value: 40, priority: "P1" },
      { line_code: "9", customer_id: "c1", value: 30, priority: "P1" }, // cost line — ignored
    ]);
    const rev = computeRevenueByCustomer(best, new Set(["1"]));
    expect(rev.get("c1")).toBe(100);
    expect(rev.get("c2")).toBe(40);
    expect(rev.has("9")).toBe(false);
  });
});
