-- Simplify RLS policies for documents table
-- Allow all authenticated users to manage documents (can be refined later)

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON documents;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON documents;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON documents;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON documents;
DROP POLICY IF EXISTS "Enable update for document owners" ON documents;
DROP POLICY IF EXISTS "Enable delete for document owners" ON documents;

-- Simple policies: allow all authenticated users
-- This ensures document uploads work for admins and employees
CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "documents_insert_policy" ON documents
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "documents_update_policy" ON documents
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "documents_delete_policy" ON documents
  FOR DELETE
  USING (auth.role() = 'authenticated');


