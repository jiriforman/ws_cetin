// Password-protected admin API. All admin writes go through here using the
// service role, so the public anon key can stay read-only.
//
// Required secret: ADMIN_PASSWORD
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleNegotiationAction, NegotiationHttpError } from "./negotiation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_HOURS = 12;
const encoder = new TextEncoder();

// Columns the admin UI may write, per table
const WRITABLE: Record<string, string[]> = {
  teams: ["name", "logo_url", "drive_share_url", "status"],
  phases: ["name", "background", "output", "task", "materials", "evaluation", "learnings_project_management", "learnings_ai_arsenal", "learnings_visible", "cheat_sheet", "budget", "tools", "duration_minutes", "status", "start_time", "end_time", "order"],
  tools: ["tool_name", "description", "link_url", "logo_url", "category", "visible", "display_order"],
  sections: ["content_rtf", "enabled"],
  tool_categories: ["description"],
};
const INSERTABLE = ["phases", "tools"];
const DELETABLE = ["phases", "tools"];
const ORDER_COLUMN: Record<string, string> = { phases: "order", tools: "display_order", tool_categories: "display_order" };
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "webm"];
// Cartel Rankings amounts are whole US dollars
const MAX_AMOUNT = 1_000_000_000_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const timingSafeEqual = (a: string, b: string) => {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
};

const sign = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Session token = "<expiry ms>.<hmac>". Changing ADMIN_PASSWORD invalidates all sessions.
const createSession = async (password: string) => {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  return `${exp}.${await sign(password, `narcos-admin:${exp}`)}`;
};

const verifySession = async (password: string, session: unknown) => {
  if (typeof session !== "string") return false;
  const [exp, sig] = session.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return timingSafeEqual(sig, await sign(password, `narcos-admin:${exp}`));
};

/** Unwraps a Supabase result; a database error becomes a 500. Module level so helpers outside the handler can use it. */
const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new HttpError(500, error.message);
  return data;
};

type ParallelRow = { id: string; order: number; duration_minutes: number | null; parallel_with?: string | null; parallel_with_previous?: boolean | null };

/**
 * Phases running at the same time: each phase names its partner in parallel_with (kept symmetric).
 * Linked phases form one block. Databases without the column fall back to the older
 * parallel_with_previous flag (joins the phase before it).
 */
const parallelBlockIds = (rows: ParallelRow[], id: string): string[] => {
  const all = [...rows].sort((a, b) => a.order - b.order);
  const hasPartnerColumn = all.some((p) => "parallel_with" in p);
  const links = new Map<string, Set<string>>(all.map((p) => [p.id, new Set<string>()]));
  const link = (a: string, b: string) => {
    if (a === b || !links.has(a) || !links.has(b)) return;
    links.get(a)!.add(b);
    links.get(b)!.add(a);
  };
  all.forEach((p, i) => {
    if (hasPartnerColumn) {
      if (p.parallel_with) link(p.id, p.parallel_with);
    } else if (p.parallel_with_previous && i > 0) link(all[i - 1].id, p.id);
  });
  const block = new Set([id]);
  const queue = [id];
  while (queue.length) for (const next of links.get(queue.shift()!) ?? []) if (!block.has(next)) block.add(next), queue.push(next);
  return all.filter((p) => block.has(p.id)).map((p) => p.id);
};

/**
 * Sets the parallel partner of a phase and mirrors it on the partner (partnerId null = run alone).
 * Any earlier partner of either phase is released. Returns the changed rows.
 */
const setParallelPartner = async (supabase: SupabaseClient<any, "public", any>, id: string, partnerId: string | null) => {
  if (partnerId === id) throw new HttpError(400, "A phase cannot run in parallel with itself");
  const all = check(await supabase.from("phases").select("id, name, order, parallel_with").order("order")) as {
    id: string;
    name: string;
    order: number;
    parallel_with: string | null;
  }[];
  const byId = new Map(all.map((p) => [p.id, p]));
  if (!byId.has(id)) throw new HttpError(404, "Phase not found");
  if (partnerId && !byId.has(partnerId)) throw new HttpError(404, "Partner phase not found");
  // Parallel phases must sit next to each other in the phase order
  if (partnerId && Math.abs(all.findIndex((p) => p.id === id) - all.findIndex((p) => p.id === partnerId)) !== 1) {
    throw new HttpError(400, `'${byId.get(id)!.name}' and '${byId.get(partnerId)!.name}' are not next to each other; only adjacent phases can run in parallel`);
  }
  const involved = [id, partnerId].filter((x): x is string => !!x);
  // Release: the two phases themselves and every phase pointing at either of them
  const release = all.filter((p) => involved.includes(p.id) || (p.parallel_with && involved.includes(p.parallel_with))).map((p) => p.id);
  if (release.length) check(await supabase.from("phases").update({ parallel_with: "" }).in("id", release));
  if (partnerId) {
    check(await supabase.from("phases").update({ parallel_with: partnerId }).eq("id", id));
    check(await supabase.from("phases").update({ parallel_with: id }).eq("id", partnerId));
  }
  return check(await supabase.from("phases").select("*").in("id", [...new Set([...release, ...involved])])) as Record<string, unknown>[];
};

