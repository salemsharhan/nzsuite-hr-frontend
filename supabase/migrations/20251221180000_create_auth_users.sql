-- Create authentication users table and role management
-- This extends Supabase auth.users with role information

-- Create user_roles table to store user roles and company associations
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE, -- References auth.users(id)
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'employee', -- 'super_admin', 'admin', 'employee'
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL, -- NULL for super_admin, set for admin/employee
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL, -- Link to employee record if applicable
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_role CHECK (role IN ('super_admin', 'admin', 'employee'))
);

-- Add columns if table exists but columns are missing
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraints if they don't exist
DO $$
BEGIN
  -- Add unique constraint on email if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_email_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_email_key UNIQUE (email);
  END IF;
  
  -- Add check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_role'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT valid_role CHECK (role IN ('super_admin', 'admin', 'employee'));
  END IF;
END $$;

-- Create indexes (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'email') THEN
    CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'role') THEN
    CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'company_id') THEN
    CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON user_roles(company_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'employee_id') THEN
    CREATE INDEX IF NOT EXISTS idx_user_roles_employee_id ON user_roles(employee_id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Users can read their own role
CREATE POLICY "Users can read own role" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role full access" ON user_roles FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically create user_role when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, email, role, is_active)
  VALUES (NEW.id, NEW.email, 'employee', TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user_role on user signup (if using Supabase Auth)
-- Note: This requires Supabase Auth to be enabled
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to update updated_at
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default super admin users (using the provided JWT keys as identifiers)
-- These will need to be created in Supabase Auth first, then linked here
-- For now, we'll create placeholder records that can be updated when users are created

COMMENT ON TABLE user_roles IS 'Stores user roles and permissions. Links Supabase auth.users to companies and employees.';
COMMENT ON COLUMN user_roles.role IS 'User role: super_admin (full access), admin (company-specific), employee (self-access only)';
COMMENT ON COLUMN user_roles.company_id IS 'Company association. NULL for super_admin, required for admin, optional for employee';

