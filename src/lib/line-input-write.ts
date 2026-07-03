import { z } from "zod";
import { PRIORITY_ORDER } from "./waterfall-reduce";

// Write rules for line_inputs, owned here instead of inside the screens (A6):
// the conflict key, the "P1" default and the camel→column mapping. The
// serverFns in inputs.functions.ts validate with these schemas and write via
// the CALLER's client, so the department-scoped RLS policies and the
// line_inputs_audit trigger (changed_by = auth.uid()) keep applying.

export const LINE_INPUT_CONFLICT_KEY = "line_code,customer_id,bu,reference_date";

export const SaveLineInputSchema = z.object({
  lineCode: z.string().min(1).max(8),
  customerId: z.string().uuid(),
  bu: z.string().min(1).max(64),
  value: z.number().finite().nullable(),
  priority: z.enum(PRIORITY_ORDER).default("P1"),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SaveLineInputData = z.infer<typeof SaveLineInputSchema>;

// Raw match from the extract-inputs edge function; stored verbatim in
// ai_extraction, hence the snake_case field names.
export const ExtractedMatchSchema = z.object({
  customer_id: z.string().uuid(),
  value: z.number().finite(),
});

export const SaveExtractedInputsSchema = z.object({
  lineCode: z.string().min(1).max(8),
  bu: z.string().min(1).max(64),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filePath: z.string().min(1).max(512),
  matches: z.array(ExtractedMatchSchema).min(1).max(1000),
});
export type SaveExtractedInputsData = z.infer<typeof SaveExtractedInputsSchema>;

export function toLineInputRow(data: SaveLineInputData, department: string) {
  return {
    line_code: data.lineCode,
    customer_id: data.customerId,
    bu: data.bu,
    department,
    value: data.value,
    priority: data.priority,
    reference_date: data.referenceDate,
  };
}

/** One row per AI match — always priority "P1", carrying file_path + ai_extraction. */
export function toExtractedInputRows(data: SaveExtractedInputsData, department: string) {
  return data.matches.map((m) => ({
    line_code: data.lineCode,
    customer_id: m.customer_id,
    bu: data.bu,
    department,
    value: m.value,
    priority: "P1" as const,
    file_path: data.filePath,
    ai_extraction: m,
    reference_date: data.referenceDate,
  }));
}
