// Shared types for the Negotiation Room (used by negotiation-api and admin-api).

export interface SupplierTrap {
  price: number;
  offer_text: string;
  term_key: string; // which offer term the trap changes, e.g. "delivery"
  term_value: string; // the new value of that term, e.g. "4 weeks after signature"
  breaks: string; // which mandatory requirement it breaks (leaders only)
}

export interface Spec {
  label: string;
  value: string;
}

export interface Supplier {
  key: string;
  name: string;
  region: string;
  qualified: boolean;
  enabled: boolean;
  sort_order: number;
  initial_price: number;
  min_price: number;
  alt_min_price: number | null;
  alt_min_condition: string | null;
  trap: SupplierTrap | null;
  persona: string;
  weak_spots: string[];
  fixed_facts: string;
  concession_weak_spot_pct: number;
  proposal_intro: string;
  proposal_specs: Spec[];
  proposal_documents: string;
  offer_terms: Record<string, string>;
  site_content: Record<string, unknown>;
  materials: { label: string; url: string }[];
}

export interface Settings {
  is_open: boolean;
  max_messages: number;
  llm_provider: "anthropic" | "lovable";
  llm_model: string;
  rules_prompt: string;
}

export interface Conversation {
  id: string;
  team_id: string;
  supplier_key: string;
  messages_used: number;
  current_price: number;
  guarantee_dropped: boolean;
  /** Offer terms the supplier agreed to change (quantity / delivery / payment), over supplier.offer_terms. */
  term_overrides: Record<string, string>;
  trap_offered: boolean;
  trap_on_table: boolean;
  final_price_reached: boolean;
  in_flight: boolean;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  role: "team" | "supplier";
  content: string;
  price_after: number | null;
  created_at: string;
}

export const CLASSIFICATIONS = [
  "no_argument",
  "weak_spot",
  "counter_offer",
  "competing_offer",
  "pressure_or_insult",
  "probe_rules",
  "question_facts",
  "ask_fix_shortcoming",
  "off_topic",
  "accept_attempt",
  "greeting",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

/** Offer terms the model may change on request (the guarantee only goes via drop_guarantee). */
export const CHANGEABLE_TERMS = ["quantity", "delivery", "payment"] as const;
export type ChangeableTerm = (typeof CHANGEABLE_TERMS)[number];

/** What the model returns for one turn (before the rule engine clamps it). */
export interface Decision {
  classification: Classification;
  concession_pct: number;
  concession_reason: string;
  drop_guarantee: boolean;
  /** New wording of an offer term the supplier agrees to change this turn; empty = unchanged. */
  term_changes: Partial<Record<ChangeableTerm, string>>;
  offer_trap: boolean;
  trap_response: "none" | "accepts" | "refuses";
  reply: string;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

/** The offer as the team sees it: price + terms, after guarantee drop / trap. */
export interface Offer {
  price: number;
  terms: Record<string, string>;
  is_trap: boolean;
  is_final: boolean;
}
