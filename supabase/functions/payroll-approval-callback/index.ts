import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const HR_STATUS_MAP: Record<string, string> = {
  Approved: 'approved',
  Rejected: 'rejected',
  Held: 'on_hold',
  'Need update': 'need_update',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secret = (Deno.env.get('PAYROLL_INTEGRATION_SECRET') ?? Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()
  const got = (req.headers.get('X-Integration-Secret') ?? '').trim()
  if (!secret || got !== secret) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const integrationRef = String(body.integration_ref ?? '').trim()
  const approvalStatus = String(body.approval_status ?? '').trim()
  const note = String(body.approval_note ?? body.note ?? '').trim().slice(0, 2000)
  const approverName = String(body.approver_name ?? '').trim().slice(0, 200)

  const match = /^payroll_report:(.+)$/.exec(integrationRef)
  if (!match) return json({ error: 'Invalid integration_ref' }, 400)

  const reportId = match[1]
  const hrStatus = HR_STATUS_MAP[approvalStatus]
  if (!hrStatus) return json({ error: 'Unknown approval_status' }, 400)

  const { data: report, error: fetchErr } = await admin
    .from('payroll_reports')
    .select('id, approval_status')
    .eq('id', reportId)
    .maybeSingle()

  if (fetchErr) return json({ error: fetchErr.message }, 500)
  if (!report) return json({ error: 'Payroll report not found' }, 404)

  const current = String((report as { approval_status?: string }).approval_status ?? 'draft')
  if (current === 'approved' && hrStatus !== 'approved') {
    return json({ ok: true, skipped: 'already_approved' }, 200)
  }

  const patch: Record<string, unknown> = {
    approval_status: hrStatus,
    approved_at: new Date().toISOString(),
  }
  if (note) patch.approval_note = note
  if (approverName) patch.approved_by_name = approverName

  const { error: updErr } = await admin.from('payroll_reports').update(patch).eq('id', reportId)
  if (updErr) return json({ error: updErr.message }, 500)

  return json({ ok: true, report_id: reportId, approval_status: hrStatus }, 200)
})
