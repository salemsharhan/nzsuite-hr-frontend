-- Create folders table for document organization
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3b82f6', -- Default blue color
  icon TEXT DEFAULT 'Folder', -- Icon name
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE, -- For nested folders
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  CONSTRAINT folder_name_unique UNIQUE(name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON folders
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON folders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON folders
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON folders
  FOR DELETE USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folders_updated_at();

-- Insert default folders
INSERT INTO folders (name, description, color, icon) VALUES
  ('Contracts', 'Employment contracts and agreements', '#3b82f6', 'FileText'),
  ('Policies', 'Company policies and procedures', '#10b981', 'FileText'),
  ('Visas', 'Visa and work permit documents', '#f59e0b', 'FileText'),
  ('Payroll', 'Payroll and salary documents', '#ef4444', 'FileText'),
  ('Onboarding', 'New employee onboarding materials', '#8b5cf6', 'FileText'),
  ('Templates', 'Document templates', '#6366f1', 'FileText'),
  ('General', 'General documents', '#6b7280', 'Folder')
ON CONFLICT (name) DO NOTHING;

-- Update documents table to reference folders
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Create index for folder_id
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);

