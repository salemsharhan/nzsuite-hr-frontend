-- =====================================================
-- EXECUTE THIS SQL IN YOUR SUPABASE DASHBOARD
-- Go to: https://supabase.com/dashboard/project/wqfbltrnlwngyohvxjjq/sql/new
-- =====================================================

-- 1. Add employment_type column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full Time';

-- 2. Create hiring_checklists table
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

CREATE INDEX IF NOT EXISTS idx_hiring_checklists_employee_id ON hiring_checklists(employee_id);
CREATE INDEX IF NOT EXISTS idx_hiring_checklists_status ON hiring_checklists(status);

ALTER TABLE hiring_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON hiring_checklists
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON hiring_checklists
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON hiring_checklists
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON hiring_checklists
  FOR DELETE USING (true);

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

-- 3. Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  effective_date TIMESTAMPTZ,
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_role UNIQUE(user_id, role_id)
);

-- 5. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at DESC);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for roles
CREATE POLICY "Enable read access for all users on roles" ON roles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users on roles" ON roles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on roles" ON roles
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users on roles" ON roles
  FOR DELETE USING (true);

-- Create policies for user_roles
CREATE POLICY "Enable read access for all users on user_roles" ON user_roles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users on user_roles" ON user_roles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on user_roles" ON user_roles
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users on user_roles" ON user_roles
  FOR DELETE USING (true);

-- Create policies for audit_logs
CREATE POLICY "Enable read access for all users on audit_logs" ON audit_logs
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users on audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Create trigger to update roles updated_at timestamp
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();

-- Insert default system roles
INSERT INTO roles (name, description, is_system_role, permissions) VALUES
  ('Admin', 'Full system access with all permissions', true, 
   '[{"module":"HR","actions":["view","create","edit","approve","delete","export"]},{"module":"Attendance","actions":["view","create","edit","approve","delete","export"]},{"module":"Payroll","actions":["view","create","edit","approve","delete","export"]},{"module":"Recruitment","actions":["view","create","edit","approve","delete","export"]},{"module":"Analytics","actions":["view","export"]},{"module":"Settings","actions":["view","edit"]}]'::jsonb),
  
  ('HR', 'HR department with employee and attendance management', true,
   '[{"module":"HR","actions":["view","create","edit","export"]},{"module":"Attendance","actions":["view","create","edit","export"]},{"module":"Recruitment","actions":["view","create","edit","export"]},{"module":"Analytics","actions":["view"]}]'::jsonb),
  
  ('Manager', 'Team manager with approval permissions', true,
   '[{"module":"HR","actions":["view"]},{"module":"Attendance","actions":["view","approve"]},{"module":"Payroll","actions":["view"]},{"module":"Analytics","actions":["view"]}]'::jsonb),
  
  ('Finance', 'Finance department with payroll access', true,
   '[{"module":"HR","actions":["view"]},{"module":"Payroll","actions":["view","create","edit","approve","export"]},{"module":"Analytics","actions":["view","export"]}]'::jsonb),
  
  ('Supervisor', 'Team supervisor with limited approval rights', true,
   '[{"module":"HR","actions":["view"]},{"module":"Attendance","actions":["view","approve"]}]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
