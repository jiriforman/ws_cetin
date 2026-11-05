-- AI Arsenal categories: tools get a free-text category the public page groups by.
-- Empty = uncategorised (shown under "Other"). Existing tools are pre-sorted by name; the admin can change it.

alter table public.tools add column if not exists category text not null default '';

-- Most specific first: each statement only touches tools that are still uncategorised
update public.tools set category = 'Build & Prototype'
  where category = '' and tool_name ~* '(lovable|cursor|bolt|\mv0\M|replit|claude code|github|windsurf)';
update public.tools set category = 'Automation & Agents'
  where category = '' and tool_name ~* '(n8n|zapier|\mmake\M|power automate|relevance|agent)';
update public.tools set category = 'Research & Knowledge'
  where category = '' and tool_name ~* '(notebooklm|perplexity|elicit|consensus|scite|deep research)';
update public.tools set category = 'Presentations & Visuals'
  where category = '' and tool_name ~* '(gamma|canva|miro|napkin|beautiful|tome|figma|pitch)';
update public.tools set category = 'Media & Audio'
  where category = '' and tool_name ~* '(suno|eleven|heygen|synthesia|midjourney|runway|dall|sora|veo|udio|kling)';
update public.tools set category = 'Chat & Assistants'
  where category = '' and tool_name ~* '(chatgpt|claude|gemini|copilot|mistral|le chat|deepseek|grok|llama|openai)';
