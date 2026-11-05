// Rule engine: the model talks, this file decides the price.
// Every hard rule of the specification is enforced here, never by trusting the model.
import { CHANGEABLE_TERMS, type Classification, type Conversation, type Decision, type Offer, type Supplier } from "./types.ts";

/** Lowest price the supplier may reach in the current state. */
export const effectiveMin = (supplier: Supplier, conv: Pick<Conversation, "guarantee_dropped">) =>
  conv.guarantee_dropped && supplier.alt_min_price != null ? supplier.alt_min_price : supplier.min_price;

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

/** Maximum concession (in % of the initial price) a message of this kind can earn. */
export const concessionCap = (classification: Classification, supplier: Supplier): number => {
  const weak = Number(supplier.concession_weak_spot_pct) || 5;
  switch (classification) {
    case "no_argument":
      return 1;
    case "weak_spot":
    case "counter_offer":
      return weak;
    case "competing_offer":
      return Math.min(2, weak);
    default:
      return 0;
  }
};

/**
 * Whether the trap ("special offer" towards the model) may be presented on this turn:
 * only once, and only when the supplier is close to its minimum. Until then the model
 * is not told the trap exists, so it cannot offer it early.
 */
export const trapAllowed = (supplier: Supplier, conv: Conversation) => {
  if (!supplier.trap || conv.trap_offered) return false;
  return conv.current_price <= effectiveMin(supplier, conv) * 1.05;
};

const TRAP_KEYWORD_STOPWORDS = new Set(["after", "signature", "delivery", "days", "with", "from", "that", "this", "into", "only", "within", "tonnes"]);

/** Distinctive words of the trap condition, e.g. "consignments" or "carrier". */
export const trapKeywords = (supplier: Supplier) =>
  (supplier.trap?.term_value ?? "")
    .toLowerCase()
    .split(/[^a-z\u00c0-\u024f]+/)
    .filter((w) => w.length >= 4 && !TRAP_KEYWORD_STOPWORDS.has(w));

/** Regex matching a price however it is written: 2450, 2 450, 2,450, 2.450 (also with non-breaking spaces). */
export const priceRegex = (price: number) => {
  const s = String(Math.round(price));
  if (s.length <= 3) return new RegExp(`(?<![\\d])${s}(?![\\d])`);
  return new RegExp(`(?<![\\d])${s.slice(0, -3)}[\\s,.\u00a0\u202f]?${s.slice(-3)}(?![\\d])`);
};

/** Whether a supplier reply presents the trap: its price together with its condition (or the price token). */
export const mentionsTrap = (supplier: Supplier, reply: string) => {
  if (!supplier.trap) return false;
  if (/\{\{\s*TRAP_PRICE\s*\}\}/.test(reply)) return true;
  if (!priceRegex(supplier.trap.price).test(reply)) return false;
  const text = reply.toLowerCase();
  const words = trapKeywords(supplier);
  return words.length === 0 || words.some((w) => text.includes(w));
};

export interface MoveLimits {
  caps: Record<string, number>;
  trap_allowed: boolean;
  guarantee_drop_allowed: boolean;
  at_final_price: boolean;
  effective_min: number;
}

/** What the server will allow this turn; shown to the model so its text matches what happens. */
export const moveLimits = (supplier: Supplier, conv: Conversation): MoveLimits => {
  const min = effectiveMin(supplier, conv);
  return {
    caps: {
      no_argument: concessionCap("no_argument", supplier),
      weak_spot: concessionCap("weak_spot", supplier),
      counter_offer: concessionCap("counter_offer", supplier),
      competing_offer: concessionCap("competing_offer", supplier),
    },
    trap_allowed: trapAllowed(supplier, conv),
    guarantee_drop_allowed: supplier.alt_min_price != null && !conv.guarantee_dropped,
    at_final_price: conv.current_price <= min,
    effective_min: min,
  };
};

export interface Applied {
  next: Conversation;
  requested_pct: number;
  applied_pct: number;
  new_price: number;
  trap_offered_now: boolean;
  /** The trap was put on the table this turn (first time or again). */
  trap_on_table_now: boolean;
  guarantee_dropped_now: boolean;
}

/**
 * Applies the model's decision under the rules:
 * - at most one concession per message, capped by the message classification
 * - steps shrink near the minimum and snap to it; never below the (effective) minimum
 * - never above the previous offer
 * - trap only once, only when allowed; refusing a trap puts the regular price back
 */