const pick = (table: string, values: unknown) => {
  if (!values || typeof values !== "object") throw new HttpError(400, "Missing values");
  const allowed = WRITABLE[table];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (!allowed.includes(k)) throw new HttpError(400, `Column '${k}' is not writable on '${table}'`);
    out[k] = v;
  }
  return out;
};

const requireTable = (table: unknown, list: string[]) => {
  if (typeof table !== "string" || !list.includes(table)) throw new HttpError(400, "Invalid table");
  return table;
};

const requireId = (id: unknown) => {
  if (typeof id !== "string" || !id) throw new HttpError(400, "Missing id");
  return id;
};

const requireAmount = (value: unknown, label: string) => {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || Math.abs(n) > MAX_AMOUNT) {
    throw new HttpError(400, `${label} must be a whole number of US dollars`);
  }
  return n;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const password = Deno.env.get("ADMIN_PASSWORD");
  if (!password) return json({ error: "ADMIN_PASSWORD is not configured" }, 500);

  try {
    const body = await req.json();
    const { action } = body ?? {};

    if (action === "login") {
      if (typeof body.password !== "string" || !timingSafeEqual(body.password, password)) {
        // Slow down brute force attempts
        await new Promise((r) => setTimeout(r, 1000));
        return json({ error: "Invalid password" }, 401);
      }
      return json({ session: await createSession(password) });
    }

    if (!(await verifySession(password, body.session))) {
      return json({ error: "Session expired, please log in again" }, 401);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (typeof action === "string" && action.startsWith("negotiation-")) {
      try {
        const result = await handleNegotiationAction(action, body, supabase);
        if (result === null) throw new HttpError(400, "Unknown action");
        return json(result);
      } catch (err) {
        if (err instanceof NegotiationHttpError) throw new HttpError(err.status, err.message);
        throw err;
      }
    }

    // Tools may only use one of the fixed categories ('' = uncategorised)
    const toolCategoryIds = async () =>
      new Set((check(await supabase.from("tool_categories").select("id")) as { id: string }[]).map((c) => c.id));
    const requireToolCategory = async (category: unknown) => {
      if (category === undefined || category === "") return;
      if (typeof category !== "string" || !(await toolCategoryIds()).has(category)) {
        throw new HttpError(400, `Unknown tool category '${category}'`);
      }
    };

    switch (action) {
      case "verify":
        return json({ ok: true });

      case "list-teams":
        return json({ teams: check(await supabase.from("teams").select("*")) });

      case "update": {
        const table = requireTable(body.table, Object.keys(WRITABLE));
        const values = pick(table, body.values);
        if (table === "tools") await requireToolCategory(values.category);
        if (table === "teams") values.updated_at = new Date().toISOString();
        const rows = check(await supabase.from(table).update(values).eq("id", requireId(body.id)).select());
        if (!rows?.length) throw new HttpError(404, "Not found");
        return json({ row: rows[0] });
      }

      case "insert": {
        const table = requireTable(body.table, INSERTABLE);
        const values: Record<string, unknown> = { ...pick(table, body.values), id: crypto.randomUUID() };
        if (table === "tools") await requireToolCategory(values.category);
        return json({ row: check(await supabase.from(table).insert(values).select().single()) });
      }

      case "delete": {
        const table = requireTable(body.table, DELETABLE);
        check(await supabase.from(table).delete().eq("id", requireId(body.id)));
        return json({ ok: true });
      }

      case "reorder": {
        const table = requireTable(body.table, Object.keys(ORDER_COLUMN));
        if (!Array.isArray(body.ids)) throw new HttpError(400, "Missing ids");
        for (const [index, id] of body.ids.entries()) {
          check(await supabase.from(table).update({ [ORDER_COLUMN[table]]: index + 1 }).eq("id", requireId(id)));
        }
        return json({ ok: true });
      }

      case "start-phase": {
        // Starts the whole parallel block (phases linked through parallel_with) with one shared timer:
        // the block lasts as long as its longest phase.
        const id = requireId(body.id);
        const all = check(await supabase.from("phases").select("*").order("order")) as ParallelRow[];
        if (!all.some((p) => p.id === id)) throw new HttpError(404, "Phase not found");
        const ids = parallelBlockIds(all, id);
        const block = all.filter((p) => ids.includes(p.id));
        const minutes = Math.max(0, ...block.map((p) => p.duration_minutes || 0));
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);
        check(await supabase.from("phases").update({ status: "completed" }).eq("status", "running").not("id", "in", `(${ids.join(",")})`));
        const rows = check(
          await supabase
            .from("phases")
            .update({ status: "running", start_time: startTime.toISOString(), end_time: endTime.toISOString() })
            .in("id", ids)
            .select(),
        ) as { id: string }[];
        return json({ row: rows.find((r) => r.id === id), rows });
      }

      case "set-parallel": {
        // body.partner_id: phase to run in parallel with, or null/"" to run alone; mirrored on both phases
        const id = requireId(body.id);
        const partner = typeof body.partner_id === "string" && body.partner_id ? body.partner_id : null;
        return json({ rows: await setParallelPartner(supabase, id, partner) });
      }

      case "set-starting-budget": {
        const amount = requireAmount(body.amount, "Starting budget");
        if (amount < 0) throw new HttpError(400, "Starting budget cannot be negative");
        const row = check(
          await supabase
            .from("ranking_settings")
            .upsert({ id: true, starting_budget: amount, updated_at: new Date().toISOString() })
            .select()
            .single(),
        );
        return json({ row });
      }

      case "set-ranking-entry": {
        // amount null = remove the entry (phase not scored for this team yet)
        const teamId = requireId(body.team_id);
        const phaseId = requireId(body.phase_id);
        if (body.amount === null || body.amount === "") {
          check(await supabase.from("ranking_entries").delete().eq("team_id", teamId).eq("phase_id", phaseId));
          return json({ row: null });
        }
        const amount = requireAmount(body.amount, "Amount");
        const row = check(
          await supabase
            .from("ranking_entries")
            .upsert(
              { team_id: teamId, phase_id: phaseId, amount, updated_at: new Date().toISOString() },
              { onConflict: "team_id,phase_id" },
            )
            .select()
            .single(),
        );
        return json({ row });
      }

      case "reset-rankings": {
        // Clean leaderboard for a new game run: all impacts, the starting budget and the legacy scores
        check(await supabase.from("ranking_entries").delete().not("id", "is", null));
        check(await supabase.from("ranking_settings").upsert({ id: true, starting_budget: 0, updated_at: new Date().toISOString() }));
        check(
          await supabase
            .from("teams")
            .update({ budget: 0, time_weeks: 0, expected_revenue: 0, time_bonus: 0, total_revenue: 0, rank: 0, last_recalculated: null })
            .not("id", "is", null),
        );
        return json({ ok: true });
      }

      case "import-all": {
        // One-file import of everything editable in the admin console.
        // Everything is validated first; nothing is written if any row is invalid.
        // Phase runtime state (status, start_time, end_time) is never touched.
        const deleteMissing = (body.deleteMissing ?? {}) as Record<string, boolean>;
        const errors: string[] = [];
        const list = (key: string) => (Array.isArray(body[key]) ? (body[key] as Record<string, unknown>[]) : null);
        const text = (v: unknown) => (v == null ? "" : String(v));
        const int = (v: unknown, where: string) => {
          const n = Number(v ?? 0);
          if (!Number.isInteger(n) || n < 0) errors.push(`${where}: must be a whole number`);
          return n;
        };
        const ids = async (table: string) =>
          new Set<string>((check(await supabase.from(table).select("id")) as { id: string }[]).map((r) => r.id));
        const requireKnownId = (id: unknown, known: Set<string>, where: string, canCreate: boolean) => {
          const value = typeof id === "string" && id.trim() ? id.trim() : null;
          if (!value && !canCreate) errors.push(`${where}: id is required`);
          if (value && !known.has(value)) errors.push(`${where}: id '${value}' does not exist`);
          return value;
        };

        const tools = list("tools");
        const phases = list("phases");
        const sections = list("sections");
        const teams = list("teams");
        if (!tools && !phases && !sections && !teams) throw new HttpError(400, "Nothing to import");

        const [toolIds, phaseIds, sectionIds, teamIds] = await Promise.all([ids("tools"), ids("phases"), ids("sections"), ids("teams")]);

        const categoryIds = tools ? await toolCategoryIds() : new Set<string>();
        const toolRows = (tools ?? []).map((t, i) => {
          const where = `Tools row ${i + 1}`;
          const name = text(t.tool_name).trim();
          if (!name) errors.push(`${where}: tool_name is required`);
          const category = text(t.category).trim();
          if (category && !categoryIds.has(category)) errors.push(`${where}: unknown category '${category}'`);
          return {
            id: requireKnownId(t.id, toolIds, where, true),
            values: {
              tool_name: name,
              description: text(t.description),
              link_url: text(t.link_url),
              logo_url: text(t.logo_url),
              category,
              visible: t.visible !== false,
              display_order: int(t.display_order, `${where} display_order`),
            },
          };
        });

        // Phases refer to tools by name; resolve against the tools as they will be after this import
        const existingTools = check(await supabase.from("tools").select("id, tool_name")) as { id: string; tool_name: string }[];
        const toolNames = new Set(
          (tools ? toolRows.map((t) => t.values.tool_name) : existingTools.map((t) => t.tool_name)).map((n) => n.toLowerCase()),
        );

        const phaseRows = (phases ?? []).map((p, i) => {
          const where = `Phases row ${i + 1}`;
          const name = text(p.name).trim();
          if (!name) errors.push(`${where}: name is required`);
          const toolList = Array.isArray(p.tools) ? p.tools.map(String) : [];
          toolList.filter((t) => !toolNames.has(t.toLowerCase())).forEach((t) => errors.push(`${where}: unknown tool '${t}'`));
          const partnerName = p.parallel_with === undefined ? undefined : text(p.parallel_with).trim();
          return {
            id: requireKnownId(p.id, phaseIds, where, true),
            toolNames: toolList,
            partnerName,
            values: {
              name,
              order: int(p.order ?? i + 1, `${where} order`),
              duration_minutes: int(p.duration_minutes, `${where} duration_minutes`),
              budget: int(p.budget, `${where} budget`),
              evaluation: text(p.evaluation),
              ...(p.learnings_project_management !== undefined ? { learnings_project_management: text(p.learnings_project_management) } : {}),
              ...(p.learnings_ai_arsenal !== undefined ? { learnings_ai_arsenal: text(p.learnings_ai_arsenal) } : {}),
              ...(p.learnings_visible !== undefined ? { learnings_visible: p.learnings_visible === true } : {}),
              ...(p.cheat_sheet !== undefined ? { cheat_sheet: text(p.cheat_sheet) } : {}),
              background: text(p.background),
              task: text(p.task),
              materials: text(p.materials),
              output: text(p.output),
            } as Record<string, unknown>,
          };
        });

        // Parallel partners are referenced by phase name (the file may create new phases)
        const importedNames = phaseRows.map((r) => String(r.values.name).toLowerCase());
        phaseRows.forEach((r, i) => {
          if (!r.partnerName) return;
          if (!importedNames.includes(r.partnerName.toLowerCase())) errors.push(`Phases row ${i + 1}: parallel_with '${r.partnerName}' is not a phase name in this file`);
          if (r.partnerName.toLowerCase() === String(r.values.name).toLowerCase()) errors.push(`Phases row ${i + 1}: a phase cannot run in parallel with itself`);
        });

        const sectionRows = (sections ?? []).map((s, i) => ({
          id: requireKnownId(s.id, sectionIds, `Content row ${i + 1}`, false),
          values: { content_rtf: text(s.content_rtf), enabled: s.enabled !== false },
        }));

        const teamRows = (teams ?? []).map((t, i) => {
          const where = `Teams row ${i + 1}`;
          const name = text(t.name).trim();
          if (!name) errors.push(`${where}: name is required`);
          const status = text(t.status || "active");
          if (!["active", "disabled"].includes(status)) errors.push(`${where}: status must be active or disabled`);
          return {
            id: requireKnownId(t.id, teamIds, where, false),
            values: {
              name,
              status,
              ...(t.drive_share_url !== undefined ? { drive_share_url: text(t.drive_share_url) } : {}),
              logo_url: text(t.logo_url),
              updated_at: new Date().toISOString(),
            },
          };
        });

        for (const [label, rows] of [["Tools", toolRows], ["Phases", phaseRows], ["Content", sectionRows], ["Teams", teamRows]] as const) {
          const seen = rows.map((r) => r.id).filter(Boolean);
          seen.filter((id, i) => seen.indexOf(id) !== i).forEach((id) => errors.push(`${label}: id '${id}' appears more than once`));
        }
        if (errors.length) throw new HttpError(400, errors.join("\n"));

        // ---- Write phase: only changed rows are written, every change is recorded ----
        type Row = Record<string, unknown> & { id: string };
        type TableReport = {
          created: number; updated: number; unchanged: number; deleted: number;
          changes: { label: string; fields: string[] }[];
          createdLabels: string[];
          deletedLabels: string[];
        };
        const LABEL: Record<string, string> = { tools: "tool_name", phases: "name", sections: "page_key", teams: "name" };
        const IGNORED = new Set(["updated_at"]);
        const summary: Record<string, TableReport> = {};
        const report = (table: string) =>
          (summary[table] ??= { created: 0, updated: 0, unchanged: 0, deleted: 0, changes: [], createdLabels: [], deletedLabels: [] });
        const written: { table: string; id: string; values: Record<string, unknown> }[] = [];
        const removed: { table: string; id: string }[] = [];

        const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
        const same = (a: unknown, b: unknown) => (isEmpty(a) && isEmpty(b)) || JSON.stringify(a) === JSON.stringify(b);
        const snapshot = async (table: string) =>
          new Map((check(await supabase.from(table).select("*")) as Row[]).map((r) => [r.id, r]));

        const upsert = async (table: string, rows: { id: string | null; values: Record<string, unknown> }[], extra: Record<string, unknown> = {}) => {
          const before = await snapshot(table);
          const r = report(table);
          for (const row of rows) {
            const label = String(row.values[LABEL[table]] ?? before.get(row.id ?? "")?.[LABEL[table]] ?? row.id);
            if (row.id) {
              const current = before.get(row.id)!;
              const fields = Object.keys(row.values).filter((k) => !IGNORED.has(k) && !same(current[k], row.values[k]));
              if (!fields.length) {
                r.unchanged++;
                continue;
              }
              check(await supabase.from(table).update(row.values).eq("id", row.id));
              written.push({ table, id: row.id, values: row.values });
              r.updated++;
              r.changes.push({ label, fields });
            } else {
              const id = crypto.randomUUID();
              const values = { ...row.values, ...extra };
              check(await supabase.from(table).insert({ ...values, id }));
              written.push({ table, id, values });
              r.created++;
              r.createdLabels.push(label);
            }
          }
        };
        const removeMissing = async (table: string, rows: { id: string | null }[] | null, known: Set<string>) => {
          if (!rows || deleteMissing[table] !== true) return;
          const keep = new Set(rows.map((r) => r.id));
          const missing = [...known].filter((id) => !keep.has(id));
          if (!missing.length) return;
          const before = await snapshot(table);
          check(await supabase.from(table).delete().in("id", missing));
          const r = report(table);
          r.deleted += missing.length;
          r.deletedLabels.push(...missing.map((id) => String(before.get(id)?.[LABEL[table]] ?? id)));
          removed.push(...missing.map((id) => ({ table, id })));
        };

        const started = Date.now();
        try {
          if (tools) await upsert("tools", toolRows);
          if (phases) {
            const allTools = check(await supabase.from("tools").select("id, tool_name")) as { id: string; tool_name: string }[];
            const idByName = new Map(allTools.map((t) => [t.tool_name.toLowerCase(), t.id]));
            phaseRows.forEach((r) => (r.values.tools = r.toolNames.map((n) => idByName.get(n.toLowerCase())).filter(Boolean)));
            await upsert("phases", phaseRows, { status: "inactive" });
            if (phaseRows.some((r) => r.partnerName !== undefined)) {
              const now = check(await supabase.from("phases").select("id, name, parallel_with")) as { id: string; name: string; parallel_with: string | null }[];
              const idOf = (name: string) => now.find((x) => x.name.toLowerCase() === name.toLowerCase())?.id ?? null;
              const r = report("phases");
              for (const row of phaseRows) {
                if (row.partnerName === undefined) continue;
                const id = idOf(String(row.values.name));
                const partner = row.partnerName ? idOf(row.partnerName) : null;
                const current = now.find((x) => x.id === id);
                if (!id || (current?.parallel_with || null) === partner) continue;
                await setParallelPartner(supabase, id, partner);
                r.changes.push({ label: String(row.values.name), fields: ["parallel_with"] });
                const refreshed = check(await supabase.from("phases").select("id, name, parallel_with")) as typeof now;
                now.splice(0, now.length, ...refreshed);
              }
            }
          }
          if (sections) await upsert("sections", sectionRows);
          if (teams) await upsert("teams", teamRows);
          await removeMissing("phases", phases ? phaseRows : null, phaseIds);
          if (tools && deleteMissing.tools === true) {
            // Drop deleted tools from phases that still reference them
            const deletedTools = new Set([...toolIds].filter((id) => !toolRows.some((r) => r.id === id)));
            if (deletedTools.size) {
              const allPhases = check(await supabase.from("phases").select("id, tools")) as { id: string; tools: string[] | null }[];
              for (const p of allPhases) {
                const cleaned = (p.tools ?? []).filter((t) => !deletedTools.has(t));
                if (cleaned.length !== (p.tools ?? []).length) check(await supabase.from("phases").update({ tools: cleaned }).eq("id", p.id));
              }
            }
            await removeMissing("tools", toolRows, toolIds);
          }
        } catch (err) {
          // Partial import: tell the admin exactly what was already saved
          const message = err instanceof Error ? err.message : String(err);
          console.log(`import-all failed after ${written.length} writes: ${message}`);
          return json({ error: `Import stopped: ${message}`, partial: true, summary }, 500);
        }

        // ---- Health check: read everything back and compare with what was written ----
        const problems: string[] = [];
        const tablesWritten = [...new Set([...written, ...removed].map((w) => w.table))];
        for (const table of tablesWritten) {
          const after = await snapshot(table);
          for (const w of written.filter((x) => x.table === table)) {
            const stored = after.get(w.id);
            const label = String(w.values[LABEL[table]] ?? stored?.[LABEL[table]] ?? w.id);
            if (!stored) {
              problems.push(`${table}: "${label}" is missing after import`);
              continue;
            }
            const wrong = Object.keys(w.values).filter((k) => !IGNORED.has(k) && !same(stored[k], w.values[k]));
            if (wrong.length) problems.push(`${table}: "${label}" has unexpected values in ${wrong.join(", ")}`);
          }
          for (const d of removed.filter((x) => x.table === table)) {
            if (after.has(d.id)) problems.push(`${table}: row ${d.id} was not deleted`);
          }
        }
        console.log(`import-all done in ${Date.now() - started}ms: ${written.length} written, ${removed.length} deleted, ${problems.length} problems`);
        return json({
          summary,
          verification: { checked: written.length + removed.length, problems },
          durationMs: Date.now() - started,
        });
      }

      case "audio-upload-url": {
        // Phase voice intros (stored in the public team-logos bucket under audio/)
        const ext = String(body.ext ?? "").toLowerCase();
        if (!AUDIO_EXTENSIONS.includes(ext)) throw new HttpError(400, "Unsupported audio type");
        const path = `audio/${crypto.randomUUID()}.${ext}`;
        const signed = check(await supabase.storage.from("team-logos").createSignedUploadUrl(path));
        if (!signed) throw new HttpError(500, "Could not create upload URL");
        const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
        return json({ path, token: signed.token, publicUrl });
      }

      case "upload-url": {
        const ext = String(body.ext ?? "").toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) throw new HttpError(400, "Unsupported image type");
        const path = `editor/${crypto.randomUUID()}.${ext}`;
        const signed = check(await supabase.storage.from("team-logos").createSignedUploadUrl(path));
        if (!signed) throw new HttpError(500, "Could not create upload URL");
        const { token } = signed;
        const { data: { publicUrl } } = supabase.storage.from("team-logos").getPublicUrl(path);
        return json({ path, token, publicUrl });
      }

      default:
        throw new HttpError(400, "Unknown action");
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`admin-api error (${status}): ${message}`);
    return json({ error: message }, status);
  }
});
