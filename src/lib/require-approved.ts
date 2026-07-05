// Server-only helper: verify the authenticated user is approved or admin.
// Throws if not. Use inside server functions that rely on supabaseAdmin
// (which bypasses RLS) to re-enforce the approval gate.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ForbiddenError } from "./errors";

export async function requireApprovedUser(userId: string): Promise<void> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("is_approved").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles || []).some((r) => r.role === "admin");
  if (!isAdmin && !profile?.is_approved) {
    throw new ForbiddenError("Forbidden: account pending approval", "FORBIDDEN_PENDING_APPROVAL");
  }
}
