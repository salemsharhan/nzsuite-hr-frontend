-- Create Employee Education Table
-- Allows multiple education entries per employee (schooling, higher studies, etc.)

CREATE TABLE IF NOT EXISTS employee_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  institution_name TEXT NOT NULL, -- University, School, College name
  place_of_graduation TEXT NOT NULL, -- City, Country
  graduation_year INTEGER NOT NULL,
  degree_type TEXT, -- e.g., 'High School', 'Bachelor', 'Master', 'PhD', 'Diploma', 'Certificate'
  field_of_study TEXT, -- e.g., 'Computer Science', 'Business Administration'
  grade_or_gpa TEXT, -- Optional: GPA, Grade, Percentage
  is_primary BOOLEAN DEFAULT false, -- Mark the highest/primary qualification
  notes TEXT, -- Additional notes
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_education_employee_id ON employee_education(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_education_graduation_year ON employee_education(graduation_year DESC);

-- Enable RLS
ALTER TABLE employee_education ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Employees can view their own education records" ON employee_education;
CREATE POLICY "Employees can view their own education records" ON employee_education
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_education.employee_id
    )
  );

DROP POLICY IF EXISTS "Employees can create their own education records" ON employee_education;
CREATE POLICY "Employees can create their own education records" ON employee_education
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_education.employee_id
    )
  );

DROP POLICY IF EXISTS "Employees can update their own education records" ON employee_education;
CREATE POLICY "Employees can update their own education records" ON employee_education
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_education.employee_id
    )
  );

DROP POLICY IF EXISTS "Employees can delete their own education records" ON employee_education;
CREATE POLICY "Employees can delete their own education records" ON employee_education
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_education.employee_id
    )
  );

DROP POLICY IF EXISTS "Admins can view all education records" ON employee_education;
CREATE POLICY "Admins can view all education records" ON employee_education
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can create education records for any employee" ON employee_education;
CREATE POLICY "Admins can create education records for any employee" ON employee_education
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can update all education records" ON employee_education;
CREATE POLICY "Admins can update all education records" ON employee_education
  FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can delete all education records" ON employee_education;
CREATE POLICY "Admins can delete all education records" ON employee_education
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Add comments
COMMENT ON TABLE employee_education IS 'Employee education history - supports multiple entries per employee';
COMMENT ON COLUMN employee_education.institution_name IS 'Name of the educational institution';
COMMENT ON COLUMN employee_education.place_of_graduation IS 'Location where the employee graduated (city, country)';
COMMENT ON COLUMN employee_education.graduation_year IS 'Year of graduation';
COMMENT ON COLUMN employee_education.degree_type IS 'Type of degree or qualification';
COMMENT ON COLUMN employee_education.is_primary IS 'Marks the highest/primary qualification';

