-- Two-stage payroll approval: GM first, then CEO

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS payroll_ceo_approver_wa_jid TEXT,
  ADD COLUMN IF NOT EXISTS payroll_ceo_approver_phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS payroll_ceo_approver_name TEXT;

COMMENT ON COLUMN company_settings.payroll_approver_wa_jid IS
  'WhatsApp JID of GM (first-stage payroll approver)';
COMMENT ON COLUMN company_settings.payroll_ceo_approver_wa_jid IS
  'WhatsApp JID of CEO (final payroll approver)';

ALTER TABLE payroll_reports
  ADD COLUMN IF NOT EXISTS gm_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gm_approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS gm_approval_note TEXT,
  ADD COLUMN IF NOT EXISTS gm_whats_task_id UUID,
  ADD COLUMN IF NOT EXISTS ceo_whats_task_id UUID,
  ADD COLUMN IF NOT EXISTS approval_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS approval_attachment_filename TEXT,
  ADD COLUMN IF NOT EXISTS approval_attachment_mime TEXT;

ALTER TABLE payroll_reports DROP CONSTRAINT IF EXISTS payroll_reports_approval_status_check;

ALTER TABLE payroll_reports
  ADD CONSTRAINT payroll_reports_approval_status_check
  CHECK (
    approval_status IN (
      'draft',
      'pending_approval',
      'pending_gm',
      'pending_ceo',
      'approved',
      'rejected',
      'on_hold',
      'need_update'
    )
  );

COMMENT ON COLUMN payroll_reports.approval_status IS
  'draft|pending_gm|pending_ceo|approved|rejected|on_hold|need_update — GM approves first, then CEO';

INSERT INTO storage.buckets (id, name, public)
VALUES ('payroll-approval-attachments', 'payroll-approval-attachments', false)
ON CONFLICT (id) DO NOTHING;
