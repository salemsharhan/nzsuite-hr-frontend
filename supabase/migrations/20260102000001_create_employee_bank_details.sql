-- Create Employee Bank Details Table
-- One record per employee for bank account information

CREATE TABLE IF NOT EXISTS employee_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  branch_name TEXT, -- Branch name or location
  branch_code TEXT, -- Bank branch code
  iban TEXT, -- International Bank Account Number (if applicable)
  swift_code TEXT, -- SWIFT/BIC code (if applicable)
  account_type TEXT, -- e.g., 'Savings', 'Current', 'Checking'
  currency TEXT DEFAULT 'USD', -- Account currency
  is_primary BOOLEAN DEFAULT true, -- Primary bank account for salary
  notes TEXT, -- Additional notes
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_bank_details_employee_id ON employee_bank_details(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_bank_details_bank_name ON employee_bank_details(bank_name);

-- Enable RLS
ALTER TABLE employee_bank_details ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Employees can view their own bank details" ON employee_bank_details;
CREATE POLICY "Employees can view their own bank details" ON employee_bank_details
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_bank_details.employee_id
    )
  );

DROP POLICY IF EXISTS "Employees can create their own bank details" ON employee_bank_details;
CREATE POLICY "Employees can create their own bank details" ON employee_bank_details
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_bank_details.employee_id
    )
  );

DROP POLICY IF EXISTS "Employees can update their own bank details" ON employee_bank_details;
CREATE POLICY "Employees can update their own bank details" ON employee_bank_details
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_bank_details.employee_id
    )
  );

DROP POLICY IF EXISTS "Employees can delete their own bank details" ON employee_bank_details;
CREATE POLICY "Employees can delete their own bank details" ON employee_bank_details
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_bank_details.employee_id
    )
  );

DROP POLICY IF EXISTS "Admins can view all bank details" ON employee_bank_details;
CREATE POLICY "Admins can view all bank details" ON employee_bank_details
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can create bank details for any employee" ON employee_bank_details;
CREATE POLICY "Admins can create bank details for any employee" ON employee_bank_details
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can update all bank details" ON employee_bank_details;
CREATE POLICY "Admins can update all bank details" ON employee_bank_details
  FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can delete all bank details" ON employee_bank_details;
CREATE POLICY "Admins can delete all bank details" ON employee_bank_details
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Add comments
COMMENT ON TABLE employee_bank_details IS 'Employee bank account information for payroll';
COMMENT ON COLUMN employee_bank_details.account_number IS 'Bank account number';
COMMENT ON COLUMN employee_bank_details.account_holder_name IS 'Name on the bank account';
COMMENT ON COLUMN employee_bank_details.is_primary IS 'Indicates if this is the primary account for salary payments';

