// Server fns for line_inputs writes (A6). The screens stop knowing the
// conflict key and the priority default; approval is re-checked server-side.
// Writes go through the CALLER's client (context.supabase), NOT supabaseAdmin,
// on purpose: the department-scoped RLS policies and the line_inputs_audit
// trigger (changed_by = auth.uid()) keep working exactly as before.
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { AppError } from "./app-error";
import {
  LINE_INPUT_CONFLICT_KEY,
  SaveExtractedInputsSchema,
  SaveLineInputSchema,
  toExtractedInputRows,
  toLineInputRow,
} from "./line-input-write";
import { requireApprovedUser } from "./require-approved";

// The department a row belongs to comes from the caller's own profile — the
// same value RLS's current_department() enforces — never from the screen.
async function resolveDepartment(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.department) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Defina seu departamento no cadastro para lançar inputs.",
      400,
    );
  }
  return profile.department;
}

export const saveLineInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveLineInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireApprovedUser(context.userId);
    const department = await resolveDepartment(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("line_inputs")
      .upsert(toLineInputRow(data, department), { onConflict: LINE_INPUT_CONFLICT_KEY });
    if (error) {
      console.error("saveLineInput failed", { error, lineCode: data.lineCode });
      throw new AppError("DB_ERROR", "Não foi possível salvar o input.", 500);
    }
    return { ok: true as const };
  });

export const saveExtractedLineInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveExtractedInputsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireApprovedUser(context.userId);
    const department = await resolveDepartment(context.supabase, context.userId);

    // Per row, like the old screen loop: one bad match doesn't drop the batch.
    let saved = 0;
    for (const row of toExtractedInputRows(data, department)) {
      const { error } = await context.supabase
        .from("line_inputs")
        .upsert(row, { onConflict: LINE_INPUT_CONFLICT_KEY });
      if (error) {
        console.error("saveExtractedLineInputs row failed", {
          error,
          lineCode: row.line_code,
          customerId: row.customer_id,
        });
      } else {
        saved++;
      }
    }
    return { saved, total: data.matches.length };
  });
