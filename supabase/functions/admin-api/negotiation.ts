// Negotiation Room actions of the admin API (password session already verified by index.ts).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Conversation, Settings, StoredMessage, Supplier } from "../_shared/negotiation/types.ts";
import { currentOffer, freshConversation } from "../_shared/negotiation/engine.ts";
import { ANTHROPIC_MODELS, MODEL_PRICES, isAllowedAnthropicModel, providerStatus } from "../_shared/negotiation/llm.ts";
import { systemPrompt } from "../_shared/negotiation/prompt.ts";
import { NEGOTIATION_API_VERSION } from "../_shared/negotiation/version.ts";
import { costRowFromMeta, logCost, type CostLogRow } from "../_shared/negotiation/costlog.ts";
import { runTurn } from "../_shared/negotiation/turn.ts";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new HttpError(500, error.message);
  return data;
};

const SETTINGS_WRITABLE = ["is_open", "max_messages", "llm_provider", "llm_model", "rules_prompt"];
const SUPPLIER_WRITABLE = [
  "key", "name", "region", "qualified", "enabled", "sort_order", "initial_price", "min_price", "alt_min_price", "alt_min_condition",
  "trap", "persona", "weak_spots", "fixed_facts", "concession_weak_spot_pct", "proposal_intro", "proposal_specs", "proposal_documents",
  "offer_terms", "site_content", "materials",
];
const MATERIAL_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "gif"];
const MAX_MESSAGES_LIMIT = 50;

const pick = (allowed: string[], values: unknown) => {
  if (!values || typeof values !== "object") throw new HttpError(400, "Missing values");
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (!allowed.includes(k)) throw new HttpError(400, `Field '${k}' is not writable`);
    out[k] = v;
  }
  return out;
};

const requireInt = (v: unknown, name: string, min = 0) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new HttpError(400, `${name} must be a whole number${min ? ` ≥ ${min}` : ""}`);
  return n;
};

const loadSettings = async (supabase: SupabaseClient): Promise<Settings> => {
  const row = check(await supabase.from("negotiation_settings").select("*").eq("id", true).maybeSingle());
  if (!row) throw new HttpError(500, "Negotiation settings are missing");
  return row as Settings;
};

const loadSupplier = async (supabase: SupabaseClient, key: unknown): Promise<Supplier> => {
  if (typeof key !== "string" || !key) throw new HttpError(400, "Missing supplier key");
  const row = check(await supabase.from("negotiation_suppliers").select("*").eq("key", key).maybeSingle());
  if (!row) throw new HttpError(404, "Unknown supplier");
  return row as Supplier;
};

interface CostRow {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number | null; // null when any call had an unknown price
}

const emptyCost = (): CostRow => ({ calls: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 });

const addCost = (row: CostRow, c: CostLogRow) => {
  row.calls++;
  row.input_tokens += c.input_tokens;
  row.output_tokens += c.output_tokens;
  row.cache_read_tokens += c.cache_read_tokens;
  row.cache_write_tokens += c.cache_write_tokens;
  if (typeof c.cost_usd === "number" && row.cost_usd !== null) row.cost_usd += Number(c.cost_usd);
  else row.cost_usd = null;
};

/**
 * total / by_model: all time, from the persistent cost log (team chats and admin test chats;
 * never reset). by_team: from the current chats only, so it resets with the chats.
 * Without the cost log table (migration not applied yet) everything comes from the current chats.
 */
export const costSummary = (
  messages: { meta: Record<string, unknown> | null; conversation_id: string }[],
  convByTeam: Map<string, string>,
  log: CostLogRow[] | null,
) => {
  const byTeam: Record<string, CostRow> = {};
  const current: CostLogRow[] = [];
  for (const m of messages) {
    if (!m.meta || !m.meta.usage) continue;
    const teamId = convByTeam.get(m.conversation_id) ?? "?";
    const row = costRowFromMeta(m.meta, "team", teamId, null);
    current.push(row);
    addCost((byTeam[teamId] ??= emptyCost()), row);
  }
  const total = emptyCost();
  const byModel: Record<string, CostRow> = {};
  for (const row of log ?? current) {
    addCost(total, row);
    addCost((byModel[`${row.provider ?? "?"} / ${row.model ?? "?"}`] ??= emptyCost()), row);
  }
  return { total, by_model: byModel, by_team: byTeam, persistent: log !== null };
};

/** All rows of the persistent cost log, or null when the table does not exist yet. */
const loadCostLog = async (supabase: SupabaseClient): Promise<CostLogRow[] | null> => {
  const { data, error } = await supabase
    .from("negotiation_cost_log")
    .select("source, team_id, supplier_key, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd");
  if (error) {
    console.log(`cost log not available: ${error.message}`);
    return null;
  }
  return ((data ?? []) as CostLogRow[]).map((r) => ({ ...r, cost_usd: r.cost_usd === null ? null : Number(r.cost_usd) }));
};

