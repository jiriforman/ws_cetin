-- AI Arsenal: fixed set of 4 categories with an editable description (use cases) and order.
-- tools.category now holds a category id ('' = uncategorised, shown under "Other").
-- Publicly readable; writes (description, order) go through admin-api only.

create table if not exists public.tool_categories (
  id text primary key,
  name text not null,
  description text not null default '',
  display_order integer not null default 0
);

insert into public.tool_categories (id, name, description, display_order) values
  ('chat', 'Chat & Assistants',
   '<p>Your all-round sparring partner. Draft and rewrite emails, summarise long documents, brainstorm options, analyse data or stress-test your arguments.</p>', 1),
  ('research', 'Research & Knowledge',
   '<p>Turn sources into answers. Search the web or upload your documents to get cited summaries, compare sources and prepare a briefing in minutes.</p>', 2),
  ('create', 'Content & Media',
   '<p>Make it look good. Generate slide decks, visuals, diagrams, music and voice-overs to present your plan without a designer.</p>', 3),
  ('build', 'Prototyping & Automation',
   '<p>Make it real. Click together a working app or website prototype, and automate repetitive steps by connecting tools into workflows and agents.</p>', 4)
on conflict (id) do nothing;

alter table public.tool_categories enable row level security;
drop policy if exists "Anyone can read tool categories" on public.tool_categories;
create policy "Anyone can read tool categories" on public.tool_categories for select using (true);
revoke insert, update, delete, truncate on public.tool_categories from anon, authenticated;
grant select on public.tool_categories to anon, authenticated;

-- Map the free-text categories of the previous version onto the fixed ids
update public.tools set category = case
  when category = 'Chat & Assistants' then 'chat'
  when category = 'Research & Knowledge' then 'research'
  when category in ('Presentations & Visuals', 'Media & Audio') then 'create'
  when category in ('Build & Prototype', 'Automation & Agents') then 'build'
  else ''
end
where category not in (select id from public.tool_categories);
