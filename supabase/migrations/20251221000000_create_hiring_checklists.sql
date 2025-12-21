-- Create hiring_checklists table
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_hiring_checklists_employee_id ON hiring_checklists(employee_id);
CREATE INDEX IF NOT EXISTS idx_hiring_checklists_status ON hiring_checklists(status);

-- Enable RLS
ALTER TABLE hiring_checklists ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON hiring_checklists
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON hiring_checklists
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON hiring_checklists
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON hiring_checklists
  FOR DELETE USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hiring_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hiring_checklists_updated_at
  BEFORE UPDATE ON hiring_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_hiring_checklists_updated_at();
