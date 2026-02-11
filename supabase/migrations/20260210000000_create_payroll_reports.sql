-- Saved payroll reports (one per company/year/month/department).
-- First load builds from employees+attendance+leave; then user saves and next time we load from here.
-- department '' = all departments, otherwise specific department name.
CREATE TABLE IF NOT EXISTS payroll_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  department TEXT NOT NULL DEFAULT '', -- '' = all, or specific department name
  report_data JSONB NOT NULL, -- { meta: {...}, rows: KdaPayrollReportRow[] }
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saved_by_user_id UUID, -- auth user who saved
  saved_by_email TEXT,   -- for display without joining auth
  UNIQUE(company_id, year, month, department)
);

CREATE INDEX IF NOT EXISTS idx_payroll_reports_company_year_month
  ON payroll_reports(company_id, year, month);

ALTER TABLE payroll_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write (scope by company in app or add policy by company_id)
CREATE POLICY "Allow authenticated access to payroll_reports"
  ON payroll_reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE payroll_reports IS 'Saved KDA payroll report snapshots; loaded when user opens same month/year instead of rebuilding from employees/attendance/leave';
