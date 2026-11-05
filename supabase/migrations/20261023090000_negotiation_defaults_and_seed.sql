-- Negotiation Room: defaults (10 messages per supplier, Claude Haiku 5.5) and initial data.
-- Idempotent: safe on a database where the tables were created without data (as Lovable's
-- table-only migration did) and safe to run again. Never overwrites leaders' edits.

-- 10 messages per team and supplier by default (configurable in the admin)
alter table public.negotiation_settings alter column max_messages set default 10;
alter table public.negotiation_settings alter column llm_model set default 'claude-haiku-5-5';

-- Storage bucket for supplier materials
insert into storage.buckets (id, name, public)
values ('negotiation-materials', 'negotiation-materials', true)
on conflict (id) do nothing;

-- Settings row with the shared rules prompt (only fills what is missing)
insert into public.negotiation_settings (id, is_open, max_messages, llm_provider, llm_model, rules_prompt) values (
  true, false, 10, 'anthropic', 'claude-haiku-5-5',
$RULES$You play a supplier's sales representative in a procurement negotiation. Stay in character, keep replies short, never state a concrete price yourself (write {{PRICE}}), and return only the JSON object the system asks for. Replace this placeholder with your own scenario rules in /admin -> Negotiation.$RULES$
)
on conflict (id) do update set
  rules_prompt = case when public.negotiation_settings.rules_prompt = '' then excluded.rules_prompt else public.negotiation_settings.rules_prompt end;

-- Old default of 6 messages becomes 10; any other value set by the leaders stays
update public.negotiation_settings set max_messages = 10, updated_at = now() where max_messages = 6;

-- Only Claude Haiku 5.5 and Claude Sonnet 5.5 are allowed for the Anthropic provider
update public.negotiation_settings set llm_model = 'claude-haiku-5-5', updated_at = now()
where llm_provider = 'anthropic' and llm_model not in ('claude-haiku-5-5', 'claude-sonnet-5-5');


-- Scenario data (suppliers, prices, prompts) intentionally removed from this template.
-- Create suppliers in /admin -> Negotiation.

