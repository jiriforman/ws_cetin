import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const timingSafeEqual = (a: string, b: string) => {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");

    if (!expectedSecret || !webhookSecret || !timingSafeEqual(webhookSecret, expectedSecret)) {
      console.log("❌ Unauthorized request - invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { teams } = await req.json();

    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      console.log("❌ Empty or missing teams array");
      return new Response(JSON.stringify({ error: "Missing or empty 'teams' array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📊 Received ${teams.length} teams to update`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = [];
    const errors = [];

    for (const team of teams) {
      const matchField = team.token ? "token" : team.name ? "name" : null;
      const matchValue = team.token || team.name;

      if (!matchField) {
        console.log(`⚠️ Skipped: team entry missing both token and name`, JSON.stringify(team));
        errors.push({ team, error: "Missing token or name" });
        continue;
      }

      const updateData: Record<string, unknown> = {
        last_recalculated: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (team.budget !== undefined) updateData.budget = Number(team.budget);
      if (team.time_bonus !== undefined) updateData.time_bonus = Number(team.time_bonus);
      if (team.time_weeks !== undefined) updateData.time_weeks = Number(team.time_weeks);
      if (team.total_revenue !== undefined) updateData.total_revenue = Number(team.total_revenue);
      if (team.rank !== undefined) updateData.rank = Number(team.rank);

      console.log(`🔄 Updating "${matchValue}" (by ${matchField}): budget=${updateData.budget}, weeks=${updateData.time_weeks}, bonus=${updateData.time_bonus}, total=${updateData.total_revenue}, rank=${updateData.rank}`);

      const { data, error } = await supabase
        .from("teams")
        .update(updateData)
        .eq(matchField, matchValue)
        .select("id, name, token");

      if (error) {
        console.log(`❌ DB error for "${matchValue}": ${error.message}`);
        errors.push({ identifier: matchValue, error: error.message });
      } else if (!data || data.length === 0) {
        console.log(`❌ No team found matching ${matchField}="${matchValue}"`);
        errors.push({ identifier: matchValue, error: "No team found" });
      } else {
        console.log(`✅ Updated "${data[0].name}" (token: ${data[0].token})`);
        results.push({ name: data[0].name, token: data[0].token, status: "updated", values: { budget: updateData.budget, time_weeks: updateData.time_weeks, time_bonus: updateData.time_bonus, total_revenue: updateData.total_revenue, rank: updateData.rank } });
      }
    }

    console.log(`📋 Summary: ${results.length} updated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ updated: results.length, errors: errors.length, results, errors_list: errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`💥 Unexpected error: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
