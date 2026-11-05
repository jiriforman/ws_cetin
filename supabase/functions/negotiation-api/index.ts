// Negotiation Room API for teams. The team's secret URL token is the only credential.
// Price rules are enforced here (see _shared/negotiation/engine.ts), never by the model.
//
// Secrets: ANTHROPIC_API_KEY and/or LOVABLE_API_KEY (whichever provider is active in the admin).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { Conversation, Settings, StoredMessage, Supplier } from "../_shared/negotiation/types.ts";
import { currentOffer, freshConversation } from "../_shared/negotiation/engine.ts";
import { runTurn } from "../_shared/negotiation/turn.ts";
import { NEGOTIATION_API_VERSION } from "../_shared/negotiation/version.ts";
import { costRowFromMeta, logCost } from "../_shared/negotiation/costlog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEXT = 600;
const LOCK_TIMEOUT_MS = 90_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** The part of a supplier a team may see. Never the minimum, trap, qualification or prompt. */
export const publicSupplier = (s: Supplier) => ({
  key: s.key,
  name: s.name,
  region: s.region,
  sort_order: s.sort_order,
  initial_price: s.initial_price,
  proposal_intro: s.proposal_intro,
  proposal_specs: s.proposal_specs,
  proposal_documents: s.proposal_documents,
  offer_terms: s.offer_terms,
  site_content: s.site_content,
  materials: s.materials,
});

const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new HttpError(500, error.message);
  return data;
};

const loadSettings = async (supabase: SupabaseClient): Promise<Settings> => {
  const row = check(await supabase.from("negotiation_settings").select("*").eq("id", true).maybeSingle());
  if (!row) throw new HttpError(500, "Negotiation settings are missing");
  return row as Settings;
};

const loadSuppliers = async (supabase: SupabaseClient): Promise<Supplier[]> =>
  (check(await supabase.from("negotiation_suppliers").select("*").eq("enabled", true).order("sort_order")) ?? []) as Supplier[];

const loadConversations = async (supabase: SupabaseClient, teamId: string): Promise<Conversation[]> =>
  (check(await supabase.from("negotiation_conversations").select("*").eq("team_id", teamId)) ?? []) as Conversation[];

const getOrCreateConversation = async (supabase: SupabaseClient, teamId: string, supplier: Supplier): Promise<Conversation> => {
  const existing = check(
    await supabase.from("negotiation_conversations").select("*").eq("team_id", teamId).eq("supplier_key", supplier.key).maybeSingle(),
  );
  if (existing) return existing as Conversation;
  const { data, error } = await supabase
    .from("negotiation_conversations")
    .insert(freshConversation(teamId, supplier))
    .select()
    .single();
  if (error) {
    // Lost a race with a teammate: read the row they created
    const again = check(
      await supabase.from("negotiation_conversations").select("*").eq("team_id", teamId).eq("supplier_key", supplier.key).maybeSingle(),
    );
    if (again) return again as Conversation;
    throw new HttpError(500, error.message);
  }
  return data as Conversation;
};

