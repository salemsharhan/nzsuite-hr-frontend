-- Create Employee Shifts Table (Supports multiple shifts per day)
CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  
  -- Shift details
  shift_name TEXT, -- Optional: e.g., "Morning", "Evening", "Night"
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_minutes INTEGER DEFAULT 0,
  
  -- Validity period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_company_id ON employee_shifts(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_day ON employee_shifts(employee_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_active ON employee_shifts(employee_id, is_active, effective_from);

-- Enable RLS
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable read access for authenticated users on employee_shifts" ON employee_shifts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role on employee_shifts" ON employee_shifts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update for service role on employee_shifts" ON employee_shifts
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable delete for service role on employee_shifts" ON employee_shifts
  FOR DELETE USING (auth.role() = 'service_role');

-- Update trigger
CREATE OR REPLACE FUNCTION update_employee_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_shifts_updated_at
  BEFORE UPDATE ON employee_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_shifts_updated_at();

