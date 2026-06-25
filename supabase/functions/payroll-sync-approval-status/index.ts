import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeWhatsTaskBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!u) return ''
  const fnIdx = u.indexOf('/functions/v1')
  if (fnIdx > 0) u = u.slice(0, fnIdx).replace(/\/+$/, '')
  return u
}

function whatsTaskHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const anonKey = (Deno.env.get('WHATS_TASK_ANON_KEY') ?? '').trim()
  if (anonKey) {
    headers['apikey'] = anonKey
    headers['Authorization'] = `Bearer ${anonKey}`
  }
  return headers
}

const TASK_TO_CALLBACK_STATUS: Record<string, string> = {
  Approved: 'Approved',
  Rejected: 'Rejected',
  Held: 'Held',
  'Need update': 'Need update',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const whatsTaskUrl = normalizeWhatsTaskBaseUrl(Deno.env.get('WHATS_TASK_URL') ?? '')
    const admin = createClient(supabaseUrl, serviceKey)

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const companyId = String(body.company_id ?? '').trim()
    const reportId = String(body.payroll_report_id ?? '').trim()
    if (!companyId || !reportId) return json({ error: 'Missing company_id or payroll_report_id' }, 400)
    if (!whatsTaskUrl) return json({ error: 'WHATS_TASK_URL is not configured' }, 503)

    const { data: report, error: reportErr } = await admin
      .from('payroll_reports')
      .select(
        'id, company_id, approval_status, gm_whats_task_id, ceo_whats_task_id, accountant_whats_task_id, whats_task_owner_id, gm_approved_at',
      )
      .eq('id', reportId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (reportErr) return json({ error: reportErr.message }, 500)
    if (!report) return json({ error: 'Payroll report not found' }, 404)

    const status = String((report as { approval_status?: string }).approval_status ?? 'draft')
    const workspaceUserId = String((report as { whats_task_owner_id?: string }).whats_task_owner_id ?? '').trim()
    const gmApprovedAt = String((report as { gm_approved_at?: string }).gm_approved_at ?? '').trim()
    const ceoTaskId = String((report as { ceo_whats_task_id?: string }).ceo_whats_task_id ?? '').trim()

    let taskId = ''
    let expectedRef = ''
    if (status === 'pending_gm') {
      if (gmApprovedAt || ceoTaskId) {
        return json({ ok: true, synced: false, skipped: true, reason: 'gm_already_processed', approval_status: status })
      }
      taskId = String((report as { gm_whats_task_id?: string }).gm_whats_task_id ?? '').trim()
      expectedRef = `payroll_report:${reportId}:gm`
    } else if (status === 'pending_ceo') {
      taskId = String((report as { ceo_whats_task_id?: string }).ceo_whats_task_id ?? '').trim()
      expectedRef = `payroll_report:${reportId}:ceo`
    } else if (status === 'pending_accountant') {
      taskId = String((report as { accountant_whats_task_id?: string }).accountant_whats_task_id ?? '').trim()
      expectedRef = `payroll_report:${reportId}:accountant`
    } else {
      return json({ ok: true, skipped: true, reason: 'not_pending_approval', approval_status: status })
    }

    if (!taskId || !workspaceUserId) {
      return json({ error: 'Missing WhatsApp task linkage on payroll report' }, 400)
    }

    const wtRes = await fetch(`${whatsTaskUrl}/functions/v1/hr-get-approval-task`, {
      method: 'POST',
      headers: whatsTaskHeaders(),
      body: JSON.stringify({ workspace_user_id: workspaceUserId, task_id: taskId }),
    })
    const wtJson = await wtRes.json().catch(() => ({})) as {
      error?: string
      approval_status?: string
      integration_ref?: string
      assignee_display_name?: string
    }
    if (!wtRes.ok) {
      return json({ error: wtJson.error ?? `Whats-Task error (${wtRes.status})` }, 502)
    }

    const taskApproval = String(wtJson.approval_status ?? '').trim()
    const callbackStatus = TASK_TO_CALLBACK_STATUS[taskApproval]
    if (!callbackStatus || taskApproval === 'Pending') {
      return json({
        ok: true,
        synced: false,
        approval_status: status,
        task_approval_status: taskApproval || 'Pending',
      })
    }

    const integrationRef = String(wtJson.integration_ref ?? expectedRef).trim() || expectedRef
    const callbackRes = await fetch(`${supabaseUrl}/functions/v1/payroll-approval-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integration_ref: integrationRef,
        approval_status: callbackStatus,
        approver_name: wtJson.assignee_display_name ?? '',
        task_id: taskId,
      }),
    })
    const callbackJson = await callbackRes.json().catch(() => ({}))
    if (!callbackRes.ok) {
      return json(
        { error: (callbackJson as { error?: string }).error ?? `Callback failed (${callbackRes.status})` },
        502,
      )
    }

    const { data: updated } = await admin
      .from('payroll_reports')
      .select('id, approval_status, gm_approved_at, approved_at, accountant_completed_at')
      .eq('id', reportId)
      .maybeSingle()

    return json({
      ok: true,
      synced: true,
      approval_status: String((updated as { approval_status?: string })?.approval_status ?? status),
      callback: callbackJson,
    })
  } catch (e) {
    console.error('payroll-sync-approval-status error', e)
    return json({ error: e instanceof Error ? e.message : 'Internal server error' }, 500)
  }
})
