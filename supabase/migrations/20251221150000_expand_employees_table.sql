-- Expand employees table with additional fields

-- Personal Information
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT; -- Male, Female, Other
ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status TEXT; -- Single, Married, Divorced, Widowed

-- Contact Information
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS alternate_phone TEXT;

-- Emergency Contact
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT; -- Spouse, Parent, Sibling, Other

-- Employment Details
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC(12, 2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_location TEXT; -- Office, Remote, Hybrid
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES employees(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_type TEXT DEFAULT 'Full Time'; -- Full Time, Part Time, Consultant, Intern
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Additional Information
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS skills TEXT[]; -- Array of skills
ALTER TABLE employees ADD COLUMN IF NOT EXISTS certifications TEXT[]; -- Array of certifications

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_employees_nationality ON employees(nationality);
CREATE INDEX IF NOT EXISTS idx_employees_country ON employees(country);
CREATE INDEX IF NOT EXISTS idx_employees_reporting_manager ON employees(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_work_location ON employees(work_location);



