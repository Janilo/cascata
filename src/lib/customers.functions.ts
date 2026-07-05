// Server fns for customers writes (A6): Zod na fronteira + re-checagem de
// aprovação. Writes use the CALLER's client so the "admin OR own row" RLS
// stays in force; created_by is set explicitly to the caller (the column has
// no DB default, and the delete-own policy depends on it).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError } from "./errors";
import { AddCustomersSchema, toCustomerRow } from "./customer-write";
import { requireApprovedUser } from "./require-approved";

export const addCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AddCustomersSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireApprovedUser(context.userId);

    // Per row, like the old screen loop: one rejected row doesn't drop the rest.
    let inserted = 0;
    const failed: string[] = [];
    for (const customer of data.customers) {
      const { error } = await context.supabase
        .from("customers")
        .insert(toCustomerRow(customer, context.userId));
      if (error) {
        console.error("addCustomers row failed", { error, customer: customer.customerName });
        failed.push(customer.customerName);
      } else {
        inserted++;
      }
    }
    return { inserted, failed };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireApprovedUser(context.userId);
    const { error } = await context.supabase.from("customers").delete().eq("id", data.id);
    if (error) {
      console.error("deleteCustomer failed", { error, id: data.id });
      throw new AppError("Não foi possível excluir o cliente.", 500, "DB_ERROR");
    }
    return { ok: true as const };
  });
