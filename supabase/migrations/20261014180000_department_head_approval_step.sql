-- Optional department-head step before the GM (per company), e.g. Ershad: teachers' leave and
-- permission requests go to the Teaching department head first. He can approve, reject or forward
-- to the GM. HR is only involved when the GM requests documents (or prepares certificates).

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS head_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS head_wa_phone TEXT;

COMMENT ON COLUMN public.departments.head_employee_id IS 'Department head who approves leave/permission requests first (when the company enables the step)';
COMMENT ON COLUMN public.departments.head_wa_phone IS 'Optional WhatsApp number override for the head (defaults to the head employee phone)';

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS requests_dept_head_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.company_settings.requests_dept_head_enabled IS
  'Leave and permission requests go to the department head before the GM';

ALTER TABLE public.request_approvals DROP CONSTRAINT IF EXISTS request_approvals_stage_check;
ALTER TABLE public.request_approvals ADD CONSTRAINT request_approvals_stage_check
  CHECK (stage IN ('pending_dept_head', 'pending_gm', 'pending_hr_docs', 'pending_hr_doc_prep', 'approved', 'completed', 'rejected', 'cancelled'));

ALTER TABLE public.request_approval_polls DROP CONSTRAINT IF EXISTS request_approval_polls_poll_type_check;
ALTER TABLE public.request_approval_polls ADD CONSTRAINT request_approval_polls_poll_type_check
  CHECK (poll_type IN ('dept', 'gm', 'hr_docs', 'hr_prep'));

-- New columns are appended so CREATE OR REPLACE keeps the existing ones intact.
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
       cs.payroll_hr_wa_jid AS hr_wa_jid, cs.payroll_hr_name AS hr_name,
       dep.name AS department_name,
       CASE WHEN dh.applies THEN dh.head_phone END AS dept_head_wa_jid,
       CASE WHEN dh.applies THEN dh.head_name END AS dept_head_name
  FROM reqs q
  JOIN public.employees e ON e.id = q.employee_id
  LEFT JOIN public.companies c ON c.id = e.company_id
  LEFT JOIN public.company_settings cs ON cs.company_id = e.company_id
  LEFT JOIN public.departments dep ON dep.id = e.department_id
  LEFT JOIN public.employees he ON he.id = dep.head_employee_id
  CROSS JOIN LATERAL (
    SELECT
      coalesce(nullif(trim(dep.head_wa_phone), ''), nullif(trim(he.phone), '')) AS head_phone,
      trim(coalesce(he.first_name, '') || ' ' || coalesce(he.last_name, '')) AS head_name,
      (coalesce(cs.requests_dept_head_enabled, false)
        AND dep.head_employee_id IS NOT NULL
        AND dep.head_employee_id <> e.id                       -- the head's own requests go to the GM
        AND coalesce(nullif(trim(dep.head_wa_phone), ''), nullif(trim(he.phone), '')) IS NOT NULL
        AND (q.kind = 'leave'
             OR (q.kind = 'request' AND (q.title ILIKE '%permission%' OR q.title ILIKE '%leave%' OR q.title ILIKE '%استئذان%'
                                         OR (q.details->>'category') ILIKE '%leave%')))
      ) AS applies
  ) dh
 WHERE q.created_at >= TIMESTAMPTZ '2026-10-14 00:00:00+03'
   AND NOT EXISTS (SELECT 1 FROM public.request_approvals ra
                    WHERE ra.source_table = q.source_table AND ra.source_id = q.source_id);

REVOKE ALL ON public.hr_flow_new_requests FROM anon, authenticated;
GRANT SELECT ON public.hr_flow_new_requests TO service_role;
