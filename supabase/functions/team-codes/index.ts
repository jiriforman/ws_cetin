// Public list of team codes (tokens) for the Cartel Rankings table, so players can copy
// their code into the supplier portal.
//
// NOTE: a team code is the team's only credential. Publishing it lets anyone act as that
// team (team page, negotiation chats, accepting its deal). Set the secret
// HIDE_TEAM_CODES=true to switch this off; the rankings column then disappears.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { NEGOTIATION_API_VERSION } from "../_shared/negotiation/version.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  if ((Deno.env.get("HIDE_TEAM_CODES") ?? "").toLowerCase() === "true") {
    return json({ codes: [], hidden: true, api_version: NEGOTIATION_API_VERSION });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase.from("teams").select("id, token").eq("status", "active");
    if (error) return json({ error: error.message }, 500);
    return json({ codes: data ?? [], hidden: false, api_version: NEGOTIATION_API_VERSION });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`team-codes error: ${message}`);
    return json({ error: message }, 500);
  }
});
