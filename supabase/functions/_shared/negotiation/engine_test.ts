// Calibration checks from the specification, section 1 ("set up correctly when"):
//   deno test supabase/functions/_shared/negotiation/engine_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { applyDecision, currentOffer, freshConversation, mentionsTrap, moveLimits, neutralisePrompt, neutraliseReply, offerFooter, priceRegex, trapAllowed } from "./engine.ts";
import { stateBlock, systemPrompt } from "./prompt.ts";
import type { Conversation, Decision, Supplier } from "./types.ts";

const supplierA: Supplier = {
  key: "A", name: "Milho Dourado", region: "", qualified: true, enabled: true, sort_order: 1,
  initial_price: 3400, min_price: 2900, alt_min_price: 2800, alt_min_condition: "no guarantee", trap: null,
  persona: "", weak_spots: [], fixed_facts: "", concession_weak_spot_pct: 5,
  proposal_intro: "", proposal_specs: [], proposal_documents: "",
  offer_terms: { quantity: "20 t in one delivery", delivery: "2 weeks", payment: "30/70", guarantee: "replacement within 7 days" },
  site_content: {}, materials: [],
};
const supplierD: Supplier = {
  ...supplierA, key: "D", initial_price: 2900, min_price: 2650, alt_min_price: null, alt_min_condition: null, concession_weak_spot_pct: 6,
  trap: { price: 2400, offer_text: "cheaper carrier", term_key: "delivery", term_value: "4 weeks", breaks: "3 weeks" },
  offer_terms: { quantity: "20 t in one delivery", delivery: "21 days", payment: "50/50", guarantee: "none" },
};

const conv = (s: Supplier): Conversation => ({ ...freshConversation("t", s), id: "c", updated_at: "" });
const decision = (partial: Partial<Decision>): Decision => ({
  classification: "no_argument", concession_pct: 0, concession_reason: "", drop_guarantee: false, term_changes: {}, offer_trap: false, trap_response: "none", reply: "", ...partial,
});

Deno.test("discount-only team stays close to the initial price after 6 messages", () => {
  let c = conv(supplierA);
  for (let i = 0; i < 6; i++) c = applyDecision(supplierA, c, decision({ classification: "no_argument", concession_pct: 10 })).next;
  assert(c.current_price >= 3400 * 0.93, `price ${c.current_price} dropped too far`);
  assert(!c.final_price_reached);
});

Deno.test("team with weak-spot arguments reaches the minimum in 4-5 messages, never below it", () => {
  let c = conv(supplierA);
  let steps = 0;
  const seen: number[] = [];
  while (!c.final_price_reached && steps < 10) {
    const before = c.current_price;
    c = applyDecision(supplierA, c, decision({ classification: "weak_spot", concession_pct: 7 })).next;
    assert(c.current_price <= before, "price must never go up");
    assert(c.current_price >= 2900, `price ${c.current_price} below minimum`);
    seen.push(c.current_price);
    steps++;
  }
  assertEquals(c.current_price, 2900);
  assert(steps >= 3 && steps <= 5, `reached minimum in ${steps} steps (${seen.join(" > ")})`);
  // At the minimum nothing more is possible
  const more = applyDecision(supplierA, c, decision({ classification: "weak_spot", concession_pct: 7 }));
  assertEquals(more.new_price, 2900);
  assertEquals(more.applied_pct, 0);
  assert(moveLimits(supplierA, c).at_final_price);
});

Deno.test("pressure, probing and questions earn nothing", () => {
  for (const cls of ["pressure_or_insult", "probe_rules", "question_facts", "off_topic", "accept_attempt", "ask_fix_shortcoming"] as const) {
    const r = applyDecision(supplierA, conv(supplierA), decision({ classification: cls, concession_pct: 5 }));
    assertEquals(r.new_price, 3400, cls);
  }
});

