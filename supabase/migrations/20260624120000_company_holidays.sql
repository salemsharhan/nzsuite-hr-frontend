-- Company holidays: excluded from payroll scheduled working days
CREATE TABLE IF NOT EXISTS company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_company_holiday_date UNIQUE (company_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_company_holidays_company_id ON company_holidays(company_id);
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(holiday_date);

ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for company holidays" ON company_holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND user_roles.company_id = company_holidays.company_id)
      )
      AND user_roles.is_active = true
    )
  );

CREATE TRIGGER update_company_holidays_updated_at BEFORE UPDATE ON company_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
