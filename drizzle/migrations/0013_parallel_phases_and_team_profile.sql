ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS parallel_with_previous boolean NOT NULL DEFAULT false;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS intro_video_url text NOT NULL DEFAULT '';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS pm_name text NOT NULL DEFAULT '';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS members jsonb NOT NULL DEFAULT '[]'::jsonb;