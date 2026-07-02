import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { fileToText } from "./file-parse";

// Build a real .xlsx in memory (SheetJS round-trips write → read) so the test
// exercises the actual XLSX.read path in fileToText, not a mock.
function xlsxFile(name: string, sheets: Record<string, unknown[][]>): File {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buf], name);
}

describe("fileToText — XLSX", () => {
  it("flattens a sheet to CSV under a labelled header", async () => {
    const file = xlsxFile("pnl.xlsx", {
      Vendas: [
        ["cliente", "valor"],
        ["Acme", 1000],
        ["Bolt", 500],
      ],
    });
    const text = await fileToText(file);
    expect(text).toContain("--- Sheet: Vendas ---");
    expect(text).toContain("cliente,valor");
    expect(text).toContain("Acme,1000");
    expect(text).toContain("Bolt,500");
  });

  it("keeps every sheet, separated by a blank line", async () => {
    const file = xlsxFile("multi.xlsx", {
      Vendas: [["a"], ["1"]],
      Custos: [["b"], ["2"]],
    });
    const text = await fileToText(file);
    expect(text).toContain("--- Sheet: Vendas ---");
    expect(text).toContain("\n\n--- Sheet: Custos ---");
  });

  it("skips blank sheets", async () => {
    const file = xlsxFile("withblank.xlsx", {
      Dados: [["x"], ["9"]],
      Vazia: [],
    });
    const text = await fileToText(file);
    expect(text).toContain("--- Sheet: Dados ---");
    expect(text).not.toContain("Vazia");
  });
});

describe("fileToText — CSV / TXT fallback", () => {
  it("returns the raw text of a .csv with no sheet markers", async () => {
    const file = new File(["cliente,valor\nAcme,1000"], "data.csv");
    const text = await fileToText(file);
    expect(text).toBe("cliente,valor\nAcme,1000");
    expect(text).not.toContain("--- Sheet:");
  });

  it("returns the raw text of a .txt", async () => {
    const file = new File(["linha 1\nlinha 2"], "notas.txt");
    expect(await fileToText(file)).toBe("linha 1\nlinha 2");
  });
});
