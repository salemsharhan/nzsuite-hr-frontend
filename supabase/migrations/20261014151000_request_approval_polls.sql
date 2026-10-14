-- Snapshot of who/what each approval is about, and the WhatsApp polls sent for it.

ALTER TABLE public.request_approvals
  ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.request_approvals.snapshot IS
  'Request summary at intake: title, details, employee name/phone, company, GM/HR names and WhatsApp ids';

CREATE TABLE IF NOT EXISTS public.request_approval_polls (
  poll_id TEXT PRIMARY KEY,                      -- WhatsApp message id (stanza id) of the poll
  approval_id UUID NOT NULL REFERENCES public.request_approvals(id) ON DELETE CASCADE,
  poll_type TEXT NOT NULL CHECK (poll_type IN ('gm', 'hr_docs', 'hr_prep')),
  options JSONB NOT NULL,                        -- option label -> action
  stage_at_send TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  answered_option TEXT,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_approval_polls_approval ON public.request_approval_polls(approval_id);

ALTER TABLE public.request_approval_polls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_approval_polls FROM anon, authenticated;
GRANT ALL ON public.request_approval_polls TO service_role;
