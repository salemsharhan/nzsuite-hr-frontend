-- Fix documents table: make uploaded_by nullable and change foreign key to auth.users
-- This allows admins (who may not be employees) to upload documents

-- Drop the existing foreign key constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;

-- Make uploaded_by nullable (it already is, but ensure it)
ALTER TABLE documents ALTER COLUMN uploaded_by DROP NOT NULL;

-- Change uploaded_by to reference auth.users instead of employees
-- Note: We'll keep it as UUID but remove the foreign key constraint
-- since auth.users is in a different schema and we can't directly reference it
-- Alternatively, we can make it a TEXT field to store the user email or UUID

-- For now, we'll just make it nullable and remove the constraint
-- The application will handle validation

COMMENT ON COLUMN documents.uploaded_by IS 'UUID of the user who uploaded the document (from auth.users, not employees)';