/** Returns a response body for negotiation-* actions, or null when the action is not ours. */
export const handleNegotiationAction = async (
  action: string,
  body: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<unknown | null> => {
  switch (action) {
    case "negotiation-overview": {
      const settings = await loadSettings(supabase);
      const suppliers = (check(await supabase.from("negotiation_suppliers").select("*").order("sort_order")) ?? []) as Supplier[];
      const teams = check(await supabase.from("teams").select("id, name, logo_url, status")) ?? [];
      const conversations = (check(await supabase.from("negotiation_conversations").select("*")) ?? []) as Conversation[];
      const deals = check(await supabase.from("negotiation_deals").select("*")) ?? [];
      const messages = (check(await supabase.from("negotiation_messages").select("conversation_id, meta").eq("role", "supplier")) ?? []) as {
        meta: Record<string, unknown> | null;
        conversation_id: string;
      }[];
      const supplierByKey = new Map(suppliers.map((s) => [s.key, s]));
      const convByTeam = new Map(conversations.map((c) => [c.id, c.team_id]));
      return {
        api_version: NEGOTIATION_API_VERSION,
        settings,
        providers: providerStatus(),
        model_prices: MODEL_PRICES,
        suppliers,
        teams,
        deals,
        conversations: conversations.map((c) => {
          const s = supplierByKey.get(c.supplier_key);
          return { ...c, offer: s ? currentOffer(s, c) : null };
        }),
        cost: costSummary(messages, convByTeam, await loadCostLog(supabase)),
      };
    }

    case "negotiation-version":
      return { api_version: NEGOTIATION_API_VERSION };

    case "negotiation-transcript": {
      const id = body.conversation_id;
      if (typeof id !== "string" || !id) throw new HttpError(400, "Missing conversation_id");
      const messages = check(await supabase.from("negotiation_messages").select("*").eq("conversation_id", id).order("created_at"));
      return { messages };
    }

    case "negotiation-reset": {
      const teamId = body.team_id;
      if (typeof teamId !== "string" || !teamId) throw new HttpError(400, "Missing team_id");
      const supplierKey = typeof body.supplier_key === "string" && body.supplier_key ? body.supplier_key : null;
      let q = supabase.from("negotiation_conversations").delete().eq("team_id", teamId);
      if (supplierKey) q = q.eq("supplier_key", supplierKey);
      check(await q);
      let d = supabase.from("negotiation_deals").delete().eq("team_id", teamId);
      if (supplierKey) d = d.eq("supplier_key", supplierKey);
      check(await d);
      return { ok: true };
    }

    case "negotiation-reset-all": {
      // Wipes every chat, message (and with it the per-team costs) and deal of all teams.
      // The persistent cost log (total cost), suppliers, prompts and settings stay.
      // Requires the typed confirmation.
      if (body.confirm !== "RESET") throw new HttpError(400, 'Type RESET to confirm');
      const before = {
        conversations: (check(await supabase.from("negotiation_conversations").select("id")) ?? []).length,
        deals: (check(await supabase.from("negotiation_deals").select("team_id")) ?? []).length,
      };
      check(await supabase.from("negotiation_deals").delete().not("team_id", "is", null));
      check(await supabase.from("negotiation_messages").delete().not("id", "is", null));
      check(await supabase.from("negotiation_conversations").delete().not("id", "is", null));
      if (body.close_room === true) {
        check(await supabase.from("negotiation_settings").update({ is_open: false, updated_at: new Date().toISOString() }).eq("id", true));
      }
      return { ok: true, deleted: before };
    }

    case "negotiation-settings": {
      const values = pick(SETTINGS_WRITABLE, body.values);
      if ("max_messages" in values) {
        values.max_messages = requireInt(values.max_messages, "max_messages", 1);
        if (Number(values.max_messages) > MAX_MESSAGES_LIMIT) throw new HttpError(400, `max_messages must be between 1 and ${MAX_MESSAGES_LIMIT}`);
      }
      if ("llm_provider" in values && !["anthropic", "lovable"].includes(String(values.llm_provider))) {
        throw new HttpError(400, "llm_provider must be anthropic or lovable");
      }
      if ("llm_model" in values && (typeof values.llm_model !== "string" || !values.llm_model.trim())) throw new HttpError(400, "llm_model is required");
      // Anthropic: only Haiku or Sonnet
      const current = await loadSettings(supabase);
      const provider = String(values.llm_provider ?? current.llm_provider);
      if (provider === "anthropic") {
        const model = typeof values.llm_model === "string" ? values.llm_model.trim() : current.llm_model;
        if (!isAllowedAnthropicModel(model)) throw new HttpError(400, `Model must be one of: ${ANTHROPIC_MODELS.join(", ")}`);
        values.llm_model = model;
      }
      values.updated_at = new Date().toISOString();
      const row = check(await supabase.from("negotiation_settings").update(values).eq("id", true).select().single());
      return { settings: row };
    }

    case "negotiation-supplier-save": {
      const values = pick(SUPPLIER_WRITABLE, body.values);
      const key = typeof values.key === "string" ? values.key.trim().toUpperCase() : "";
      if (!/^[A-Z0-9_-]{1,12}$/.test(key)) throw new HttpError(400, "Supplier key must be 1–12 letters, digits, - or _");
      values.key = key;
      if (typeof values.name !== "string" || !values.name.trim()) throw new HttpError(400, "Supplier name is required");
      if ("initial_price" in values) values.initial_price = requireInt(values.initial_price, "initial_price", 1);
      if ("min_price" in values) values.min_price = requireInt(values.min_price, "min_price", 1);
      if (Number(values.min_price) > Number(values.initial_price)) throw new HttpError(400, "min_price cannot be above initial_price");
      if (values.alt_min_price != null && values.alt_min_price !== "") {
        values.alt_min_price = requireInt(values.alt_min_price, "alt_min_price", 1);
        if (Number(values.alt_min_price) > Number(values.min_price)) throw new HttpError(400, "alt_min_price must be below min_price");
      } else values.alt_min_price = null;
      if (values.trap && typeof values.trap === "object") {
        const t = values.trap as Record<string, unknown>;
        t.price = requireInt(t.price, "trap price", 1);
        for (const f of ["offer_text", "term_key", "term_value", "breaks"]) {
          if (typeof t[f] !== "string" || !(t[f] as string).trim()) throw new HttpError(400, `Trap ${f} is required`);
        }
      } else values.trap = null;
      if ("concession_weak_spot_pct" in values) {
        const n = Number(values.concession_weak_spot_pct);
        if (!Number.isFinite(n) || n < 0 || n > 50) throw new HttpError(400, "concession_weak_spot_pct must be 0–50");
        values.concession_weak_spot_pct = n;
      }
      if ("sort_order" in values) values.sort_order = requireInt(values.sort_order, "sort_order");
      if ("weak_spots" in values && !Array.isArray(values.weak_spots)) throw new HttpError(400, "weak_spots must be a list");
      values.updated_at = new Date().toISOString();
      const row = check(await supabase.from("negotiation_suppliers").upsert(values, { onConflict: "key" }).select().single());
      return { supplier: row };
    }

    case "negotiation-supplier-delete": {
      const key = body.key;
      if (typeof key !== "string" || !key) throw new HttpError(400, "Missing key");
      check(await supabase.from("negotiation_suppliers").delete().eq("key", key));
      return { ok: true };
    }

    case "negotiation-material-upload-url": {
      const supplier = await loadSupplier(supabase, body.supplier_key);
      const ext = String(body.ext ?? "").toLowerCase();
      if (!MATERIAL_EXTENSIONS.includes(ext)) throw new HttpError(400, "Unsupported file type");
      const path = `suppliers/${supplier.key}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage.from("negotiation-materials").createSignedUploadUrl(path);
      if (error) throw new HttpError(500, error.message);
      const { data: { publicUrl } } = supabase.storage.from("negotiation-materials").getPublicUrl(path);
      return { path, token: data.token, publicUrl };
    }

    case "negotiation-prompt-preview": {
      const settings = await loadSettings(supabase);
      const supplier = await loadSupplier(supabase, body.supplier_key);
      return { system: systemPrompt(settings, supplier) };
    }

    case "negotiation-test-chat": {
      // Throw-away turn: nothing is stored. The caller passes the running test state back each time.
      const settings = await loadSettings(supabase);
      const supplier = await loadSupplier(supabase, body.supplier_key);
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) throw new HttpError(400, "Write a message first");
      const incoming = (body.conversation ?? {}) as Partial<Conversation>;
      const conv: Conversation = {
        ...freshConversation("test", supplier),
        ...incoming,
        id: "test",
        team_id: "test",
        supplier_key: supplier.key,
        updated_at: new Date().toISOString(),
      };
      const history = (Array.isArray(body.history) ? body.history : []) as StoredMessage[];
      const turn = await runTurn(settings, supplier, conv, history, text);
      await logCost(supabase, costRowFromMeta(turn.meta, "test", null, supplier.key));
      return {
        reply: turn.reply,
        conversation: { ...turn.next, messages_used: conv.messages_used + 1 },
        offer: currentOffer(supplier, turn.next),
        meta: turn.meta,
      };
    }

    default:
      return null;
  }
};

export { HttpError as NegotiationHttpError };
