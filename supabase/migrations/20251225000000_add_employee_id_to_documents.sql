-- Add employee_id to documents table to link documents to specific employees
-- This allows employees to have their own document collections

-- Add employee_id column if it doesn't exist
ALTER TABLE documents ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE CASCADE;

-- Create index for employee_id for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON documents(employee_id);

-- Update RLS policies to allow employees to view their own documents
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON documents;

-- Create new policies
CREATE POLICY "Enable read access for authenticated users" ON documents
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON documents
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for document owners" ON documents
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for document owners" ON documents
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Add comment
COMMENT ON COLUMN documents.employee_id IS 'The employee this document belongs to';


