// Client-side owner of the "admin OR approved" access rule (A5). Three
// screens used to inline this profiles+user_roles read and the predicate;
// now one place defines who is admin and who passes the approval gate.
// Server twin (same predicate, minus the ADMIN_EMAIL bootstrap bypass):
// src/lib/require-approved.ts.
import { supabase } from "../integrations/supabase/client";
import { ADMIN_EMAIL } from "./config";

export interface AccessState {
  isAdmin: boolean;
  /** profiles.is_approved — the flag an admin flips on the Admin screen. */
  isApproved: boolean;
  /** The gate: admins enter even while their own approval flag is off. */
  canAccess: boolean;
}

export async function getAccessState(user: {
  id: string;
  email?: string | null;
}): Promise<AccessState> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("is_approved").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const isAdmin = (roles || []).some((r) => r.role === "admin") || user.email === ADMIN_EMAIL;
  const isApproved = Boolean(profile?.is_approved);
  return { isAdmin, isApproved, canAccess: isAdmin || isApproved };
}
