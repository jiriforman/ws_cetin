-- Add new column for array of impact types
ALTER TABLE phases 
ADD COLUMN impact_types text[] DEFAULT ARRAY[]::text[];

-- Copy existing data to new column (converting single value to array)
UPDATE phases 
SET impact_types = CASE 
  WHEN impact_type IS NULL OR impact_type = '' THEN ARRAY[]::text[]
  ELSE ARRAY[impact_type]::text[]
END;

-- Drop old column
ALTER TABLE phases 
DROP COLUMN impact_type;

-- Rename new column to original name
ALTER TABLE phases 
RENAME COLUMN impact_types TO impact_type;