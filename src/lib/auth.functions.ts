import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ConfigError, UnauthorizedError } from "@/lib/errors";

export const enterAsGuestFn = createServerFn({ method: "POST" }).handler(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.GUEST_EMAIL;
  const password = process.env.GUEST_PASSWORD;

  if (!url || !key) throw new ConfigError("Supabase env vars not configured", "CONFIG_ERROR");
  if (!email || !password)
    throw new ConfigError("GUEST_EMAIL / GUEST_PASSWORD env vars not configured", "CONFIG_ERROR");

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new UnauthorizedError(error.message, "AUTH_ERROR");

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
});
