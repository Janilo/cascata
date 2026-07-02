import { describe, it, expect } from "vitest";
import { computePnLKpis, PNL_CODES, PNL_LINE_GROUPS } from "./pnl";

// A representative period: values spread across every P&L bucket.
const TOTALS: Record<string, number> = {
  "1": 100,
  "2": 50,
  "3": 30,
  "4": 15,
  "5": 5, // revenue → 200
  "6": 10,
  "7": 5,
  "8": 5, // deduction → 20
  "9": 40,
  "14": 20, // cogs → 60
  "17": 30,
  "26": 10, // opex → 40
};

describe("computePnLKpis — the P&L ladder", () => {
  it("computes the full ladder from totals-by-code", () => {
    const k = computePnLKpis(TOTALS);
    expect(k.grossRevenue).toBe(200);
    expect(k.deductions).toBe(20);
    expect(k.netRevenue).toBe(180); // grossRevenue − deductions
    expect(k.cogs).toBe(60);
    expect(k.grossMargin).toBe(120); // netRevenue − cogs
    expect(k.opex).toBe(40);
    expect(k.pocket).toBe(80); // grossMargin − opex, in R$
    expect(k.pocketPct).toBeCloseTo((80 / 180) * 100, 6);
  });

  it("keeps Pocket Margin (R$) and Pocket % as distinct concepts", () => {
    // The exact regression that shipped: one screen showed pocket in R$, another
    // showed it as a %, both labelled "Pocket Margin". They are different numbers,
    // and pocketPct is strictly pocket / netRevenue.
    const k = computePnLKpis(TOTALS);
    expect(k.pocket).not.toBe(k.pocketPct);
    expect(k.pocketPct).toBeCloseTo((k.pocket / k.netRevenue) * 100, 9);
  });

  it("returns pocketPct = 0 when netRevenue is 0 (no divide-by-zero)", () => {
    const k = computePnLKpis({ "1": 50, "6": 50, "9": 10 });
    expect(k.netRevenue).toBe(0);
    expect(k.pocketPct).toBe(0);
    expect(k.grossMargin).toBe(-10);
  });

  it("sums deductions/CPV/OpEx as magnitudes (a signed row still subtracts)", () => {
    const k = computePnLKpis({ "1": 100, "6": -20 });
    expect(k.deductions).toBe(20);
    expect(k.netRevenue).toBe(80);
  });

  it("gives identical results for a Map and a Record", () => {
    const asMap = new Map(Object.entries(TOTALS));
    expect(computePnLKpis(asMap)).toEqual(computePnLKpis(TOTALS));
  });
});

describe("PNL taxonomy", () => {
  it("covers codes 1..29 exactly once across the four rolls", () => {
    const all = [
      ...PNL_CODES.revenue,
      ...PNL_CODES.deduction,
      ...PNL_CODES.cogs,
      ...PNL_CODES.opex,
    ];
    expect(new Set(all).size).toBe(all.length); // no duplicates
    const nums = all.map(Number).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
  });

  it("derives the coarse code sets from PNL_LINE_GROUPS", () => {
    const groupCodes = PNL_LINE_GROUPS.flatMap((g) => [...g.codes]);
    expect(new Set(groupCodes).size).toBe(29);
  });
});
