-- Monthly payroll leave / late settings per employee (HR overrides for payroll & AI)
CREATE TABLE IF NOT EXISTS employee_payroll_month_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_year INTEGER NOT NULL,
  payroll_month INTEGER NOT NULL CHECK (payroll_month >= 1 AND payroll_month <= 12),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'paid_leave', 'unpaid_leave', 'sick_leave', 'emergency_leave', 'permitted_late'
  )),
  input_mode TEXT NOT NULL DEFAULT 'days_count' CHECK (input_mode IN ('days_count', 'date_range')),
  days_count NUMERIC(6, 2),
  date_from DATE,
  date_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_payroll_month_adj_days_or_range CHECK (
    (input_mode = 'days_count' AND days_count IS NOT NULL AND days_count > 0)
    OR (input_mode = 'date_range' AND date_from IS NOT NULL AND date_to IS NOT NULL AND date_from <= date_to)
  )
);

CREATE INDEX IF NOT EXISTS idx_emp_payroll_month_adj_employee
  ON employee_payroll_month_adjustments(employee_id, payroll_year, payroll_month);

CREATE INDEX IF NOT EXISTS idx_emp_payroll_month_adj_company
  ON employee_payroll_month_adjustments(company_id, payroll_year, payroll_month);

ALTER TABLE employee_payroll_month_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read employee payroll month adjustments"
  ON employee_payroll_month_adjustments;
CREATE POLICY "Authenticated read employee payroll month adjustments"
  ON employee_payroll_month_adjustments FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated insert employee payroll month adjustments"
  ON employee_payroll_month_adjustments;
CREATE POLICY "Authenticated insert employee payroll month adjustments"
  ON employee_payroll_month_adjustments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update employee payroll month adjustments"
  ON employee_payroll_month_adjustments;
CREATE POLICY "Authenticated update employee payroll month adjustments"
  ON employee_payroll_month_adjustments FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete employee payroll month adjustments"
  ON employee_payroll_month_adjustments;
CREATE POLICY "Authenticated delete employee payroll month adjustments"
  ON employee_payroll_month_adjustments FOR DELETE
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE employee_payroll_month_adjustments IS
  'HR monthly leave/late settings per employee for payroll. paid=add salary, unpaid=deduct, sick/emergency=no pay change, permitted_late=approved late days.';
