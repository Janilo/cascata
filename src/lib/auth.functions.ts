import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AppError } from "@/lib/app-error";

export const enterAsGuestFn = createServerFn({ method: "POST" }).handler(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.GUEST_EMAIL;
  const password = process.env.GUEST_PASSWORD;

  if (!url || !key) throw new AppError("CONFIG_ERROR", "Supabase env vars not configured");
  if (!email || !password)
    throw new AppError("CONFIG_ERROR", "GUEST_EMAIL / GUEST_PASSWORD env vars not configured");

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new AppError("AUTH_ERROR", error.message, 401);

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
});
