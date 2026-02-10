-- Add middle name and Arabic name fields to employees table

-- Middle Name
ALTER TABLE employees ADD COLUMN IF NOT EXISTS middle_name TEXT;

-- Arabic Name Fields
ALTER TABLE employees ADD COLUMN IF NOT EXISTS arabic_first_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS arabic_middle_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS arabic_last_name TEXT;

-- Create indexes for Arabic name fields (optional, for search functionality)
CREATE INDEX IF NOT EXISTS idx_employees_arabic_first_name ON employees(arabic_first_name);
CREATE INDEX IF NOT EXISTS idx_employees_arabic_last_name ON employees(arabic_last_name);

