-- Per-phase cheat sheet (rich text HTML), shown only on the link-only /cheat page.
-- Idempotent: safe to run more than once.
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS cheat_sheet text NOT NULL DEFAULT '';
