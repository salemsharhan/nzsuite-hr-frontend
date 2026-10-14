-- Self-service "My requests": one list of an employee's leave, employee and document requests with
-- their approval stage (#ref, department head / GM / HR documents) from the WhatsApp approval flow.
-- employee_requests is not readable by the self-service session, so employees could not see their own
-- permission / certificate requests before; this function returns only the given employee's rows.

CREATE OR REPLACE FUNCTION public.employee_my_requests(p_employee_id UUID)
RETURNS TABLE (
  source_table TEXT,
  id UUID,
  kind TEXT,
  title TEXT,
  category TEXT,
  details JSONB,
  status TEXT,
  current_approver TEXT,
  submitted_at TIMESTAMPTZ,
  ref_no BIGINT,
  stage TEXT,
  dept_head_name TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH reqs AS (
    SELECT 'leave_requests'::text AS source_table, l.id, 'leave'::text AS kind, l.leave_type AS title, 'Leave'::text AS category,
           jsonb_build_object('start_date', l.start_date, 'end_date', l.end_date, 'reason', l.reason) AS details,
           l.status, NULL::text AS current_approver, l.created_at AS submitted_at
      FROM public.leave_requests l
     WHERE l.employee_id = p_employee_id
    UNION ALL
    SELECT 'employee_requests', r.id,
           CASE WHEN r.request_category ILIKE '%letter%' OR r.request_category ILIKE '%certificat%' THEN 'document' ELSE 'request' END,
           r.request_type, r.request_category, coalesce(r.form_data, '{}'::jsonb), r.status, r.current_approver,
           coalesce(r.submitted_at, r.created_at)
      FROM public.employee_requests r
     WHERE r.employee_id = p_employee_id
    UNION ALL
    SELECT 'document_requests', d.id, 'document', d.document_type, 'Letters & Certificates',
           jsonb_build_object('purpose', d.purpose, 'language', d.language, 'destination', d.destination),
           d.status, NULL::text, coalesce(d.requested_at, d.created_at)
      FROM public.document_requests d
     WHERE d.employee_id = p_employee_id
  )
  SELECT r.source_table, r.id, r.kind, r.title, r.category, r.details, r.status, r.current_approver, r.submitted_at,
         ra.ref_no, ra.stage, nullif(ra.snapshot->>'dept_head_name', ''), coalesce(ra.updated_at, r.submitted_at)
    FROM reqs r
    LEFT JOIN public.request_approvals ra ON ra.source_table = r.source_table AND ra.source_id = r.id
   ORDER BY r.submitted_at DESC NULLS LAST
   LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.employee_my_requests(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_my_requests(UUID) TO anon, authenticated;
