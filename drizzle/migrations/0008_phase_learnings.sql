ALTER TABLE public.phases
  ADD COLUMN IF NOT EXISTS learnings_project_management text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS learnings_ai_arsenal text NOT NULL DEFAULT '';