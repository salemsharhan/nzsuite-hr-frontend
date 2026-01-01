-- Add salary allowance columns to employees table
-- This allows storing base salary and individual allowances separately

-- Add base salary column (if not exists, keep salary for backward compatibility)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12, 2);

-- Add allowance columns
ALTER TABLE employees ADD COLUMN IF NOT EXISTS housing_allowance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS meal_allowance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS medical_allowance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(12, 2) DEFAULT 0;

-- Create index for base_salary for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_base_salary ON employees(base_salary);

-- Add comment to columns
COMMENT ON COLUMN employees.base_salary IS 'Base salary amount before allowances';
COMMENT ON COLUMN employees.housing_allowance IS 'Housing allowance amount';
COMMENT ON COLUMN employees.transport_allowance IS 'Transport allowance amount';
COMMENT ON COLUMN employees.meal_allowance IS 'Meal allowance amount';
COMMENT ON COLUMN employees.medical_allowance IS 'Medical allowance amount';
COMMENT ON COLUMN employees.other_allowances IS 'Other miscellaneous allowances';

