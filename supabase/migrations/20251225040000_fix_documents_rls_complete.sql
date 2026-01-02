-- Complete fix for documents table RLS
-- Ensure RLS is enabled and policies allow all authenticated operations

-- Ensure RLS is enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'documents') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON documents';
    END LOOP;
END $$;

-- Create simple, permissive policies for all authenticated users
-- These policies allow any authenticated user to perform all operations

CREATE POLICY "documents_all_select" ON documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "documents_all_insert" ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "documents_all_update" ON documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "documents_all_delete" ON documents
  FOR DELETE
  TO authenticated
  USING (true);

-- Also allow service role to bypass RLS (should work automatically, but explicit is better)
CREATE POLICY "documents_service_role" ON documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


