-- Create Employee Immigration Table
-- Tracks residence permits, work permits, passport, health insurance, and civil ID for expatriate employees in Kuwait

CREATE TABLE IF NOT EXISTS employee_immigration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Work Permit (Public Authority for Manpower)
  work_permit_number TEXT,
  work_permit_issue_date DATE,
  work_permit_expiry_date DATE,
  work_permit_status TEXT DEFAULT 'Active', -- 'Active', 'Expired', 'Pending Renewal', 'Cancelled'
  work_permit_last_renewed_date DATE,
  work_permit_next_renewal_date DATE,
  work_permit_renewal_reminder_days INTEGER DEFAULT 30, -- Days before expiry to send reminder
  
  -- Passport Information
  passport_number TEXT,
  passport_issue_date DATE,
  passport_expiry_date DATE,
  passport_issue_country TEXT,
  passport_status TEXT DEFAULT 'Valid', -- 'Valid', 'Expired', 'Expiring Soon'
  passport_validity_days INTEGER, -- Calculated days until expiry
  
  -- Health Insurance
  health_insurance_number TEXT,
  health_insurance_provider TEXT,
  health_insurance_issue_date DATE,
  health_insurance_expiry_date DATE,
  health_insurance_status TEXT DEFAULT 'Active', -- 'Active', 'Expired', 'Pending Renewal', 'Cancelled'
  health_insurance_last_renewed_date DATE,
  health_insurance_next_renewal_date DATE,
  health_insurance_renewal_reminder_days INTEGER DEFAULT 30,
  
  -- Residence Permit (Article 18) - Ministry of Interior
  residence_permit_number TEXT,
  residence_permit_issue_date DATE,
  residence_permit_expiry_date DATE,
  residence_permit_status TEXT DEFAULT 'Active', -- 'Active', 'Expired', 'Pending Renewal', 'Cancelled', 'Under Review'
  residence_permit_last_renewed_date DATE,
  residence_permit_next_renewal_date DATE,
  residence_permit_renewal_reminder_days INTEGER DEFAULT 60, -- Earlier reminder for residence permit
  residence_permit_article TEXT DEFAULT 'Article 18', -- Article 18, Article 17, etc.
  
  -- Civil ID
  civil_id_number TEXT,
  civil_id_issue_date DATE,
  civil_id_expiry_date DATE,
  civil_id_status TEXT DEFAULT 'Valid', -- 'Valid', 'Expired', 'Needs Update'
  civil_id_last_updated_date DATE,
  civil_id_update_reason TEXT, -- Reason for last update (e.g., 'Name Change', 'Address Change')
  
  -- General Information
  is_expatriate BOOLEAN DEFAULT TRUE, -- Flag to identify expatriate employees
  visa_type TEXT, -- e.g., 'Work Visa', 'Family Visa', 'Investor Visa'
  sponsor_name TEXT, -- Company or individual sponsoring the employee
  entry_date DATE, -- Date of entry into Kuwait
  last_exit_date DATE, -- Last exit from Kuwait (for tracking)
  last_entry_date DATE, -- Last entry into Kuwait
  
  -- Renewal Tracking
  next_renewal_action TEXT, -- 'Work Permit', 'Health Insurance', 'Residence Permit', 'Passport', 'Civil ID'
  next_renewal_date DATE, -- Earliest renewal date among all documents
  renewal_priority TEXT DEFAULT 'Normal', -- 'Urgent', 'High', 'Normal', 'Low'
  
  -- Notes and Comments
  notes TEXT, -- General notes
  renewal_notes TEXT, -- Notes specific to renewals
  last_renewal_processed_by UUID REFERENCES employees(id), -- HR employee who processed last renewal
  last_renewal_processed_date TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_immigration_employee_id ON employee_immigration(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_immigration_work_permit_expiry ON employee_immigration(work_permit_expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_immigration_residence_permit_expiry ON employee_immigration(residence_permit_expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_immigration_passport_expiry ON employee_immigration(passport_expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_immigration_health_insurance_expiry ON employee_immigration(health_insurance_expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_immigration_next_renewal_date ON employee_immigration(next_renewal_date);
CREATE INDEX IF NOT EXISTS idx_employee_immigration_renewal_priority ON employee_immigration(renewal_priority);
CREATE INDEX IF NOT EXISTS idx_employee_immigration_is_expatriate ON employee_immigration(is_expatriate);

-- Enable RLS
ALTER TABLE employee_immigration ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ BEGIN
  CREATE POLICY "Employees can view their own immigration records" ON employee_immigration
    FOR SELECT
    USING (
      auth.role() = 'authenticated' AND
      employee_id IN (
        SELECT id FROM employees WHERE id = employee_immigration.employee_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Employees can create their own immigration records" ON employee_immigration
    FOR INSERT
    WITH CHECK (
      auth.role() = 'authenticated' AND
      employee_id IN (
        SELECT id FROM employees WHERE id = employee_immigration.employee_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Employees can update their own immigration records" ON employee_immigration
    FOR UPDATE
    USING (
      auth.role() = 'authenticated' AND
      employee_id IN (
        SELECT id FROM employees WHERE id = employee_immigration.employee_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all immigration records" ON employee_immigration
    FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can create immigration records for any employee" ON employee_immigration
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update all immigration records" ON employee_immigration
    FOR UPDATE
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete all immigration records" ON employee_immigration
    FOR DELETE
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add comments
COMMENT ON TABLE employee_immigration IS 'Immigration and residence permit management for expatriate employees in Kuwait';
COMMENT ON COLUMN employee_immigration.work_permit_number IS 'Work permit number from Public Authority for Manpower';
COMMENT ON COLUMN employee_immigration.residence_permit_number IS 'Residence permit number from Ministry of Interior';
COMMENT ON COLUMN employee_immigration.residence_permit_article IS 'Article type (Article 18 for work, Article 17 for family, etc.)';
COMMENT ON COLUMN employee_immigration.next_renewal_action IS 'Next document that needs renewal (earliest expiry)';
COMMENT ON COLUMN employee_immigration.renewal_priority IS 'Priority level based on expiry dates and urgency';

