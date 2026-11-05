// Team API: a team's secret URL token is its only credential (no logins).
// Lets a team read its own data and edit its profile: name, logo, intro video, PM and crew.
// Anyone with the team link may edit; scores (rankings) are never writable here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const MAX_NAME_LENGTH = 60;
const MAX_PERSON_LENGTH = 80;
const MAX_MEMBERS = 30;
// Intro video: a YouTube or Vimeo link, shown as an embedded player on the team page
const VIDEO_URL = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/|(player\.)?vimeo\.com\/)/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { action, token, name, logo_url, ext, intro_video_url, pm_name, members } = await req.json();
    if (typeof token !== "string" || !token) return json({ error: "Missing token" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: team, error } = await supabase.from("teams").select("*").eq("token", token).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!team) {
      await new Promise((r) => setTimeout(r, 500));
      return json({ error: "Invalid team token" }, 404);
    }

    switch (action) {
      case "get":
        return json({ team });

      case "update": {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name !== undefined) {
          const trimmed = typeof name === "string" ? name.trim() : "";
          if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
            return json({ error: `Team name must be 1-${MAX_NAME_LENGTH} characters` }, 400);
          }
          updates.name = trimmed;
        }
        if (logo_url !== undefined) {
          // Only allow logos hosted in our own bucket
          const prefix = `${supabaseUrl}/storage/v1/object/public/team-logos/`;
          if (logo_url !== "" && (typeof logo_url !== "string" || !logo_url.startsWith(prefix))) {
            return json({ error: "Invalid logo URL" }, 400);
          }
          updates.logo_url = logo_url;
        }
        if (intro_video_url !== undefined) {
          const url = typeof intro_video_url === "string" ? intro_video_url.trim() : "";
          if (url && (!VIDEO_URL.test(url) || url.length > 500)) {
            return json({ error: "Intro video must be a YouTube or Vimeo link" }, 400);
          }
          updates.intro_video_url = url;
        }
        if (pm_name !== undefined) {
          const pm = typeof pm_name === "string" ? pm_name.trim() : "";
          if (pm.length > MAX_PERSON_LENGTH) return json({ error: `PM name can have at most ${MAX_PERSON_LENGTH} characters` }, 400);
          updates.pm_name = pm;
        }
        if (members !== undefined) {
          if (!Array.isArray(members)) return json({ error: "Members must be a list of names" }, 400);
          const list = members.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean);
          if (list.length > MAX_MEMBERS) return json({ error: `At most ${MAX_MEMBERS} team members` }, 400);
          if (list.some((m) => m.length > MAX_PERSON_LENGTH)) {
            return json({ error: `Member names can have at most ${MAX_PERSON_LENGTH} characters` }, 400);
          }
          updates.members = list;
        }
        const { data, error: updateError } = await supabase.from("teams").update(updates).eq("id", team.id).select().single();
        if (updateError) return json({ error: updateError.message }, 500);
        return json({ team: data });
      }

      case "upload-url": {
        const extension = String(ext ?? "").toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(extension)) return json({ error: "Unsupported image type" }, 400);
        const path = `teams/${team.id}/${crypto.randomUUID()}.${extension}`;
        const { data, error: signError } = await supabase.storage.from("team-logos").createSignedUploadUrl(path);
        if (signError) return json({ error: signError.message }, 500);
        const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
        return json({ path, token: data.token, publicUrl });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`team-api error: ${message}`);
    return json({ error: message }, 500);
  }
});
