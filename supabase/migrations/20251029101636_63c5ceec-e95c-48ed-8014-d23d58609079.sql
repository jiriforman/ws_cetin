-- Remove score column from teams table
ALTER TABLE public.teams DROP COLUMN IF EXISTS score;