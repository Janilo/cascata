import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(token ?? "");
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approval gate — mirrors src/lib/require-approved.ts (admin OR is_approved).
    // The serverFn side enforces this everywhere; the edge runtime must re-check it
    // too, or a logged-in but unapproved user can still burn the AI key/budget.
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("is_approved").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin && !profile?.is_approved) {
      return new Response(JSON.stringify({ error: "Forbidden: account pending approval" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileName, content } = await req.json();
    const key = Deno.env.get("AI_API_KEY");
    if (!key) throw new Error("AI_API_KEY missing");
    const aiBaseUrl =
      Deno.env.get("AI_GATEWAY_URL") ?? "https://generativelanguage.googleapis.com/v1beta/openai";

    const sys = `Extract a list of customer records from this file. Each record may include: account_id, account_name, customer_name (required), cnpj, bu (B2B or B2C). Return only via the tool.`;
    const userPrompt = `File: ${fileName}\n\n${content}`;

    const resp = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_customers",
              parameters: {
                type: "object",
                properties: {
                  customers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        account_id: { type: "string" },
                        account_name: { type: "string" },
                        customer_name: { type: "string" },
                        cnpj: { type: "string" },
                        bu: { type: "string", enum: ["B2B", "B2C"] },
                      },
                      required: ["customer_name"],
                    },
                  },
                },
                required: ["customers"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_customers" } },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: t }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { customers: [] };
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
