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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const whatsTaskUrl = (Deno.env.get('WHATS_TASK_URL') ?? '').trim().replace(/\/+$/, '')
  const integrationSecret = (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()
  const callbackUrl = `${supabaseUrl}/functions/v1/payroll-approval-callback`

  if (!whatsTaskUrl || !integrationSecret) {
    return json({ error: 'Payroll integration not configured on server' }, 503)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: authData, error: authErr } = await userClient.auth.getUser()
  if (authErr || !authData?.user) return json({ error: 'Unauthorized' }, 401)

  const user = authData.user
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const companyId = String(body.company_id ?? '').trim()
  const reportId = String(body.payroll_report_id ?? '').trim()
  const year = Number(body.year)
  const month = Number(body.month)
  const department = String(body.department ?? 'all')
  const deptKey = department === 'all' ? '' : department
  const excelBase64 = String(body.attachment_base64 ?? body.excel_base64 ?? '').trim()
  const excelFilename = String(body.attachment_filename ?? body.excel_filename ?? 'payroll.xlsx').trim()
  const attachmentMime = String(
    body.attachment_mime ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ).trim()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()

  if (!companyId) return json({ error: 'Missing company_id' }, 400)

  const { data: settings, error: settingsErr } = await admin
    .from('company_settings')
    .select(
      'payroll_approver_wa_jid, payroll_approver_phone_e164, payroll_approver_name, taskhub_workspace_user_id',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  if (settingsErr) return json({ error: settingsErr.message }, 500)

  const approverJid = String((settings as { payroll_approver_wa_jid?: string })?.payroll_approver_wa_jid ?? '').trim()
  const workspaceUserId = String((settings as { taskhub_workspace_user_id?: string })?.taskhub_workspace_user_id ?? '').trim()

  if (!approverJid || !workspaceUserId) {
    return json(
      {
        error:
          'Payroll approver not configured. Set approver WhatsApp JID and Task Hub workspace user ID in Company Settings.',
      },
      400,
    )
  }

  let report: { id: string; approval_status?: string; report_data?: { meta?: { periodLabel?: string } } } | null = null

  if (reportId) {
    const { data, error } = await admin
      .from('payroll_reports')
      .select('id, approval_status, report_data, company_id')
      .eq('id', reportId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return json({ error: error.message }, 500)
    report = data
  } else if (year && month) {
    const { data, error } = await admin
      .from('payroll_reports')
      .select('id, approval_status, report_data, company_id')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month)
      .eq('department', deptKey)
      .maybeSingle()
    if (error) return json({ error: error.message }, 500)
    report = data
  }

  if (!report) return json({ error: 'Payroll report not found. Save payroll first.' }, 404)

  const currentStatus = String(report.approval_status ?? 'draft')
  if (currentStatus === 'pending_approval') {
    return json({ error: 'Payroll is already pending approval' }, 409)
  }
  if (currentStatus === 'approved') {
    return json({ error: 'Payroll is already approved' }, 409)
  }

  const periodLabel = report.report_data?.meta?.periodLabel ?? `Payroll ${month}/${year}`
  const taskTitle = title || `اعتماد رواتب — ${periodLabel}`
  const taskDescription =
    description ||
    `طلب اعتماد كشف رواتب من NZSuite HR.\nالفترة: ${periodLabel}\nمقدم من: ${user.email ?? user.id}`

  const integrationRef = `payroll_report:${report.id}`

  const wtRes = await fetch(`${whatsTaskUrl}/functions/v1/hr-create-approval-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Integration-Secret': integrationSecret,
    },
    body: JSON.stringify({
      workspace_user_id: workspaceUserId,
      assignee_wa_jid: approverJid,
      title: taskTitle,
      description: taskDescription,
      integration_ref: integrationRef,
      integration_callback_url: callbackUrl,
      attachment: excelBase64
        ? {
            filename: excelFilename,
            mime: attachmentMime,
            base64: excelBase64,
          }
        : undefined,
    }),
  })

  const wtRaw = await wtRes.text()
  let wtJson: { task_id?: string; error?: string; reused?: boolean } = {}
  try {
    wtJson = JSON.parse(wtRaw)
  } catch {
    wtJson = {}
  }

  if (!wtRes.ok) {
    return json({ error: wtJson.error ?? `Whats-Task error (${wtRes.status})` }, 502)
  }

  const taskId = String(wtJson.task_id ?? '').trim()
  if (!taskId) return json({ error: 'Whats-Task did not return task_id' }, 502)

  const { error: updErr } = await admin
    .from('payroll_reports')
    .update({
      approval_status: 'pending_approval',
      submitted_at: new Date().toISOString(),
      submitted_by_user_id: user.id,
      submitted_by_email: user.email ?? null,
      whats_task_id: taskId,
      whats_task_owner_id: workspaceUserId,
    })
    .eq('id', report.id)

  if (updErr) return json({ error: updErr.message }, 500)

  return json({
    ok: true,
    payroll_report_id: report.id,
    whats_task_id: taskId,
    reused: Boolean(wtJson.reused),
  })
})
