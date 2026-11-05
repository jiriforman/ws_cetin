// Types and helpers for the Negotiation Room (supplier chat). Mirrors supabase/functions/_shared/negotiation.

export interface Spec {
  label: string;
  value: string;
}

export interface SiteHighlight {
  title: string;
  text: string;
}

export interface SiteStat {
  value: string;
  label: string;
}

export interface SiteContent {
  tagline?: string;
  about?: string[];
  highlights?: SiteHighlight[];
  stats?: SiteStat[];
  contact?: { city?: string; email?: string; phone?: string };
  since?: string;
  theme?: { palette?: string; font?: string; hero?: string };
}

export interface Material {
  label: string;
  url: string;
}

/** What a team may see about a supplier. */
export interface PublicSupplier {
  key: string;
  name: string;
  region: string;
  sort_order: number;
  initial_price: number;
  proposal_intro: string;
  proposal_specs: Spec[];
  proposal_documents: string;
  offer_terms: Record<string, string>;
  site_content: SiteContent;
  materials: Material[];
}

export interface SupplierTrap {
  price: number;
  offer_text: string;
  term_key: string;
  term_value: string;
  breaks: string;
}

/** The full supplier row (admin only). */
export interface Supplier extends PublicSupplier {
  qualified: boolean;
  enabled: boolean;
  min_price: number;
  alt_min_price: number | null;
  alt_min_condition: string | null;
  trap: SupplierTrap | null;
  persona: string;
  weak_spots: string[];
  fixed_facts: string;
  concession_weak_spot_pct: number;
  updated_at?: string;
}

export interface Offer {
  price: number;
  terms: Record<string, string>;
  /** Admin only: the team API never sends it. */
  is_trap?: boolean;
  is_final: boolean;
}

/** What a team sees of one conversation (no trap information). */
export interface ConversationView {
  supplier_key: string;
  messages_used: number;
  offer: Offer;
  guarantee_dropped: boolean;
  in_flight: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'team' | 'supplier';
  content: string;
  price_after: number | null;
  created_at: string;
}

export interface PublicDeal {
  team_id: string;
  supplier_key: string;
  price: number;
  conditions: Record<string, unknown>;
  accepted_at: string;
}

export interface Deal extends PublicDeal {
  is_trap: boolean;
  is_valid: boolean;
}

export interface TeamState {
  team: { id: string; name: string; logo_url: string | null };
  settings: { is_open: boolean; max_messages: number };
  deal: PublicDeal | null;
  suppliers: PublicSupplier[];
  conversations: ConversationView[];
}

export interface Settings {
  is_open: boolean;
  max_messages: number;
  llm_provider: 'anthropic' | 'lovable';
  llm_model: string;
  rules_prompt: string;
}

export interface CostRow {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number | null;
}

export interface AdminConversation {
  id: string;
  team_id: string;
  supplier_key: string;
  messages_used: number;
  current_price: number;
  guarantee_dropped: boolean;
  term_overrides?: Record<string, string>;
  trap_offered: boolean;
  trap_on_table: boolean;
  final_price_reached: boolean;
  in_flight: boolean;
  updated_at: string;
  offer: Offer | null;
}

export interface Overview {
  /** Missing on admin-api versions older than the version check. */
  api_version?: string;
  settings: Settings;
  providers: { anthropic: boolean; lovable: boolean };
  model_prices: Record<string, { input: number; output: number; cache_read: number; cache_write: number }>;
  suppliers: Supplier[];
  teams: { id: string; name: string; logo_url: string | null; status: string }[];
  deals: Deal[];
  conversations: AdminConversation[];
  /** total / by_model are all time (persistent log, never reset); by_team covers the current chats only. */
  cost: { total: CostRow; by_model: Record<string, CostRow>; by_team: Record<string, CostRow>; persistent?: boolean };
}

