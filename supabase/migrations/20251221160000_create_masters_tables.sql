-- Create Masters Tables: Departments, Roles, and Jobs
-- Jobs are related to Roles (e.g., Role "Engineer" can have Jobs like "Software Engineer", "IT Engineer", "Product Engineer")

-- Departments Master Table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE, -- Optional department code (e.g., "ENG", "SALES")
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles Master Table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE, -- Optional role code (e.g., "ENG", "MGR")
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add code column to existing roles table if it doesn't exist
ALTER TABLE roles ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Jobs Master Table (related to Roles)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT, -- Optional job code
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_job_per_role UNIQUE(role_id, name) -- Ensure unique job name per role
);

-- Modify employees table to use foreign keys
-- Add new columns for foreign keys
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
-- Only create index if code column exists (will be created after ALTER TABLE above)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'code') THEN
    CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);

CREATE INDEX IF NOT EXISTS idx_jobs_role_id ON jobs(role_id);
CREATE INDEX IF NOT EXISTS idx_jobs_name ON jobs(name);
CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active);

CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_job_id ON employees(job_id);
CREATE INDEX IF NOT EXISTS idx_employees_role_id ON employees(role_id);

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (allow all for now, can be restricted later)
CREATE POLICY "Enable all access for departments" ON departments FOR ALL USING (true);
CREATE POLICY "Enable all access for roles" ON roles FOR ALL USING (true);
CREATE POLICY "Enable all access for jobs" ON jobs FOR ALL USING (true);

-- Insert default departments
INSERT INTO departments (name, code, description) VALUES
  ('Engineering', 'ENG', 'Engineering and Development Department'),
  ('Sales', 'SALES', 'Sales and Business Development'),
  ('Marketing', 'MKTG', 'Marketing and Communications'),
  ('HR', 'HR', 'Human Resources'),
  ('Operations', 'OPS', 'Operations and Administration'),
  ('Finance', 'FIN', 'Finance and Accounting'),
  ('IT', 'IT', 'Information Technology'),
  ('Legal', 'LEGAL', 'Legal and Compliance')
ON CONFLICT (name) DO NOTHING;

-- Insert default roles
INSERT INTO roles (name, code, description) VALUES
  ('Engineer', 'ENG', 'Engineering roles'),
  ('Manager', 'MGR', 'Management roles'),
  ('Analyst', 'ANAL', 'Analyst roles'),
  ('Specialist', 'SPEC', 'Specialist roles'),
  ('Director', 'DIR', 'Director level roles'),
  ('Executive', 'EXEC', 'Executive level roles'),
  ('Coordinator', 'COORD', 'Coordination roles'),
  ('Assistant', 'ASST', 'Assistant roles')
ON CONFLICT (name) DO NOTHING;

-- Insert default jobs (related to roles)
-- Get role IDs first, then insert jobs
DO $$
DECLARE
  engineer_role_id UUID;
  manager_role_id UUID;
  analyst_role_id UUID;
  specialist_role_id UUID;
  director_role_id UUID;
  executive_role_id UUID;
  coordinator_role_id UUID;
  assistant_role_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO engineer_role_id FROM roles WHERE name = 'Engineer' LIMIT 1;
  SELECT id INTO manager_role_id FROM roles WHERE name = 'Manager' LIMIT 1;
  SELECT id INTO analyst_role_id FROM roles WHERE name = 'Analyst' LIMIT 1;
  SELECT id INTO specialist_role_id FROM roles WHERE name = 'Specialist' LIMIT 1;
  SELECT id INTO director_role_id FROM roles WHERE name = 'Director' LIMIT 1;
  SELECT id INTO executive_role_id FROM roles WHERE name = 'Executive' LIMIT 1;
  SELECT id INTO coordinator_role_id FROM roles WHERE name = 'Coordinator' LIMIT 1;
  SELECT id INTO assistant_role_id FROM roles WHERE name = 'Assistant' LIMIT 1;

  -- Insert jobs for Engineer role
  IF engineer_role_id IS NOT NULL THEN
    INSERT INTO jobs (role_id, name, code) VALUES
      (engineer_role_id, 'Software Engineer', 'SWE'),
      (engineer_role_id, 'IT Engineer', 'ITE'),
      (engineer_role_id, 'Product Engineer', 'PE'),
      (engineer_role_id, 'DevOps Engineer', 'DEVOPS'),
      (engineer_role_id, 'QA Engineer', 'QA')
    ON CONFLICT (role_id, name) DO NOTHING;
  END IF;

  -- Insert jobs for Manager role
  IF manager_role_id IS NOT NULL THEN
    INSERT INTO jobs (role_id, name, code) VALUES
      (manager_role_id, 'Engineering Manager', 'ENG_MGR'),
      (manager_role_id, 'Sales Manager', 'SALES_MGR'),
      (manager_role_id, 'Product Manager', 'PM'),
      (manager_role_id, 'Operations Manager', 'OPS_MGR')
    ON CONFLICT (role_id, name) DO NOTHING;
  END IF;

  -- Insert jobs for Analyst role
  IF analyst_role_id IS NOT NULL THEN
    INSERT INTO jobs (role_id, name, code) VALUES
      (analyst_role_id, 'Business Analyst', 'BA'),
      (analyst_role_id, 'Data Analyst', 'DA'),
      (analyst_role_id, 'Financial Analyst', 'FA')
    ON CONFLICT (role_id, name) DO NOTHING;
  END IF;

  -- Insert jobs for Specialist role
  IF specialist_role_id IS NOT NULL THEN
    INSERT INTO jobs (role_id, name, code) VALUES
      (specialist_role_id, 'HR Specialist', 'HR_SPEC'),
      (specialist_role_id, 'Marketing Specialist', 'MKTG_SPEC'),
      (specialist_role_id, 'IT Specialist', 'IT_SPEC')
    ON CONFLICT (role_id, name) DO NOTHING;
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

