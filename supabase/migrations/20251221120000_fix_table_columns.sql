-- Fix table column mismatches

-- 1. Add 'folder' column to documents table (alias for category, or make category the main one)
-- Option A: Add folder as an alias/alternative to category
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder TEXT;
-- Update existing records to copy category to folder
UPDATE documents SET folder = category WHERE folder IS NULL AND category IS NOT NULL;

-- 2. Add 'position' column to candidates table (alias for role, or make role the main one)
-- Option A: Add position as an alias/alternative to role
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS position TEXT;
-- Update existing records to copy role to position
UPDATE candidates SET position = role WHERE position IS NULL AND role IS NOT NULL;

-- 3. Ensure hiring_checklists table exists (in case migration wasn't run)
CREATE TABLE IF NOT EXISTS hiring_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL DEFAULT 1,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'In Progress',
  hr_approved BOOLEAN NOT NULL DEFAULT FALSE,
  hr_approved_by TEXT,
  hr_approved_date TIMESTAMPTZ,
  manager_approved BOOLEAN NOT NULL DEFAULT FALSE,
  manager_approved_by TEXT,
  manager_approved_date TIMESTAMPTZ,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_employee_checklist UNIQUE(employee_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_hiring_checklists_employee_id ON hiring_checklists(employee_id);
CREATE INDEX IF NOT EXISTS idx_hiring_checklists_status ON hiring_checklists(status);

-- Enable RLS if not already enabled
ALTER TABLE hiring_checklists ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist (using IF NOT EXISTS equivalent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'hiring_checklists' 
    AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON hiring_checklists
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'hiring_checklists' 
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users" ON hiring_checklists
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'hiring_checklists' 
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    CREATE POLICY "Enable update for authenticated users" ON hiring_checklists
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'hiring_checklists' 
    AND policyname = 'Enable delete for authenticated users'
  ) THEN
    CREATE POLICY "Enable delete for authenticated users" ON hiring_checklists
      FOR DELETE USING (true);
  END IF;
END $$;

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_hiring_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS hiring_checklists_updated_at ON hiring_checklists;
CREATE TRIGGER hiring_checklists_updated_at
  BEFORE UPDATE ON hiring_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_hiring_checklists_updated_at();


