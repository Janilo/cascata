import { describe, it, expect } from "vitest";
import { AddCustomersSchema, CustomerInputSchema, toCustomerRow } from "./customer-write";

describe("CustomerInputSchema / toCustomerRow (A6)", () => {
  it("nome é obrigatório e vem trimado; campos vazios viram null", () => {
    expect(() => CustomerInputSchema.parse({ customerName: "  ", bu: "B2B" })).toThrow();

    const row = toCustomerRow(
      CustomerInputSchema.parse({
        customerName: "  Acme LTDA  ",
        accountId: "",
        accountName: null,
        cnpj: "",
        bu: "B2B",
      }),
      "user-1",
    );
    expect(row).toEqual({
      customer_name: "Acme LTDA",
      account_id: null,
      account_name: null,
      cnpj: null,
      bu: "B2B",
      created_by: "user-1",
    });
  });

  it("created_by é sempre o chamador — a policy 'admin OU dono da linha' depende disso", () => {
    const row = toCustomerRow({ customerName: "Beta", bu: "B2C" }, "user-9");
    expect(row.created_by).toBe("user-9");
  });

  it("lote: exige ao menos 1 cliente", () => {
    expect(() => AddCustomersSchema.parse({ customers: [] })).toThrow();
    expect(
      AddCustomersSchema.parse({ customers: [{ customerName: "A", bu: "B2B" }] }).customers,
    ).toHaveLength(1);
  });
});