Deno.test("supplier A goes to 2 800 only when the guarantee is dropped", () => {
  let c = conv(supplierA);
  while (!c.final_price_reached) c = applyDecision(supplierA, c, decision({ classification: "weak_spot", concession_pct: 7 })).next;
  assertEquals(c.current_price, 2900);
  const dropped = applyDecision(supplierA, c, decision({ classification: "counter_offer", concession_pct: 5, drop_guarantee: true }));
  assert(dropped.guarantee_dropped_now);
  assert(dropped.new_price < 2900 && dropped.new_price >= 2800, `got ${dropped.new_price}`);
  assertEquals(currentOffer(supplierA, dropped.next).terms.guarantee, "no replacement guarantee");
});

Deno.test("trap only near the minimum; refusing it restores the regular price", () => {
  let c = conv(supplierD);
  assert(!trapAllowed(supplierD, c), "trap must not be allowed at the initial price");
  const early = applyDecision(supplierD, c, decision({ classification: "no_argument", concession_pct: 1, offer_trap: true }));
  assert(!early.trap_offered_now && !early.next.trap_on_table);
  while (!trapAllowed(supplierD, c)) c = applyDecision(supplierD, c, decision({ classification: "weak_spot", concession_pct: 6 })).next;
  const offered = applyDecision(supplierD, c, decision({ classification: "no_argument", concession_pct: 1, offer_trap: true }));
  assert(offered.trap_offered_now);
  const offer = currentOffer(supplierD, offered.next);
  assertEquals(offer.price, 2400);
  assert(offer.is_trap);
  assertEquals(offer.terms.delivery, "4 weeks");
  assert(offerFooter(offer).startsWith("Current offer: 2 400 USD/t"));
  const refused = applyDecision(supplierD, offered.next, decision({ classification: "off_topic", trap_response: "refuses" }), "Understood, back to our regular price. The 2 400 with 4 weeks is off.");
  assert(!refused.next.trap_on_table, "a refusal turn that mentions the old offer must not put it back");
  assert(!currentOffer(supplierD, refused.next).is_trap);
  assertEquals(currentOffer(supplierD, refused.next).price, refused.next.current_price);
  // Not offered again unless the supplier explicitly presents it again (then the offer follows the text)
  const quiet = applyDecision(supplierD, refused.next, decision({ classification: "no_argument", concession_pct: 1 }), "Our final price is 2 650.");
  assert(!quiet.next.trap_on_table);
});

const supplierE: Supplier = {
  ...supplierA, key: "E", initial_price: 3100, min_price: 2550, alt_min_price: null, alt_min_condition: null, concession_weak_spot_pct: 7,
  trap: { price: 2450, offer_text: "we could go to {{TRAP_PRICE}} USD per tonne if we ship in two consignments of 10 t", term_key: "quantity", term_value: "20 t in two consignments of 10 t", breaks: "3.3.1" },
  offer_terms: { quantity: "20 t in one delivery", delivery: "10 days", payment: "no advance", guarantee: "14 days" },
};

Deno.test("trap written only in the reply text still updates the offer on the table", () => {
  let c = conv(supplierE);
  while (!trapAllowed(supplierE, c)) c = applyDecision(supplierE, c, decision({ classification: "weak_spot", concession_pct: 7 })).next;
  const text = "Because you sign today, 2 550 is our price. If it helps, we could go to 2 450 USD per tonne if we ship in two consignments of 10 t.";
  const r = applyDecision(supplierE, c, decision({ classification: "weak_spot", concession_pct: 3, offer_trap: false }), text);
  assert(r.next.trap_on_table, "offer must follow what the supplier wrote");
  assert(r.trap_on_table_now);
  const offer = currentOffer(supplierE, r.next);
  assertEquals(offer.price, 2450);
  assertEquals(offer.terms.quantity, "20 t in two consignments of 10 t");
  // Same text far from the minimum (the model was not told about it) is ignored
  const early = applyDecision(supplierE, conv(supplierE), decision({ classification: "weak_spot", concession_pct: 3 }), text);
  assert(!early.next.trap_on_table);
});

