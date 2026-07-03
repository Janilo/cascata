import { z } from "zod";

// Write rules for customers, owned here instead of inside the screen (A6).
// created_by is set explicitly by the serverFn (customers.functions.ts) so the
// "admin OR own row" RLS policies can attribute the row to its creator.

export const CustomerInputSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  accountId: z.string().trim().max(120).nullable().optional(),
  accountName: z.string().trim().max(200).nullable().optional(),
  cnpj: z.string().trim().max(32).nullable().optional(),
  bu: z.string().min(1).max(64),
});
export type CustomerInput = z.infer<typeof CustomerInputSchema>;

export const AddCustomersSchema = z.object({
  customers: z.array(CustomerInputSchema).min(1).max(500),
});

export function toCustomerRow(input: CustomerInput, createdBy: string) {
  return {
    customer_name: input.customerName,
    account_id: input.accountId || null,
    account_name: input.accountName || null,
    cnpj: input.cnpj || null,
    bu: input.bu,
    created_by: createdBy,
  };
}
