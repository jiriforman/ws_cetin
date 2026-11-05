-- Negotiation Room: offer terms the supplier agreed to change in the chat (e.g. a 50 % advance),
-- shown in the offer summary and stored with the deal. Safe to run more than once.

alter table public.negotiation_conversations
  add column if not exists term_overrides jsonb not null default '{}';
