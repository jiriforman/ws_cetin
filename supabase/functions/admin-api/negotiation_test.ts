// deno test supabase/functions/admin-api/negotiation_test.ts
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { costSummary, handleNegotiationAction } from "./negotiation.ts";
import { NEGOTIATION_API_VERSION } from "../_shared/negotiation/version.ts";

/** Minimal stand-in for the Supabase query builder: records deletes/updates, resolves with rows. */
const mockSupabase = (rows: Record<string, unknown[]>) => {
  const calls: string[] = [];
  const builder = (table: string) => {
    let op = "select";
    const b: Record<string, unknown> = {
      select: () => b,
      delete: () => ((op = "delete"), calls.push(`delete ${table}`), b),
      update: () => ((op = "update"), calls.push(`update ${table}`), b),
      insert: () => ((op = "insert"), calls.push(`insert ${table}`), b),
      eq: () => b,
      not: () => b,
      order: () => b,
      maybeSingle: () => b,
      then: (resolve: (v: unknown) => void) => resolve({ data: op === "select" ? rows[table] ?? [] : null, error: null }),
    };
    return b;
  };
  return { client: { from: builder } as never, calls };
};

Deno.test("negotiation-reset-all needs RESET and deletes chats, messages and deals", async () => {
  const { client, calls } = mockSupabase({ negotiation_conversations: [{ id: "a" }, { id: "b" }], negotiation_deals: [{ team_id: "t" }] });
  await assertRejects(() => handleNegotiationAction("negotiation-reset-all", { confirm: "reset" }, client));
  const res = (await handleNegotiationAction("negotiation-reset-all", { confirm: "RESET", close_room: true }, client)) as Record<string, unknown>;
  assert(res, "action must be known (not null = no 'Unknown action')");
  assertEquals(res.deleted, { conversations: 2, deals: 1 });
  for (const t of ["negotiation_deals", "negotiation_messages", "negotiation_conversations"]) assert(calls.includes(`delete ${t}`), t);
  assert(!calls.some((c) => c.includes("negotiation_cost_log")), "the persistent cost log is never touched by a reset");
  assert(calls.includes("update negotiation_settings"), "room closed");
});

Deno.test("negotiation-version reports the shared version", async () => {
  const { client } = mockSupabase({});
  assertEquals(await handleNegotiationAction("negotiation-version", {}, client), { api_version: NEGOTIATION_API_VERSION });
  assertEquals(await handleNegotiationAction("negotiation-nope", {}, client), null);
});

Deno.test("total cost is all time (cost log), per-team cost only covers the current chats", () => {
  const meta = (cost: number) => ({ usage: { input_tokens: 100, output_tokens: 10, cache_read_tokens: 0, cache_write_tokens: 0 }, cost_usd: cost, provider: "anthropic", model: "claude-haiku-5-5" });
  const messages = [{ meta: meta(0.001), conversation_id: "c1" }];
  const convByTeam = new Map([["c1", "t1"]]);
  const log = [
    { source: "team" as const, team_id: "t1", supplier_key: "E", provider: "anthropic", model: "claude-haiku-5-5", input_tokens: 100, output_tokens: 10, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0.004 },
    { source: "test" as const, team_id: null, supplier_key: "E", provider: "anthropic", model: "claude-haiku-5-5", input_tokens: 100, output_tokens: 10, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0.002 },
  ];
  const s = costSummary(messages, convByTeam, log);
  assert(s.persistent);
  assertEquals(s.total.calls, 2);
  assertEquals(Math.round((s.total.cost_usd ?? 0) * 1e6), 6000);
  assertEquals(Math.round((s.by_team.t1.cost_usd ?? 0) * 1e6), 1000);
  // Without the cost log table: falls back to the current chats
  const fallback = costSummary(messages, convByTeam, null);
  assert(!fallback.persistent);
  assertEquals(fallback.total.calls, 1);
});
