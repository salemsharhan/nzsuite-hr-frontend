-- WhatsApp approval flow for leave / employee / document requests (driven by the n8n "HR Requests" workflow).
-- Flow: GM + HR notified together -> GM approves / rejects / sends to HR for documents
--       -> HR collects documents and returns it to the GM -> final decision -> HR + applicant notified.
--       Certificate / letter requests go to HR for preparation after GM approval.

CREATE TABLE IF NOT EXISTS public.request_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL CHECK (source_table IN ('leave_requests', 'employee_requests', 'document_requests')),
  source_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('leave', 'request', 'document')),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'pending_gm'
    CHECK (stage IN ('pending_gm', 'pending_hr_docs', 'pending_hr_doc_prep', 'approved', 'completed', 'rejected', 'cancelled')),
  gm_note TEXT,
  hr_note TEXT,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_request_approvals_stage ON public.request_approvals(stage);
CREATE INDEX IF NOT EXISTS idx_request_approvals_employee ON public.request_approvals(employee_id);

-- Service role only (n8n). No policies => anon/authenticated cannot read or write.
ALTER TABLE public.request_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_approvals FROM anon, authenticated;

COMMENT ON TABLE public.request_approvals IS 'WhatsApp GM/HR approval state per request, written by the n8n HR Requests workflow';

-- New requests (submitted from 2026-10-14 Kuwait time) that have not entered the WhatsApp flow yet,
-- with everything needed to notify the GM, HR and the applicant.
CREATE OR REPLACE VIEW public.hr_flow_new_requests
WITH (security_invoker = true) AS
WITH reqs AS (
  SELECT 'leave_requests'::text AS source_table, l.id AS source_id, 'leave'::text AS kind, l.employee_id, l.created_at,
         l.leave_type AS title,
         jsonb_build_object('start_date', l.start_date, 'end_date', l.end_date, 'reason', l.reason) AS details
    FROM public.leave_requests l
   WHERE l.status = 'Pending'
  UNION ALL
  SELECT 'employee_requests', r.id,
         CASE WHEN r.request_category ILIKE '%letter%' OR r.request_category ILIKE '%certificat%' THEN 'document' ELSE 'request' END,
         r.employee_id, r.created_at, r.request_type,
         jsonb_build_object('category', r.request_category, 'form', r.form_data)
    FROM public.employee_requests r
   WHERE r.status = 'Pending'
  UNION ALL
  SELECT 'document_requests', d.id, 'document', d.employee_id, d.created_at, d.document_type,
         jsonb_build_object('purpose', d.purpose, 'language', d.language, 'destination', d.destination, 'notes', d.notes)
    FROM public.document_requests d
   WHERE d.status = 'Pending'
)
SELECT q.source_table, q.source_id, q.kind, q.title, q.details, q.created_at,
       e.id AS employee_id, e.employee_id AS employee_code,
       trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) AS employee_name,
       e.phone AS employee_phone, e.company_id, c.name AS company_name,
       cs.payroll_approver_wa_jid AS gm_wa_jid, cs.payroll_approver_name AS gm_name,
       cs.payroll_hr_wa_jid AS hr_wa_jid, cs.payroll_hr_name AS hr_name
  FROM reqs q
  JOIN public.employees e ON e.id = q.employee_id
  LEFT JOIN public.companies c ON c.id = e.company_id
  LEFT JOIN public.company_settings cs ON cs.company_id = e.company_id
 WHERE q.created_at >= TIMESTAMPTZ '2026-10-14 00:00:00+03'
   AND NOT EXISTS (SELECT 1 FROM public.request_approvals ra
                    WHERE ra.source_table = q.source_table AND ra.source_id = q.source_id);

REVOKE ALL ON public.hr_flow_new_requests FROM anon, authenticated;
GRANT SELECT ON public.hr_flow_new_requests TO service_role;
GRANT ALL ON public.request_approvals TO service_role;
