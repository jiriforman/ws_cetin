-- AI Arsenal: research tools join the chatbots, leaving 3 categories (chat, create, build).
-- Idempotent: safe to run more than once.

update public.tools set category = 'chat' where category = 'research';
delete from public.tool_categories where id = 'research';

update public.tool_categories set name = 'Chat & Research' where id = 'chat';
-- Only replace the prefilled text; keep it if the admin already edited it
update public.tool_categories
set description = '<p>Your all-round sparring partner. Draft and rewrite emails, summarise long documents, brainstorm options and analyse data, or search the web and your own documents to get cited answers and briefings in minutes.</p>'
where id = 'chat'
  and description = '<p>Your all-round sparring partner. Draft and rewrite emails, summarise long documents, brainstorm options, analyse data or stress-test your arguments.</p>';

-- Close the gap in the order
update public.tool_categories c
set display_order = o.rn
from (select id, row_number() over (order by display_order, id) as rn from public.tool_categories) o
where c.id = o.id;
