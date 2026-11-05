-- Persistent log of every AI call of the Negotiation Room (team chats and admin test chats).
-- "Reset all" and the per-team resets delete chats and messages but never this log, so the
-- total cost stays visible across workshops. Per-team costs are still taken from the
-- current chats and therefore reset.
create table if not exists public.negotiation_cost_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'team' check (source in ('team', 'test')),
  team_id text,
  supplier_key text,
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric
);
create index if not exists negotiation_cost_log_created_idx on public.negotiation_cost_log (created_at);

alter table public.negotiation_cost_log enable row level security;
revoke all on public.negotiation_cost_log from anon, authenticated;

-- Backfill once from the chats that exist now, so nothing spent so far is lost
insert into public.negotiation_cost_log
  (created_at, source, team_id, supplier_key, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
select m.created_at, 'team', c.team_id, c.supplier_key, m.meta->>'provider', m.meta->>'model',
  coalesce((m.meta->'usage'->>'input_tokens')::int, 0), coalesce((m.meta->'usage'->>'output_tokens')::int, 0),
  coalesce((m.meta->'usage'->>'cache_read_tokens')::int, 0), coalesce((m.meta->'usage'->>'cache_write_tokens')::int, 0),
  nullif(m.meta->>'cost_usd', '')::numeric
from public.negotiation_messages m
join public.negotiation_conversations c on c.id = m.conversation_id
where m.role = 'supplier' and m.meta ? 'usage'
  and not exists (select 1 from public.negotiation_cost_log);
