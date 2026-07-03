import { describe, it, expect } from "vitest";
import {
  LINE_INPUT_CONFLICT_KEY,
  SaveExtractedInputsSchema,
  SaveLineInputSchema,
  toExtractedInputRows,
  toLineInputRow,
} from "./line-input-write";

const UUID = "3f0f4bb4-3ea6-4d09-9f6f-1a9a3e6a2b01";

describe("SaveLineInputSchema — as regras que antes moravam na tela (A6)", () => {
  it("priority tem default 'P1' — a tela não precisa saber disso", () => {
    const parsed = SaveLineInputSchema.parse({
      lineCode: "7",
      customerId: UUID,
      bu: "B2B",
      value: 1234.56,
      referenceDate: "2026-07-01",
    });
    expect(parsed.priority).toBe("P1");
  });

  it("aceita value nulo (limpar a célula) e prioridades do domínio", () => {
    const parsed = SaveLineInputSchema.parse({
      lineCode: "7",
      customerId: UUID,
      bu: "B2B",
      value: null,
      priority: "RATEIO",
      referenceDate: "2026-07-01",
    });
    expect(parsed.value).toBeNull();
    expect(parsed.priority).toBe("RATEIO");
  });

  it("rejeita prioridade fora do domínio e data fora do formato", () => {
    const base = { lineCode: "7", customerId: UUID, bu: "B2B", value: 1 };
    expect(() =>
      SaveLineInputSchema.parse({ ...base, priority: "P9", referenceDate: "2026-07-01" }),
    ).toThrow();
    expect(() => SaveLineInputSchema.parse({ ...base, referenceDate: "2026-7-1" })).toThrow();
  });
});

describe("toLineInputRow / toExtractedInputRows", () => {
  it("mapeia camelCase → colunas e injeta o departamento resolvido no servidor", () => {
    const row = toLineInputRow(
      SaveLineInputSchema.parse({
        lineCode: "12",
        customerId: UUID,
        bu: "B2C",
        value: 99,
        referenceDate: "2026-07-01",
      }),
      "Comercial",
    );
    expect(row).toEqual({
      line_code: "12",
      customer_id: UUID,
      bu: "B2C",
      department: "Comercial",
      value: 99,
      priority: "P1",
      reference_date: "2026-07-01",
    });
    expect(LINE_INPUT_CONFLICT_KEY).toBe("line_code,customer_id,bu,reference_date");
  });

  it("extração da IA: uma linha por match, sempre P1, guardando file_path e o match cru", () => {
    const data = SaveExtractedInputsSchema.parse({
      lineCode: "3",
      bu: "B2B",
      referenceDate: "2026-07-01",
      filePath: "user-1/planilha.xlsx",
      matches: [
        { customer_id: UUID, value: 10 },
        { customer_id: "9b2a6c1e-5f30-4a88-b7c5-2d4e8f0a1b2c", value: 20 },
      ],
    });
    const rows = toExtractedInputRows(data, "Fiscal");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line_code: "3",
      customer_id: UUID,
      department: "Fiscal",
      value: 10,
      priority: "P1",
      file_path: "user-1/planilha.xlsx",
      reference_date: "2026-07-01",
    });
    expect(rows[0].ai_extraction).toEqual({ customer_id: UUID, value: 10 });
  });

  it("rejeita lote vazio de matches", () => {
    expect(() =>
      SaveExtractedInputsSchema.parse({
        lineCode: "3",
        bu: "B2B",
        referenceDate: "2026-07-01",
        filePath: "p",
        matches: [],
      }),
    ).toThrow();
  });
});
