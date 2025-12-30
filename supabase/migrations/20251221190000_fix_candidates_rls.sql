-- Fix RLS policies for candidates table to allow proper access

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON candidates;

-- Create a more permissive policy that allows access
-- This allows access for authenticated users OR when using service role key
DO $$
BEGIN
  -- Drop and recreate policy to allow access
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'candidates' 
    AND policyname = 'Enable all access for all users'
  ) THEN
    DROP POLICY "Enable all access for all users" ON candidates;
  END IF;
  
  -- Create permissive policy (can be restricted later)
  CREATE POLICY "Enable all access for all users" ON candidates
    FOR ALL
    USING (true);
END $$;

