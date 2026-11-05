-- Parallel phases: each phase names the phase it runs in parallel with (kept symmetric by admin-api).
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS parallel_with text NOT NULL DEFAULT '';

-- Carry over the earlier "parallel with previous phase" flag: pair with the phase just before it.
WITH ordered AS (
  SELECT id, parallel_with_previous, lag(id) OVER (ORDER BY "order") AS prev_id FROM public.phases
)
UPDATE public.phases p SET parallel_with = o.prev_id
FROM ordered o
WHERE p.id = o.id AND o.parallel_with_previous AND o.prev_id IS NOT NULL AND p.parallel_with = '';
UPDATE public.phases p SET parallel_with = q.id
FROM public.phases q
WHERE q.parallel_with = p.id AND p.parallel_with = '';

-- Workshop default: 5 Quality Control + 6 Risk mitigation, 8 Packing + 9 Operation Golden Stamp
-- (only for phases that are not paired yet)
UPDATE public.phases a SET parallel_with = b.id
FROM public.phases b
WHERE a.parallel_with = '' AND b.parallel_with = ''
  AND ((a.name ~* 'quality control' AND b.name ~* 'risk mitigation') OR (a.name ~* 'risk mitigation' AND b.name ~* 'quality control')
    OR (a.name ~* '^packing' AND b.name ~* 'golden stamp') OR (a.name ~* 'golden stamp' AND b.name ~* '^packing'));

-- AI Arsenal: Vimeo hosts the team intro videos. Added once, never duplicated.
INSERT INTO public.tools (id, tool_name, description, link_url, logo_url, category, visible, display_order)
SELECT gen_random_uuid()::text, 'Vimeo',
  'Video hosting for your team intro video. Upload the video, set it to public or unlisted, copy the link and paste it on your team page - it plays right there.',
  'https://vimeo.com', '/logos/vimeo-logo.svg', 'create', true,
  coalesce((SELECT max(display_order) FROM public.tools), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM public.tools WHERE tool_name ~* '^vimeo$');
