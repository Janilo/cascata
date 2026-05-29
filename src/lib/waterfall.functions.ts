// Server fns: authenticated wrapper + public share-token endpoint.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeWaterfall } from "./waterfall-core";

const Input = z.object({
  bu: z.string().min(1).max(64),
  department: z.string().optional(),
  leader: z.string().optional(),
  account: z.string().optional(),
  customerId: z.string().optional(),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const getWaterfall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const { subTotalsByCode: _s, ...rest } = await computeWaterfall(data);
    void _s;
    return rest; // includes totalsByCode, lines, salaryTotal, inputsCount
  });

const TokenInput = z.object({ token: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/) });

export const getSharedWaterfall = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenInput.parse(d))
  .handler(async ({ data }) => {
    const { data: link, error } = await supabaseAdmin
      .from("shared_links")
      .select("bu,reference_date,expires_at,label")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !link) throw new Error("Link inválido");
    if (new Date(link.expires_at).getTime() < Date.now()) throw new Error("Link expirado");

    const wf = await computeWaterfall({
      bu: link.bu,
      referenceDate: link.reference_date || undefined,
    });
    return {
      bu: link.bu,
      referenceDate: link.reference_date,
      expiresAt: link.expires_at,
      label: link.label,
      totalsByCode: wf.totalsByCode,
      subTotalsByCode: wf.subTotalsByCode,
      lines: wf.lines,
    };
  });

const CreateShareInput = z.object({
  bu: z.string().min(1).max(64),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  label: z.string().max(120).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const createSharedLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateShareInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // 24-char URL-safe random token
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 3600 * 1000).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("shared_links")
      .insert({
        token, bu: data.bu, reference_date: data.referenceDate ?? null,
        label: data.label ?? null, expires_at: expiresAt, created_by: userId,
      })
      .select("token,expires_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listSharedLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("shared_links")
      .select("id,token,bu,reference_date,expires_at,label,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  });

export const revokeSharedLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("shared_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