export interface TranscriptMessage extends ChatMessage {
  conversation_id: string;
  meta: Record<string, unknown> | null;
}

/** The only models the admin can pick for the Anthropic provider (list prices, USD per million tokens). */
export const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', input: 0.1, output: 0.5, note: 'default · fastest, cheapest' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', input: 2, output: 10, note: 'sharper personas' },
] as const;
export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5';
export const isAllowedAnthropicModel = (model: string) => ANTHROPIC_MODELS.some((m) => m.id === model);

/** Must match supabase/functions/_shared/negotiation/version.ts; the admin warns when a deployed function differs. */
export const EXPECTED_API_VERSION = '2026-10-27.1';

/** The prompt to give Lovable when edge functions run older code than this frontend. */
export const REDEPLOY_PROMPT = 'Deploy all edge functions (admin-api, negotiation-api, team-codes) from the current main branch.';

/** Turns the old backend's "Unknown action" into something a facilitator can act on. */
export const explainApiError = (message: string) =>
  /unknown action/i.test(message)
    ? `The admin-api backend function is out of date and does not know this action yet. In Lovable, ask: "${REDEPLOY_PROMPT}"`
    : message;

/** Default chat limit per team and supplier (configurable in Admin → Negotiation → AI model & rules). */
export const DEFAULT_MAX_MESSAGES = 10;
export const MAX_MESSAGES_LIMIT = 50;

/**
 * Team token from whatever a player types or pastes into the portal login:
 * a bare token, "TOKEN: abc" copied from the team page, a full or partial team link,
 * or a portal / supplier-site link.
 */
export const tokenFromInput = (raw: string) => {
  let v = raw.trim().replace(/^["'`<]+|["'`>]+$/g, '').trim();
  v = v.replace(/^(team\s*)?(token|code)(\s*[:=]\s*|\s+)/i, '');
  const path = v.match(/(?:^|\/)(?:team|negotiation)\/([^/?#\s]+)/i);
  if (path) return decodeURIComponent(path[1]);
  if (/^[^\s/?#]+$/.test(v)) return v;
  return '';
};

export const LOVABLE_MODEL_HINT = 'e.g. google/gemini-3.7-flash or openai/gpt-5-mini';

/** Rough cost of one full workshop: every team spends every message with every supplier. */
export const estimateWorkshopCost = (teams: number, suppliers: number, maxMessages: number, input: number, output: number) => {
  const calls = teams * suppliers * maxMessages;
  const inputTokens = calls * 3000;
  const outputTokens = calls * 300;
  return { calls, usd: (inputTokens * input + outputTokens * output) / 1_000_000 };
};

export const formatUsd = (n: number) => n.toLocaleString('en-US').replace(/,/g, ' ');

export const formatCost = (usd: number | null) => (usd === null ? 'n/a' : usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`);

const TERM_ORDER = ['quantity', 'delivery', 'payment', 'guarantee'];
export const orderedTerms = (terms: Record<string, string>) => [
  ...TERM_ORDER.filter((k) => k in terms).map((k) => [k, terms[k]] as const),
  ...Object.keys(terms)
    .filter((k) => !TERM_ORDER.includes(k))
    .map((k) => [k, terms[k]] as const),
];

export const emptySupplier = (): Supplier => ({
  key: '',
  name: '',
  region: '',
  sort_order: 99,
  initial_price: 3000,
  min_price: 2600,
  alt_min_price: null,
  alt_min_condition: null,
  trap: null,
  qualified: true,
  enabled: true,
  persona: '',
  weak_spots: [],
  fixed_facts: '',
  concession_weak_spot_pct: 5,
  proposal_intro: '',
  proposal_specs: [],
  proposal_documents: '',
  offer_terms: { quantity: '20 t in one delivery', delivery: '2 weeks after signature', payment: '30 % advance, 70 % after acceptance', guarantee: 'replacement within 7 days' },
  site_content: {},
  materials: [],
});
