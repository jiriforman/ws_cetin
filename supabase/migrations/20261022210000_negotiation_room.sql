-- Negotiation Room: AI-played corn suppliers the teams negotiate with (workshop phase 3).
-- All tables are reachable ONLY through the edge functions (service role). The anon key
-- gets no policies and no grants: supplier minimum prices, traps and qualification must
-- never be readable from the browser.

create table public.negotiation_suppliers (
  key text primary key,
  name text not null,
  region text not null default '',
  qualified boolean not null default true,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  initial_price integer not null,
  min_price integer not null,
  alt_min_price integer,
  alt_min_condition text,
  trap jsonb,
  persona text not null default '',
  weak_spots text[] not null default '{}',
  fixed_facts text not null default '',
  concession_weak_spot_pct numeric not null default 5,
  proposal_intro text not null default '',
  proposal_specs jsonb not null default '[]',
  proposal_documents text not null default '',
  offer_terms jsonb not null default '{}',
  site_content jsonb not null default '{}',
  materials jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.negotiation_settings (
  id boolean primary key default true check (id),
  is_open boolean not null default false,
  max_messages integer not null default 6,
  llm_provider text not null default 'anthropic' check (llm_provider in ('anthropic', 'lovable')),
  llm_model text not null default 'claude-haiku-5-5',
  rules_prompt text not null default '',
  updated_at timestamptz default now()
);

create table public.negotiation_conversations (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id) on delete cascade,
  supplier_key text not null references public.negotiation_suppliers(key) on delete cascade,
  messages_used integer not null default 0,
  current_price integer not null,
  guarantee_dropped boolean not null default false,
  trap_offered boolean not null default false,
  trap_on_table boolean not null default false,
  final_price_reached boolean not null default false,
  in_flight boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (team_id, supplier_key)
);

create table public.negotiation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.negotiation_conversations(id) on delete cascade,
  role text not null check (role in ('team', 'supplier')),
  content text not null,
  price_after integer,
  meta jsonb,
  created_at timestamptz default now()
);
create index negotiation_messages_conversation_idx on public.negotiation_messages (conversation_id, created_at);

create table public.negotiation_deals (
  team_id text primary key references public.teams(id) on delete cascade,
  supplier_key text not null references public.negotiation_suppliers(key) on delete cascade,
  price integer not null,
  conditions jsonb not null default '{}',
  is_trap boolean not null default false,
  is_valid boolean not null default true,
  accepted_at timestamptz default now()
);

alter table public.negotiation_suppliers enable row level security;
alter table public.negotiation_settings enable row level security;
alter table public.negotiation_conversations enable row level security;
alter table public.negotiation_messages enable row level security;
alter table public.negotiation_deals enable row level security;

revoke all on public.negotiation_suppliers, public.negotiation_settings, public.negotiation_conversations,
  public.negotiation_messages, public.negotiation_deals from anon, authenticated;

-- Supplier materials (certificates, photos) shown on the generated supplier websites.
insert into storage.buckets (id, name, public)
values ('negotiation-materials', 'negotiation-materials', true)
on conflict (id) do nothing;

create policy "Negotiation materials are publicly readable"
on storage.objects for select
using (bucket_id = 'negotiation-materials');

-- ---------------------------------------------------------------------------
-- Seed: shared behaviour rules (editable in the admin)
-- ---------------------------------------------------------------------------
insert into public.negotiation_settings (id, is_open, max_messages, llm_provider, llm_model, rules_prompt) values (
  true, false, 6, 'anthropic', 'claude-haiku-5-5',
$RULES$You play a supplier's sales representative in a procurement negotiation. Stay in character, keep replies short, never state a concrete price yourself (write {{PRICE}}), and return only the JSON object the system asks for. Replace this placeholder with your own scenario rules in /admin -> Negotiation.$RULES$
);

-- Scenario data (suppliers, prices, prompts) intentionally removed from this template.
-- Create suppliers in /admin -> Negotiation.

