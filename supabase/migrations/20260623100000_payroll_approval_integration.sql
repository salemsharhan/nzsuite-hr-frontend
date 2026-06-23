-- Payroll approval workflow + Whats-Task integration settings

ALTER TABLE payroll_reports
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'on_hold', 'need_update'));

ALTER TABLE payroll_reports
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS submitted_by_email TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS whats_task_id UUID,
  ADD COLUMN IF NOT EXISTS whats_task_owner_id UUID;

CREATE INDEX IF NOT EXISTS idx_payroll_reports_approval_status
  ON payroll_reports(company_id, approval_status);

COMMENT ON COLUMN payroll_reports.approval_status IS
  'draft|pending_approval|approved|rejected|on_hold|need_update — synced from Whats-Task approval poll when submitted';

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS payroll_approver_wa_jid TEXT,
  ADD COLUMN IF NOT EXISTS payroll_approver_phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS payroll_approver_name TEXT,
  ADD COLUMN IF NOT EXISTS taskhub_workspace_user_id UUID;

COMMENT ON COLUMN company_settings.payroll_approver_wa_jid IS
  'WhatsApp JID of payroll approver in Task Hub directory (e.g. 965xxxxxxxx@c.us)';
COMMENT ON COLUMN company_settings.taskhub_workspace_user_id IS
  'UUID of Task Hub workspace owner whose WAHA settings send the approval poll';