export const applyDecision = (supplier: Supplier, conv: Conversation, decision: Decision, replyText = ""): Applied => {
  const next: Conversation = { ...conv };
  next.term_overrides = applyTermChanges(conv.term_overrides ?? {}, decision.term_changes);
  let guaranteeDroppedNow = false;
  if (decision.drop_guarantee && supplier.alt_min_price != null && !conv.guarantee_dropped) {
    next.guarantee_dropped = true;
    guaranteeDroppedNow = true;
  }

  // Team reacted to a trap already on the table
  const refusedNow = conv.trap_on_table && decision.trap_response === "refuses";
  if (refusedNow) next.trap_on_table = false;

  const initial = supplier.initial_price;
  const min = effectiveMin(supplier, next);
  const cap = concessionCap(decision.classification, supplier);
  const requested = Math.max(0, Math.min(Number(decision.concession_pct) || 0, 100));
  let pct = Math.min(requested, cap);

  let price = conv.current_price;
  const remaining = price - min;
  if (pct > 0 && remaining > 0) {
    let step = roundTo10((initial * pct) / 100);
    // Smaller steps as the minimum approaches
    if (remaining < 2 * step) step = Math.min(step, roundTo10(remaining * 0.6));
    step = Math.max(step, 10);
    step = Math.min(step, remaining);
    // Snap to the minimum when the rest would be a token amount
    if (remaining - step < initial * 0.015) step = remaining;
    price = price - step;
    pct = (step / initial) * 100;
  } else {
    pct = 0;
  }
  price = Math.min(price, conv.current_price); // never up
  price = Math.max(price, min); // never below minimum
  next.current_price = price;
  next.final_price_reached = price <= min;

  // Whatever the supplier presents is binding: if it offers the trap (flag or in its text),
  // the offer on the table becomes the trap. It can only do so once it has been told about
  // it (allowed now, or offered earlier in this chat).
  let trapNow = false;
  const presentable = !!supplier.trap && (trapAllowed(supplier, conv) || conv.trap_offered);
  const presented = decision.offer_trap || (!!replyText && mentionsTrap(supplier, replyText));
  if (presentable && presented && !refusedNow && !next.trap_on_table) {
    trapNow = !conv.trap_offered;
    next.trap_offered = true;
    next.trap_on_table = true;
  }

  return {
    next,
    requested_pct: requested,
    applied_pct: Math.round(pct * 100) / 100,
    new_price: price,
    trap_offered_now: trapNow,
    trap_on_table_now: next.trap_on_table && !conv.trap_on_table,
    guarantee_dropped_now: guaranteeDroppedNow,
  };
};

/** Merges the term changes the supplier agreed to this turn; only known keys, trimmed and length-capped. */
export const applyTermChanges = (current: Record<string, string>, changes: Decision["term_changes"] | undefined) => {
  const out = { ...current };
  for (const key of CHANGEABLE_TERMS) {
    const value = String(changes?.[key] ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (value) out[key] = value;
  }
  return out;
};

/** The offer the team would accept right now. */
export const currentOffer = (supplier: Supplier, conv: Conversation): Offer => {
  const terms: Record<string, string> = { ...supplier.offer_terms, ...(conv.term_overrides ?? {}) };
  if (conv.guarantee_dropped) terms.guarantee = "no replacement guarantee";
  const isTrap = conv.trap_on_table && !!supplier.trap;
  if (isTrap && supplier.trap) terms[supplier.trap.term_key] = supplier.trap.term_value;
  return {
    price: isTrap && supplier.trap ? supplier.trap.price : conv.current_price,
    terms,
    is_trap: isTrap,
    is_final: conv.final_price_reached,
  };
};

export const formatUsd = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ");

const TERM_ORDER = ["quantity", "delivery", "payment", "guarantee"];

/** Deterministic offer summary appended to every supplier reply. */
export const offerFooter = (offer: Offer) => {
  const keys = [...TERM_ORDER.filter((k) => k in offer.terms), ...Object.keys(offer.terms).filter((k) => !TERM_ORDER.includes(k))];
  const terms = keys.map((k) => offer.terms[k]).join(" · ");
  const final = offer.is_final && !offer.is_trap ? " (final)" : "";
  return `Current offer: ${formatUsd(offer.price)} USD/t${final} · ${terms}`;
};

/** Replaces the price tokens in the model's text with the real figures. */
export const fillPriceTokens = (reply: string, supplier: Supplier, applied: Applied) => {
  const price = formatUsd(applied.new_price);
  const trap = supplier.trap ? formatUsd(supplier.trap.price) : price;
  return reply
    .replace(/\{\{\s*PRICE\s*\}\}/g, price)
    .replace(/\{\{\s*TRAP_PRICE\s*\}\}/g, trap)
    .replace(/\s+$/g, "");
};

/** Players never see the word "trap": replaces it in supplier replies, keeping the capitalisation. */
export const neutraliseReply = (reply: string) =>
  reply.replace(/\b(trap)(s|ped|ping)?\b/gi, (_m, word: string, suffix = "") => {
    const map: Record<string, string> = { "": "trick", s: "tricks", ped: "tricked", ping: "tricking" };
    const out = map[String(suffix).toLowerCase()] ?? "trick";
    return word[0] === word[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
  });

/** Model-facing wording: the trap is only ever called a "special offer". */
export const neutralisePrompt = (text: string) =>
  text
    .replace(/\btrap offers?\b/gi, (m) => (m[0] === "T" && m[1] === "R" ? "SPECIAL OFFER" : "special offer"))
    .replace(/\btrap price\b/gi, "special price")
    .replace(/\bTRAP\b/g, "SPECIAL OFFER")
    .replace(/\btraps?\b/gi, "special offer");

/** Strips a model-written "Current offer" footer so it is not shown twice. */
export const stripModelFooter = (reply: string) =>
  reply.replace(/\n*\s*\*?\*?current offer:[^\n]*$/i, "").trim();

/** Default state of a brand-new conversation. */
export const freshConversation = (teamId: string, supplier: Supplier): Omit<Conversation, "id" | "updated_at"> => ({
  team_id: teamId,
  supplier_key: supplier.key,
  messages_used: 0,
  current_price: supplier.initial_price,
  guarantee_dropped: false,
  term_overrides: {},
  trap_offered: false,
  trap_on_table: false,
  final_price_reached: false,
  in_flight: false,
});
