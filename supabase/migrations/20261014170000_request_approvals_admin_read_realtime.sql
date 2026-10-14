-- Let HR admins see the WhatsApp approval pipeline in the app (read-only; all changes go through
-- the approval-action edge function -> n8n so WhatsApp and the app stay in sync), and stream updates live.

CREATE OR REPLACE FUNCTION public.can_view_company_approvals(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.is_active
       AND (ur.role = 'super_admin' OR (ur.role = 'admin' AND ur.company_id = p_company_id))
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_company_approvals(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_company_approvals(UUID) TO authenticated;

GRANT SELECT ON public.request_approvals TO authenticated;

DROP POLICY IF EXISTS "request_approvals_admin_read" ON public.request_approvals;
CREATE POLICY "request_approvals_admin_read" ON public.request_approvals
  FOR SELECT TO authenticated
  USING (public.can_view_company_approvals(company_id));

-- Live updates for the Approvals page (RLS still applies to realtime).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'request_approvals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.request_approvals;
  END IF;
END $$;
