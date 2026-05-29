import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const enterAsGuestFn = createServerFn({ method: "POST" }).handler(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) throw new Error("Supabase env vars not configured");

  const email = process.env.GUEST_EMAIL ?? "convidado@cascata.app";
  const password = process.env.GUEST_PASSWORD ?? "cascata-demo-2026";

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
});
