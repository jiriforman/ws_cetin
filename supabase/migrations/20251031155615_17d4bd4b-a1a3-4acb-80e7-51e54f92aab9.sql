-- Add new columns to teams table for ranking calculation
ALTER TABLE public.teams
ADD COLUMN expected_revenue integer DEFAULT 0,
ADD COLUMN time_bonus integer DEFAULT 0,
ADD COLUMN total_revenue integer DEFAULT 0,
ADD COLUMN last_recalculated timestamp with time zone DEFAULT NULL;

-- Update total_revenue for all existing teams (initial calculation)
UPDATE public.teams
SET total_revenue = budget + COALESCE(expected_revenue, 0) + COALESCE(time_bonus, 0);