-- Create Companies Table for Multi-Tenant System
-- Companies can share employee data via API integration

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE, -- Company code (e.g., "HOSPITAL_001", "CLINIC_ABC")
  description TEXT,
  api_endpoint TEXT, -- External API endpoint to fetch employees
  api_key TEXT, -- API key for authentication (encrypted in production)
  api_secret TEXT, -- API secret for authentication (encrypted in production)
  sync_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Enable automatic sync
  sync_frequency TEXT DEFAULT 'daily', -- daily, weekly, monthly, manual
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- idle, syncing, success, error
  sync_error_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company Admins Table
-- Stores admin credentials for each company
CREATE TABLE IF NOT EXISTS company_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- Hashed password (use bcrypt in application)
  first_name TEXT,
  last_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_company_admin_email UNIQUE(email)
);

-- Update employees table to associate with companies
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS external_id TEXT; -- ID from external system
ALTER TABLE employees ADD COLUMN IF NOT EXISTS synced_from_external BOOLEAN DEFAULT FALSE; -- Flag if synced from external API
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ; -- Last sync timestamp

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_company_admins_company_id ON company_admins(company_id);
CREATE INDEX IF NOT EXISTS idx_company_admins_email ON company_admins(email);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_external_id ON employees(external_id);
CREATE INDEX IF NOT EXISTS idx_employees_synced ON employees(synced_from_external);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_admins ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Enable all access for companies" ON companies FOR ALL USING (true);
CREATE POLICY "Enable all access for company_admins" ON company_admins FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_admins_updated_at BEFORE UPDATE ON company_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default company (for existing employees)
INSERT INTO companies (name, code, description, is_active) 
VALUES ('Default Company', 'DEFAULT', 'Default company for existing employees', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Update existing employees to belong to default company
DO $$
DECLARE
  default_company_id UUID;
BEGIN
  SELECT id INTO default_company_id FROM companies WHERE code = 'DEFAULT' LIMIT 1;
  IF default_company_id IS NOT NULL THEN
    UPDATE employees SET company_id = default_company_id WHERE company_id IS NULL;
  END IF;
END $$;

