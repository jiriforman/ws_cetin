// Persistent cost log (table negotiation_cost_log). Never deleted by resets.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface CostLogRow {
  source: "team" | "test";
  team_id: string | null;
  supplier_key: string | null;
  provider: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number | null;
}

/** Builds a log row from the meta of a supplier reply (see turn.ts). */
export const costRowFromMeta = (
  meta: Record<string, unknown>,
  source: CostLogRow["source"],
  team_id: string | null,
  supplier_key: string | null,
): CostLogRow => {
  const u = (meta.usage ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  return {
    source,
    team_id,
    supplier_key,
    provider: typeof meta.provider === "string" ? meta.provider : null,
    model: typeof meta.model === "string" ? meta.model : null,
    input_tokens: n(u.input_tokens),
    output_tokens: n(u.output_tokens),
    cache_read_tokens: n(u.cache_read_tokens),
    cache_write_tokens: n(u.cache_write_tokens),
    cost_usd: typeof meta.cost_usd === "number" ? meta.cost_usd : null,
  };
};

/** Records one AI call. Never fails the caller: if the table is missing, it only logs a warning. */
export const logCost = async (supabase: SupabaseClient, row: CostLogRow) => {
  try {
    const { error } = await supabase.from("negotiation_cost_log").insert(row);
    if (error) console.log(`cost log not written: ${error.message}`);
  } catch (err) {
    console.log(`cost log not written: ${err instanceof Error ? err.message : String(err)}`);
  }
};
