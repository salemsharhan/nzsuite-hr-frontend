-- Leave GM workflow + HR approval requests

-- leave_requests: extend status and GM/HR decision fields
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS hr_decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hr_decided_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gm_note TEXT,
  ADD COLUMN IF NOT EXISTS gm_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forwarded_to_gm_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_request_id UUID,
  ADD COLUMN IF NOT EXISTS hr_note TEXT;

COMMENT ON COLUMN public.leave_requests.hr_decision_at IS 'When HR approved/rejected or forwarded to GM';
COMMENT ON COLUMN public.leave_requests.gm_note IS 'GM note on approve/reject/hold';
COMMENT ON COLUMN public.leave_requests.approval_request_id IS 'Linked hr_approval_requests row when forwarded to GM';

-- Status values: Pending | Pending_GM | On_Hold | Approved | Rejected (text, no CHECK historically)

CREATE TABLE IF NOT EXISTS public.hr_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending_gm'
    CHECK (status IN ('pending_gm', 'approved', 'rejected', 'on_hold')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'leave')),
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  attachment_path TEXT,
  attachment_mime TEXT,
  attachment_filename TEXT,
  gm_note TEXT,
  hr_note TEXT,
  hr_created_by UUID,
  whats_task_task_id TEXT,
  integration_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hr_approval_requests_company_status
  ON public.hr_approval_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_approval_requests_leave
  ON public.hr_approval_requests(leave_request_id)
  WHERE leave_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hr_approval_requests_integration_ref
  ON public.hr_approval_requests(integration_ref)
  WHERE integration_ref IS NOT NULL;

-- FK from leave to approval (added after table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_approval_request_id_fkey'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_approval_request_id_fkey
      FOREIGN KEY (approval_request_id) REFERENCES public.hr_approval_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.hr_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_approval_requests_select" ON public.hr_approval_requests;
CREATE POLICY "hr_approval_requests_select" ON public.hr_approval_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hr_approval_requests_insert" ON public.hr_approval_requests;
CREATE POLICY "hr_approval_requests_insert" ON public.hr_approval_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "hr_approval_requests_update" ON public.hr_approval_requests;
CREATE POLICY "hr_approval_requests_update" ON public.hr_approval_requests
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "hr_approval_requests_delete" ON public.hr_approval_requests;
CREATE POLICY "hr_approval_requests_delete" ON public.hr_approval_requests
  FOR DELETE USING (true);

-- Storage bucket for approval attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('hr-approval-attachments', 'hr-approval-attachments', false, 15728640)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "hr_approval_attachments_select" ON storage.objects;
CREATE POLICY "hr_approval_attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'hr-approval-attachments');

DROP POLICY IF EXISTS "hr_approval_attachments_insert" ON storage.objects;
CREATE POLICY "hr_approval_attachments_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'hr-approval-attachments');

DROP POLICY IF EXISTS "hr_approval_attachments_update" ON storage.objects;
CREATE POLICY "hr_approval_attachments_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'hr-approval-attachments');

DROP POLICY IF EXISTS "hr_approval_attachments_delete" ON storage.objects;
CREATE POLICY "hr_approval_attachments_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'hr-approval-attachments');
