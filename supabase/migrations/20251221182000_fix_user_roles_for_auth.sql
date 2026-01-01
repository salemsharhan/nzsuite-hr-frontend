-- Fix user_roles table to support authentication users
-- The existing table references employees, but we need it to reference auth.users

-- Drop the foreign key constraint that references employees
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Make role_id nullable (since we're using the 'role' text column for auth roles)
ALTER TABLE user_roles ALTER COLUMN role_id DROP NOT NULL;

-- Make assigned_by nullable (not needed for auth users)
ALTER TABLE user_roles ALTER COLUMN assigned_by DROP NOT NULL;

-- Ensure we have the columns we need for authentication
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint on user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Add unique constraint on email if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_email_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_email_key UNIQUE (email);
  END IF;
END $$;

-- Add check constraint for valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_auth_role'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT valid_auth_role CHECK (role IN ('super_admin', 'admin', 'employee'));
  END IF;
END $$;


