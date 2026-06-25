-- CEO OTP unlock for editing locked payroll reports

CREATE TABLE IF NOT EXISTS payroll_ceo_edit_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_report_id UUID NOT NULL REFERENCES payroll_reports(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  unlock_token_hash TEXT,
  unlock_expires_at TIMESTAMPTZ,
  requested_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_ceo_edit_unlocks_report
  ON payroll_ceo_edit_unlocks(payroll_report_id, created_at DESC);

COMMENT ON TABLE payroll_ceo_edit_unlocks IS
  'OTP + short-lived unlock tokens so HR can edit approved/pending payroll after CEO verifies via WhatsApp';
