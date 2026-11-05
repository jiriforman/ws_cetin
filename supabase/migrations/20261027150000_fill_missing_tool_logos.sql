-- AI Arsenal: fill in logos for tools that have none, matched by tool name.
-- Logos live in public/logos (sources: LobeHub Icons, Simple Icons, Iconify "logos").
-- Never overwrites a logo that is already set; safe to run more than once.

update public.tools set logo_url = '/logos/github-copilot-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'github copilot';
update public.tools set logo_url = '/logos/copilot-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'copilot';
update public.tools set logo_url = '/logos/notebooklm-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'notebooklm';
update public.tools set logo_url = '/logos/gemini-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'gemini';
update public.tools set logo_url = '/logos/chatgpt-logo.png' where coalesce(logo_url, '') = '' and tool_name ~* 'chatgpt|openai';
update public.tools set logo_url = '/logos/claude-logo.png' where coalesce(logo_url, '') = '' and tool_name ~* 'claude';
update public.tools set logo_url = '/logos/gamma-logo.png' where coalesce(logo_url, '') = '' and tool_name ~* 'gamma';
update public.tools set logo_url = '/logos/suno-logo.png' where coalesce(logo_url, '') = '' and tool_name ~* 'suno';
update public.tools set logo_url = '/logos/lovable-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'lovable';
update public.tools set logo_url = '/logos/cursor-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'cursor';
update public.tools set logo_url = '/logos/n8n-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'n8n';
update public.tools set logo_url = '/logos/perplexity-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'perplexity';
update public.tools set logo_url = '/logos/make-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* '\mmake\M';
update public.tools set logo_url = '/logos/zapier-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'zapier';
update public.tools set logo_url = '/logos/elevenlabs-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'eleven ?labs';
update public.tools set logo_url = '/logos/miro-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'miro';
update public.tools set logo_url = '/logos/midjourney-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'midjourney';
update public.tools set logo_url = '/logos/runway-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'runway';
update public.tools set logo_url = '/logos/replit-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'replit';
update public.tools set logo_url = '/logos/v0-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* '\mv0\M';
update public.tools set logo_url = '/logos/windsurf-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'windsurf';
update public.tools set logo_url = '/logos/mistral-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'mistral|le chat';
update public.tools set logo_url = '/logos/deepseek-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'deepseek';
update public.tools set logo_url = '/logos/grok-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'grok';
update public.tools set logo_url = '/logos/manus-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'manus';
update public.tools set logo_url = '/logos/kling-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'kling';
update public.tools set logo_url = '/logos/notion-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'notion';
update public.tools set logo_url = '/logos/figma-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'figma';
update public.tools set logo_url = '/logos/deepl-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'deepl';
update public.tools set logo_url = '/logos/canva-logo.svg' where coalesce(logo_url, '') = '' and tool_name ~* 'canva';
