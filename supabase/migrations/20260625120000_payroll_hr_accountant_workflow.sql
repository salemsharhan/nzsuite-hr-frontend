-- HR notifications + accountant processing step after CEO approval

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS payroll_hr_wa_jid TEXT,
  ADD COLUMN IF NOT EXISTS payroll_hr_phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS payroll_hr_name TEXT,
  ADD COLUMN IF NOT EXISTS payroll_accountant_wa_jid TEXT,
  ADD COLUMN IF NOT EXISTS payroll_accountant_phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS payroll_accountant_name TEXT;

COMMENT ON COLUMN company_settings.payroll_hr_wa_jid IS
  'WhatsApp JID of HR contact — receives status updates at each payroll approval step';
COMMENT ON COLUMN company_settings.payroll_accountant_wa_jid IS
  'WhatsApp JID of accountant — receives final draft after CEO approval';

ALTER TABLE payroll_reports
  ADD COLUMN IF NOT EXISTS accountant_whats_task_id UUID,
  ADD COLUMN IF NOT EXISTS accountant_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accountant_completed_by_name TEXT;

ALTER TABLE payroll_reports DROP CONSTRAINT IF EXISTS payroll_reports_approval_status_check;

ALTER TABLE payroll_reports
  ADD CONSTRAINT payroll_reports_approval_status_check
  CHECK (
    approval_status IN (
      'draft',
      'pending_approval',
      'pending_gm',
      'pending_ceo',
      'pending_accountant',
      'completed',
      'approved',
      'rejected',
      'on_hold',
      'need_update'
    )
  );

COMMENT ON COLUMN payroll_reports.approval_status IS
  'draft|pending_gm|pending_ceo|pending_accountant|completed|approved|rejected|on_hold|need_update';