/** What a team sees of a conversation. Nothing that reveals the trap (no is_trap / trap flags). */
const conversationView = (supplier: Supplier, conv: Conversation | undefined, teamId: string) => {
  const c: Conversation = conv ?? { ...freshConversation(teamId, supplier), id: "", updated_at: "" };
  const offer = currentOffer(supplier, c);
  return {
    supplier_key: supplier.key,
    messages_used: c.messages_used,
    offer: { price: offer.price, terms: offer.terms, is_final: offer.is_final && !offer.is_trap },
    guarantee_dropped: c.guarantee_dropped,
    in_flight: c.in_flight,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { action, token } = body ?? {};
    // Deployment check for the admin console; reveals nothing about teams
    if (action === "version") return json({ api_version: NEGOTIATION_API_VERSION });
    if (typeof token !== "string" || !token) return json({ error: "Missing token" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const team = check(await supabase.from("teams").select("id, name, logo_url, status").eq("token", token).maybeSingle());
    if (!team) {
      await new Promise((r) => setTimeout(r, 500));
      return json({ error: "Invalid team token" }, 404);
    }

    const settings = await loadSettings(supabase);
    const suppliers = await loadSuppliers(supabase);
    const findSupplier = (key: unknown) => {
      const s = suppliers.find((x) => x.key === key);
      if (!s) throw new HttpError(404, "Unknown supplier");
      return s;
    };
    // Public deal columns only: is_valid / is_trap would reveal the qualification and the trap
    const loadDeal = async () =>
      check(await supabase.from("negotiation_deals").select("team_id, supplier_key, price, conditions, accepted_at").eq("team_id", team.id).maybeSingle());

    switch (action) {
      case "state": {
        const [convs, deal] = await Promise.all([loadConversations(supabase, team.id), loadDeal()]);
        const publicDeal = deal
          ? (({ trap_breaks: _b, ...c }) => ({ ...deal, conditions: c }))((deal.conditions ?? {}) as Record<string, unknown>)
          : null;
        return json({
          team: { id: team.id, name: team.name, logo_url: team.logo_url },
          settings: { is_open: settings.is_open, max_messages: settings.max_messages },
          deal: publicDeal,
          suppliers: suppliers.map(publicSupplier),
          conversations: suppliers.map((s) => conversationView(s, convs.find((c) => c.supplier_key === s.key), team.id)),
        });
      }

      case "history": {
        const supplier = findSupplier(body.supplier);
        const conv = check(
          await supabase.from("negotiation_conversations").select("*").eq("team_id", team.id).eq("supplier_key", supplier.key).maybeSingle(),
        ) as Conversation | null;
        if (!conv) return json({ messages: [], conversation: conversationView(supplier, undefined, team.id) });
        const messages = check(
          await supabase.from("negotiation_messages").select("id, role, content, price_after, created_at").eq("conversation_id", conv.id).order("created_at"),
        );
        return json({ messages, conversation: conversationView(supplier, conv, team.id) });
      }

      case "send": {
        if (!settings.is_open) throw new HttpError(403, "The negotiation room is closed right now. Please come back when the leaders open it.");
        if (team.status === "disabled") throw new HttpError(403, "This team is disabled");
        const supplier = findSupplier(body.supplier);
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) throw new HttpError(400, "Write a message first");
        if (text.length > MAX_TEXT) throw new HttpError(400, `Keep your message under ${MAX_TEXT} characters`);
        if (await loadDeal()) throw new HttpError(409, "Your team has already closed a deal. The negotiation is over.");

        const conv = await getOrCreateConversation(supabase, team.id, supplier);
        if (conv.messages_used >= settings.max_messages) {
          throw new HttpError(409, `You have used all ${settings.max_messages} messages with this supplier.`);
        }

        // Lock the conversation so two teammates cannot both spend the same message slot
        const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();
        const locked = check(
          await supabase
            .from("negotiation_conversations")
            .update({ in_flight: true, updated_at: new Date().toISOString() })
            .eq("id", conv.id)
            .eq("messages_used", conv.messages_used)
            .or(`in_flight.eq.false,updated_at.lt.${cutoff}`)
            .select(),
        ) as Conversation[];
        if (!locked?.length) throw new HttpError(409, "A teammate is talking to this supplier right now. Wait for the reply.");

        const history = (check(
          await supabase.from("negotiation_messages").select("id, role, content, price_after, created_at").eq("conversation_id", conv.id).order("created_at"),
        ) ?? []) as StoredMessage[];

        let turn;
        try {
          turn = await runTurn(settings, supplier, conv, history, text);
        } catch (err) {
          await supabase.from("negotiation_conversations").update({ in_flight: false }).eq("id", conv.id);
          const message = err instanceof Error ? err.message : String(err);
          console.log(`negotiation send failed for team ${team.id} / ${supplier.key}: ${message}`);
          throw new HttpError(502, "The supplier is not answering right now. Please try again in a moment.");
        }

        const now = new Date().toISOString();
        const { id: _id, team_id: _t, supplier_key: _s, updated_at: _u, ...state } = turn.next;
        check(
          await supabase
            .from("negotiation_conversations")
            .update({ ...state, messages_used: conv.messages_used + 1, in_flight: false, updated_at: now })
            .eq("id", conv.id),
        );
        check(
          await supabase.from("negotiation_messages").insert([
            { conversation_id: conv.id, role: "team", content: text, price_after: null, meta: null, created_at: now },
            {
              conversation_id: conv.id,
              role: "supplier",
              content: turn.reply,
              price_after: turn.next.current_price,
              meta: turn.meta,
              created_at: new Date(Date.now() + 1).toISOString(),
            },
          ]),
        );
        await logCost(supabase, costRowFromMeta(turn.meta, "team", team.id, supplier.key));

        const updated: Conversation = { ...turn.next, messages_used: conv.messages_used + 1, in_flight: false };
        return json({ reply: turn.reply, conversation: conversationView(supplier, updated, team.id) });
      }

      case "accept": {
        if (!settings.is_open) throw new HttpError(403, "The negotiation room is closed right now.");
        const supplier = findSupplier(body.supplier);
        if (await loadDeal()) throw new HttpError(409, "Your team has already closed a deal. It is final.");
        const conv = await getOrCreateConversation(supabase, team.id, supplier);
        if (conv.in_flight) throw new HttpError(409, "Wait for the supplier's reply before accepting.");
        const offer = currentOffer(supplier, conv);
        const { data, error } = await supabase
          .from("negotiation_deals")
          .insert({
            team_id: team.id,
            supplier_key: supplier.key,
            price: offer.price,
            conditions: { ...offer.terms, guarantee_dropped: conv.guarantee_dropped, trap_breaks: offer.is_trap && supplier.trap ? supplier.trap.breaks : null },
            is_trap: offer.is_trap,
            is_valid: supplier.qualified && !offer.is_trap,
          })
          .select()
          .single();
        if (error) {
          if (error.code === "23505") throw new HttpError(409, "Your team has already closed a deal. It is final.");
          throw new HttpError(500, error.message);
        }
        // The team sees only the public part of the deal (never is_valid / is_trap / what the trap breaks)
        const { is_valid: _v, is_trap: _tr, conditions, ...rest } = data as Record<string, unknown>;
        const { trap_breaks: _b, ...publicConditions } = (conditions ?? {}) as Record<string, unknown>;
        return json({ deal: { ...rest, conditions: publicConditions } });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    const message = err instanceof Error ? err.message : String(err);
    console.log(`negotiation-api error: ${message}`);
    return json({ error: message }, 500);
  }
});
