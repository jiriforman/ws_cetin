// One negotiation turn: team message in, supplier reply + new offer out.
// Used by negotiation-api (persisted) and by the admin "test chat" (not persisted).
import type { Conversation, Settings, StoredMessage, Supplier } from "./types.ts";
import { applyDecision, currentOffer, fillPriceTokens, formatUsd, mentionsTrap, neutraliseReply, offerFooter, stripModelFooter } from "./engine.ts";
import { historyTurns, stateBlock, systemPrompt } from "./prompt.ts";
import { callLlm, estimateCostUsd } from "./llm.ts";

export interface TurnResult {
  reply: string; // reply text with the offer footer
  next: Conversation;
  meta: Record<string, unknown>;
}

export const runTurn = async (
  settings: Settings,
  supplier: Supplier,
  conv: Conversation,
  history: StoredMessage[],
  teamText: string,
): Promise<TurnResult> => {
  const started = Date.now();
  const result = await callLlm(settings, {
    system: systemPrompt(settings, supplier),
    history: historyTurns(history),
    userTurn: stateBlock(settings, supplier, conv, teamText),
  });

  const applied = applyDecision(supplier, conv, result.decision, result.decision.reply);
  const offer = currentOffer(supplier, applied.next);
  let body = fillPriceTokens(stripModelFooter(result.decision.reply), supplier, applied);
  // The offer on the table changed to the trap but the text does not say so: add the offer sentence
  if (applied.trap_on_table_now && supplier.trap && !mentionsTrap(supplier, body)) {
    body = `${body}\n\n${supplier.trap.offer_text.replace(/\{\{\s*TRAP_PRICE\s*\}\}/g, formatUsd(supplier.trap.price))}`;
  }
  body = neutraliseReply(body);
  const reply = `${body}\n\n${offerFooter(offer)}`;

  return {
    reply,
    next: applied.next,
    meta: {
      classification: result.decision.classification,
      requested_pct: applied.requested_pct,
      applied_pct: applied.applied_pct,
      concession_reason: result.decision.concession_reason,
      trap_offered_now: applied.trap_offered_now,
      trap_on_table_now: applied.trap_on_table_now,
      trap_response: result.decision.trap_response,
      guarantee_dropped_now: applied.guarantee_dropped_now,
      term_changes: result.decision.term_changes,
      offer,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      cost_usd: estimateCostUsd(result.model, result.usage),
      refused: result.refused ?? false,
      latency_ms: Date.now() - started,
    },
  };
};
