import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { fileName, content } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const sys = `Extract a list of customer records from this file. Each record may include: account_id, account_name, customer_name (required), cnpj, bu (B2B or B2C). Return only via the tool.`;
    const user = `File: ${fileName}\n\n${content}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        tools: [{
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
                      bu: { type: "string", enum: ["B2B","B2C"] },
                    },
                    required: ["customer_name"],
                  },
                },
              },
              required: ["customers"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_customers" } },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: t }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { customers: [] };
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
