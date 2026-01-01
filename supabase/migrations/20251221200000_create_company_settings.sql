-- Create Company Settings and Configuration Tables

-- Company Settings Table (General company-wide settings)
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Working Hours
  default_working_hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 8.00,
  default_working_days_per_week INTEGER NOT NULL DEFAULT 5,
  work_week_start_day INTEGER NOT NULL DEFAULT 1, -- 1=Monday, 7=Sunday
  work_week_end_day INTEGER NOT NULL DEFAULT 5, -- 1=Monday, 7=Sunday
  
  -- Leave Settings
  annual_leave_days_per_year INTEGER NOT NULL DEFAULT 20,
  sick_leave_days_per_year INTEGER NOT NULL DEFAULT 10,
  carry_forward_annual_leave BOOLEAN NOT NULL DEFAULT TRUE,
  max_carry_forward_days INTEGER DEFAULT 5,
  
  -- Payroll Settings
  payroll_cycle TEXT NOT NULL DEFAULT 'monthly', -- monthly, bi-weekly, weekly
  payroll_day INTEGER DEFAULT 1, -- Day of month/week for payroll
  
  -- Attendance Settings
  late_tolerance_minutes INTEGER DEFAULT 15,
  overtime_threshold_hours NUMERIC(4,2) DEFAULT 8.00,
  overtime_multiplier NUMERIC(3,2) DEFAULT 1.50,
  
  -- Other Settings
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_company_settings UNIQUE(company_id)
);

-- Employee Working Hours Table (Weekday-wise working hours for each employee)
CREATE TABLE IF NOT EXISTS employee_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Weekday-wise hours (0=Sunday, 1=Monday, ..., 6=Saturday)
  monday_hours NUMERIC(4,2) DEFAULT 8.00,
  tuesday_hours NUMERIC(4,2) DEFAULT 8.00,
  wednesday_hours NUMERIC(4,2) DEFAULT 8.00,
  thursday_hours NUMERIC(4,2) DEFAULT 8.00,
  friday_hours NUMERIC(4,2) DEFAULT 8.00,
  saturday_hours NUMERIC(4,2) DEFAULT 0.00,
  sunday_hours NUMERIC(4,2) DEFAULT 0.00,
  
  -- Flexible working hours
  flexible_hours BOOLEAN DEFAULT FALSE,
  start_time TIME, -- e.g., '09:00:00'
  end_time TIME, -- e.g., '17:00:00'
  
  -- Break settings
  break_duration_minutes INTEGER DEFAULT 60,
  break_start_time TIME,
  
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_employee_active_hours UNIQUE(employee_id, effective_from)
);

-- Leave Quotas Table (Leave allocations per employee)
CREATE TABLE IF NOT EXISTS leave_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  leave_year INTEGER NOT NULL, -- e.g., 2025
  leave_type TEXT NOT NULL, -- 'annual', 'sick', 'unpaid', 'personal', etc.
  
  allocated_days INTEGER NOT NULL DEFAULT 0,
  used_days INTEGER NOT NULL DEFAULT 0,
  remaining_days INTEGER NOT NULL DEFAULT 0,
  carried_forward_days INTEGER DEFAULT 0,
  
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_employee_leave_quota UNIQUE(employee_id, leave_year, leave_type)
);

-- Role/Job Salary Configuration Table
CREATE TABLE IF NOT EXISTS role_salary_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Salary structure
  base_salary NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Allowances
  housing_allowance NUMERIC(12,2) DEFAULT 0,
  transport_allowance NUMERIC(12,2) DEFAULT 0,
  meal_allowance NUMERIC(12,2) DEFAULT 0,
  medical_allowance NUMERIC(12,2) DEFAULT 0,
  other_allowances NUMERIC(12,2) DEFAULT 0,
  
  -- Deductions
  tax_percentage NUMERIC(5,2) DEFAULT 0,
  insurance_deduction NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  
  -- Benefits
  benefits JSONB DEFAULT '{}'::jsonb, -- Flexible benefits structure
  
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_role_or_job CHECK (role_id IS NOT NULL OR job_id IS NOT NULL)
);

-- Permissions Configuration Table (Role-based permissions)
CREATE TABLE IF NOT EXISTS role_permissions_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  
  -- Module permissions (JSONB for flexibility)
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Specific permissions
  can_approve_leave BOOLEAN DEFAULT FALSE,
  can_approve_overtime BOOLEAN DEFAULT FALSE,
  can_view_salary BOOLEAN DEFAULT FALSE,
  can_edit_employee BOOLEAN DEFAULT FALSE,
  can_delete_employee BOOLEAN DEFAULT FALSE,
  can_manage_documents BOOLEAN DEFAULT FALSE,
  can_manage_recruitment BOOLEAN DEFAULT FALSE,
  
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_company_role_permissions UNIQUE(company_id, role_id, effective_from)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_working_hours_employee_id ON employee_working_hours(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_working_hours_company_id ON employee_working_hours(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_working_hours_active ON employee_working_hours(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_leave_quotas_employee_id ON leave_quotas(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_quotas_company_id ON leave_quotas(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_quotas_year ON leave_quotas(leave_year);
CREATE INDEX IF NOT EXISTS idx_role_salary_config_company_id ON role_salary_config(company_id);
CREATE INDEX IF NOT EXISTS idx_role_salary_config_role_id ON role_salary_config(role_id);
CREATE INDEX IF NOT EXISTS idx_role_salary_config_job_id ON role_salary_config(job_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_config_company_id ON role_permissions_config(company_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_config_role_id ON role_permissions_config(role_id);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_salary_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions_config ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Company settings: accessible by company admins and super admins
CREATE POLICY "Enable all access for company settings" ON company_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND user_roles.company_id = company_settings.company_id)
      )
      AND user_roles.is_active = true
    )
  );

-- Employee working hours: accessible by company admins and super admins
CREATE POLICY "Enable all access for employee working hours" ON employee_working_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND user_roles.company_id = employee_working_hours.company_id)
      )
      AND user_roles.is_active = true
    )
  );

-- Leave quotas: accessible by company admins and super admins
CREATE POLICY "Enable all access for leave quotas" ON leave_quotas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND user_roles.company_id = leave_quotas.company_id)
      )
      AND user_roles.is_active = true
    )
  );

-- Role salary config: accessible by company admins and super admins
CREATE POLICY "Enable all access for role salary config" ON role_salary_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND user_roles.company_id = role_salary_config.company_id)
      )
      AND user_roles.is_active = true
    )
  );

-- Role permissions config: accessible by company admins and super admins
CREATE POLICY "Enable all access for role permissions config" ON role_permissions_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND user_roles.company_id = role_permissions_config.company_id)
      )
      AND user_roles.is_active = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_working_hours_updated_at BEFORE UPDATE ON employee_working_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_quotas_updated_at BEFORE UPDATE ON leave_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_salary_config_updated_at BEFORE UPDATE ON role_salary_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_config_updated_at BEFORE UPDATE ON role_permissions_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default company settings for existing companies
INSERT INTO company_settings (company_id, default_working_hours_per_day, default_working_days_per_week)
SELECT id, 8.00, 5
FROM companies
WHERE id NOT IN (SELECT company_id FROM company_settings)
ON CONFLICT (company_id) DO NOTHING;


