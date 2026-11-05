-- Rename time_days column to time_weeks for clarity
ALTER TABLE public.teams RENAME COLUMN time_days TO time_weeks;