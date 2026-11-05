// LLM adapters. The active provider and model come from negotiation_settings, so the
// leaders can switch between the Anthropic API and the Lovable AI gateway in the admin
// without a redeploy. Both return the same structured Decision.
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import type { Decision, Settings, Usage } from "./types.ts";
import { CHANGEABLE_TERMS, CLASSIFICATIONS } from "./types.ts";
import { DECISION_SCHEMA } from "./prompt.ts";

export interface LlmInput {
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  userTurn: string; // state block + team message
}

export interface LlmResult {
  decision: Decision;
  usage: Usage;
  provider: string;
  model: string;
  raw?: string;
  refused?: boolean;
}

/** The only Anthropic models the room may use. Haiku is the default. */
export const ANTHROPIC_MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5"] as const;
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";
export const isAllowedAnthropicModel = (model: unknown): model is (typeof ANTHROPIC_MODELS)[number] =>
  typeof model === "string" && (ANTHROPIC_MODELS as readonly string[]).includes(model);

/** USD per million tokens. Used for the cost shown in the admin. Unknown models show tokens only. */
export const MODEL_PRICES: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cache_read: 0.01, cache_write: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cache_read: 0.2, cache_write: 2.5 },
};

export const estimateCostUsd = (model: string, u: Usage): number | null => {
  const p = MODEL_PRICES[model];
  if (!p) return null;
  const usd =
    (u.input_tokens * p.input + u.output_tokens * p.output + u.cache_read_tokens * p.cache_read + u.cache_write_tokens * p.cache_write) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
};

const emptyUsage = (): Usage => ({ input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 });

const parseTermChanges = (raw: unknown): Decision["term_changes"] => {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Decision["term_changes"] = {};
  for (const key of CHANGEABLE_TERMS) if (typeof src[key] === "string" && src[key]) out[key] = src[key] as string;
  return out;
};

/** Validates and normalises whatever JSON the model produced. */
export const parseDecision = (text: string): Decision => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Model did not return JSON");
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const cls = String(raw.classification ?? "off_topic");
  // Model-facing names are offer_special / special_response (never "trap"); older names still accepted
  const tr = String(raw.special_response ?? raw.trap_response ?? "none");
  return {
    classification: (CLASSIFICATIONS as readonly string[]).includes(cls) ? (cls as Decision["classification"]) : "off_topic",
    concession_pct: Number(raw.concession_pct) || 0,
    concession_reason: typeof raw.concession_reason === "string" ? raw.concession_reason : "",
    drop_guarantee: raw.drop_guarantee === true,
    term_changes: parseTermChanges(raw.changed_terms),
    offer_trap: raw.offer_special === true || raw.offer_trap === true,
    trap_response: tr === "accepts" || tr === "refuses" ? tr : "none",
    reply: typeof raw.reply === "string" && raw.reply.trim() ? raw.reply.trim() : "Let's talk business. What do you need from us?",
  };
};

/** In-character fallback when the model refuses or returns garbage: no concession, back to business. */
export const fallbackDecision = (): Decision => ({
  classification: "off_topic",
  concession_pct: 0,
  concession_reason: "",
  drop_guarantee: false,
  term_changes: {},
  offer_trap: false,
  trap_response: "none",
  reply: "Nice try, amigo. Let's talk business: what do you need from us for your 20 tonnes?",
});

// ---------------------------------------------------------------------------
// Anthropic API
// ---------------------------------------------------------------------------
const anthropicCall = async (settings: Settings, input: LlmInput): Promise<LlmResult> => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const client = new Anthropic({ apiKey });
  // Anything outside the allowed list (e.g. an old setting) falls back to Haiku
  const model = isAllowedAnthropicModel(settings.llm_model) ? settings.llm_model : DEFAULT_ANTHROPIC_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
    messages: [...input.history, { role: "user", content: input.userTurn }],
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: DECISION_SCHEMA as unknown as Record<string, unknown> },
    },
  });

  const usage: Usage = {
    input_tokens: response.usage.input_tokens ?? 0,
    output_tokens: response.usage.output_tokens ?? 0,
    cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: response.usage.cache_creation_input_tokens ?? 0,
  };

  if (response.stop_reason === "refusal") {
    return { decision: fallbackDecision(), usage, provider: "anthropic", model, refused: true };
  }
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return { decision: parseDecision(text), usage, provider: "anthropic", model, raw: text };
  } catch (err) {
    console.log(`anthropic: unparsable output: ${(err as Error).message}`);
    return { decision: fallbackDecision(), usage, provider: "anthropic", model, raw: text };
  }
};

// ---------------------------------------------------------------------------
// Lovable AI gateway (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------
const lovableCall = async (settings: Settings, input: LlmInput): Promise<LlmResult> => {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const model = settings.llm_model || "google/gemini-3.7-flash";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: input.system },
        ...input.history,
        { role: "user", content: input.userTurn },
      ],
      response_format: { type: "json_schema", json_schema: { name: "negotiation_decision", schema: DECISION_SCHEMA, strict: true } },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lovable AI gateway ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const usage: Usage = {
    input_tokens: Number(data?.usage?.prompt_tokens ?? 0),
    output_tokens: Number(data?.usage?.completion_tokens ?? 0),
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };
  try {
    return { decision: parseDecision(text), usage, provider: "lovable", model, raw: text };
  } catch (err) {
    console.log(`lovable: unparsable output: ${(err as Error).message}`);
    return { decision: fallbackDecision(), usage, provider: "lovable", model, raw: text };
  }
};

export const callLlm = (settings: Settings, input: LlmInput): Promise<LlmResult> =>
  settings.llm_provider === "lovable" ? lovableCall(settings, input) : anthropicCall(settings, input);

/** Which secrets are present, so the admin can see what a provider switch needs. */
export const providerStatus = () => ({
  anthropic: !!Deno.env.get("ANTHROPIC_API_KEY"),
  lovable: !!Deno.env.get("LOVABLE_API_KEY"),
});

export { emptyUsage };
