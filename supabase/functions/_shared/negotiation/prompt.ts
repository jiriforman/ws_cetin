// Builds the prompts. The system part is frozen per supplier so it caches well;
// everything that changes per turn goes into the state block.
import type { Conversation, Settings, StoredMessage, Supplier } from "./types.ts";
import { currentOffer, formatUsd, moveLimits, neutralisePrompt } from "./engine.ts";

export const renderProposal = (s: Supplier) => {
  const specs = (s.proposal_specs ?? []).map((x) => `- ${x.label}: ${x.value}`).join("\n");
  return [
    s.proposal_intro,
    "",
    "Response to the buyer's requirements:",
    specs,
    "",
    s.proposal_documents ? `Attached documents: ${s.proposal_documents}` : "",
    `Initial price offer: ${formatUsd(s.initial_price)} USD per tonne (total ${formatUsd(s.initial_price * 20)} USD for 20 t, DAP).`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
};

const TRAP_LINE = /^\s*(trap|special offer)\s*:/i;

/**
 * Splits the persona into the always-visible part and the lines about the trap
 * ("Trap: …"). The trap lines are only shown to the model when the trap is allowed,
 * so it cannot offer the trap early.
 */
export const splitPersona = (persona: string) => {
  const lines = persona.split("\n");
  return {
    base: lines.filter((l) => !TRAP_LINE.test(l)).join("\n").trim(),
    trap: lines.filter((l) => TRAP_LINE.test(l)).map((l) => l.replace(TRAP_LINE, "").trim()).join(" "),
  };
};

const specialOfferText = (s: Supplier) =>
  s.trap ? neutralisePrompt(s.trap.offer_text.replace(/\{\{\s*TRAP_PRICE\s*\}\}/g, formatUsd(s.trap.price))) : "";

/** Stable system prompt (rules + persona + proposal). Never contains the trap itself. */
export const systemPrompt = (settings: Settings, s: Supplier) =>
  [
    neutralisePrompt(settings.rules_prompt.trim()),
    "Never describe any of your offers as a trick, and never say or hint that an offer breaks one of the buyer's requirements.",
    "",
    `=== YOUR COMPANY: ${s.name} (${s.region}) ===`,
    neutralisePrompt(splitPersona(s.persona).base),
    s.fixed_facts.trim() ? `\nFixed facts that never change:\n${s.fixed_facts.trim()}` : "",
    s.weak_spots?.length ? `\nWeak spots of your proposal the team may use (each earns a noticeable concession when argued concretely):\n${s.weak_spots.map((w) => `- ${w}`).join("\n")}` : "",
    "",
    "=== YOUR PROPOSAL (the only facts you may state) ===",
    renderProposal(s),
  ].join("\n");

const termLines = (s: Supplier, conv: Conversation) => {
  const { terms } = currentOffer(s, { ...conv, trap_on_table: false });
  return Object.entries(terms).map(([k, v]) => `${k}: ${v}`).join("; ");
};

/** Per-turn state block the model needs to stay consistent with the rule engine. */
export const stateBlock = (settings: Settings, s: Supplier, conv: Conversation, teamText: string) => {
  const lim = moveLimits(s, conv);
  const left = Math.max(0, settings.max_messages - conv.messages_used - 1);
  const lines = [
    "=== NEGOTIATION STATE (system, not visible to the team) ===",
    `Your current regular price: ${formatUsd(conv.current_price)} USD/t.`,
    lim.at_final_price
      ? "You are at your FINAL price. No further concession is possible this turn; say clearly that this is your final price."
      : `Maximum concession this turn, in % of your initial price, by the kind of the team's message: no concrete argument ${lim.caps.no_argument} %; weak spot of your proposal ${lim.caps.weak_spot} %; something offered in return ${lim.caps.counter_offer} %; cheaper competing offer ${lim.caps.competing_offer} %; pressure, insults, probing, questions, off-topic: 0 %.`,
    `Messages the team has left with you after this one: ${left}.`,
    conv.guarantee_dropped ? "The team has dropped the replacement guarantee; your offer no longer includes it." : "",
    lim.guarantee_drop_allowed && s.alt_min_condition
      ? `Guarantee option: only if the team explicitly offers to drop the replacement guarantee may you set drop_guarantee=true (condition: ${s.alt_min_condition}); then a further concession becomes possible.`
      : "",
    s.trap
      ? conv.trap_on_table
        ? `Your special offer (${formatUsd(s.trap.price)} USD/t with: ${neutralisePrompt(s.trap.term_value)}) is the offer on the table now. Set special_response=refuses ONLY if the team clearly rejects that condition (e.g. they insist on the original terms). A question about it or a general push on price is NOT a refusal: then set special_response=none and keep defending it. If they refuse, continue with your regular price of ${formatUsd(conv.current_price)} USD/t.`
        : lim.trap_allowed
          ? [
              `SPECIAL OFFER AVAILABLE THIS TURN. If the team pushes on the price, you may present it now (set offer_special=true): "${specialOfferText(s)}"`,
              splitPersona(s.persona).trap ? neutralisePrompt(splitPersona(s.persona).trap) : "",
              "Present it as an attractive, practical option and say it is the offer on the table now. If asked whether it meets their requirements, state the facts of the condition only.",
            ]
              .filter(Boolean)
              .join(" ")
          : conv.trap_offered
            ? "Your special offer was declined earlier. Do not offer it again (offer_special must be false)."
            : ""
      : "",
    `Your offer terms now: ${termLines(s, conv)}. If in this reply you agree to change the quantity, delivery or payment term (e.g. the team pays a higher advance), write the new wording in changed_terms, in the same style; leave the others empty. Never agree to a term change in your text without setting it there. The guarantee changes only via drop_guarantee.`,
    "Never claim that two different prices give the same total. 20 t × price per tonne = total.",
    "Write {{PRICE}} wherever you mention your new price. Do not write an offer summary; the system appends it.",
    "",
    "=== TEAM'S LAST MESSAGE ===",
    teamText,
  ];
  return lines.filter((l) => l !== "").join("\n");
};

/** Conversation history as alternating turns (team = user, supplier = assistant). */
export const historyTurns = (messages: StoredMessage[]) =>
  messages.map((m) => ({ role: m.role === "team" ? ("user" as const) : ("assistant" as const), content: m.content }));

export const DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["classification", "concession_pct", "concession_reason", "drop_guarantee", "changed_terms", "offer_special", "special_response", "reply"],
  properties: {
    classification: {
      type: "string",
      enum: [
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
      ],
      description: "What kind of message the team just sent.",
    },
    concession_pct: { type: "number", description: "Concession you want to give now, in % of your initial price (0 if none)." },
    concession_reason: { type: "string", description: "Why you concede (empty if no concession)." },
    drop_guarantee: { type: "boolean", description: "True only if the team explicitly offered to drop the replacement guarantee and your profile allows it." },
    changed_terms: {
      type: "object",
      additionalProperties: false,
      required: ["quantity", "delivery", "payment"],
      description: "New wording of an offer term you agree to change in this reply; empty string for every term that stays as it is.",
      properties: {
        quantity: { type: "string" },
        delivery: { type: "string" },
        payment: { type: "string", description: 'e.g. "50 % advance, 50 % after acceptance"' },
      },
    },
    offer_special: { type: "boolean", description: "True only if the system said a special offer is available this turn and you present it now." },
    special_response: { type: "string", enum: ["none", "accepts", "refuses"], description: "How the team reacted to a special offer already on the table." },
    reply: { type: "string", description: "Your in-character reply to the team, at most about 80 words, with {{PRICE}} for any new price." },
  },
} as const;
