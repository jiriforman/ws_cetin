-- Add new columns to phases table
ALTER TABLE public.phases 
ADD COLUMN IF NOT EXISTS task text DEFAULT ''::text,
ADD COLUMN IF NOT EXISTS materials text DEFAULT ''::text,
ADD COLUMN IF NOT EXISTS impact_type text DEFAULT 'time'::text;

-- Add check constraint for impact_type
ALTER TABLE public.phases 
ADD CONSTRAINT phases_impact_type_check 
CHECK (impact_type IN ('cost', 'time', 'revenue'));