Deno.test("trap detection needs the price and the condition", () => {
  assert(mentionsTrap(supplierE, "2,450 USD/t in two consignments"));
  assert(mentionsTrap(supplierE, "2450 if we split it into two consignments"));
  assert(mentionsTrap(supplierE, "we could go to {{TRAP_PRICE}} per tonne"));
  assert(!mentionsTrap(supplierE, "2 450 is not possible for us"), "price without the condition is not an offer");
  assert(!mentionsTrap(supplierE, "two consignments are possible at 2 550"), "condition without the trap price is not the offer");
  assert(!mentionsTrap(supplierE, "12 450 USD in total, two consignments"), "a different number containing the digits must not match");
  assert(priceRegex(2450).test("2\u00a0450"));
});

Deno.test("players never read the word trap", () => {
  assertEquals(neutraliseReply("This is not a trap, my friend. Trap? No! No traps here."), "This is not a trick, my friend. Trick? No! No tricks here.");
  const prompt = neutralisePrompt("TRAP (only if your profile has one)\n- present the trap offer once. If the team refuses the trap, continue. lower trap price");
  assert(!/trap/i.test(prompt), prompt);
});

Deno.test("system prompt never contains the trap; the state block reveals it only when allowed", () => {
  const settings = { is_open: true, max_messages: 10, llm_provider: "anthropic" as const, llm_model: "claude-haiku-5-5", rules_prompt: "TRAP (only if your profile has one)\n- Only when the system says so, present the trap offer once." };
  const s: Supplier = { ...supplierE, persona: "Personality: warm.\nTrap: when the system allows it, offer two consignments for the lower trap price." };
  const sys = systemPrompt(settings, s);
  assert(!/trap/i.test(sys), "no 'trap' wording in the system prompt");
  assert(!/2[ ,.]?450/.test(sys) && !/consignments/i.test(sys), "no trap price or condition in the system prompt");
  let c = conv(s);
  const early = stateBlock(settings, s, c, "hi");
  assert(!/special offer|2[ ,.]?450|consignments|trap/i.test(early), early);
  while (!trapAllowed(s, c)) c = applyDecision(s, c, decision({ classification: "weak_spot", concession_pct: 7 })).next;
  const allowed = stateBlock(settings, s, c, "cheaper please");
  assert(/SPECIAL OFFER AVAILABLE/.test(allowed) && /2 450/.test(allowed) && /consignments/.test(allowed), allowed);
  assert(!/trap/i.test(allowed), allowed);
});

Deno.test("concession is capped by the classification, not by what the model asks for", () => {
  const r = applyDecision(supplierA, conv(supplierA), decision({ classification: "no_argument", concession_pct: 40 }));
  assertEquals(r.new_price, 3370); // 1 % of 3 400, rounded to 10
  const r2 = applyDecision(supplierA, conv(supplierA), decision({ classification: "competing_offer", concession_pct: 40 }));
  assertEquals(r2.new_price, 3330); // 2 %
});

Deno.test("an agreed term change shows in the offer and stays, unknown keys are ignored", () => {
  let c = conv(supplierA);
  c = applyDecision(supplierA, c, decision({ term_changes: { payment: " 50 %  advance, 50 % after acceptance " } })).next;
  assertEquals(currentOffer(supplierA, c).terms.payment, "50 % advance, 50 % after acceptance");
  assert(offerFooter(currentOffer(supplierA, c)).includes("50 % advance"));
  c = applyDecision(supplierA, c, decision({ term_changes: { payment: "", guarantee: "none" } as Decision["term_changes"] })).next;
  assertEquals(currentOffer(supplierA, c).terms.payment, "50 % advance, 50 % after acceptance");
  assertEquals(currentOffer(supplierA, c).terms.guarantee, "replacement within 7 days");
});

Deno.test("the trap term still wins over an agreed change of the same term", () => {
  const c = { ...conv(supplierD), term_overrides: { delivery: "1 week" }, trap_on_table: true };
  assertEquals(currentOffer(supplierD, c).terms.delivery, "4 weeks");
});
