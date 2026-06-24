import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ATTACHMENT_BUCKET = 'payroll-approval-attachments'

const AR_PAYROLL_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

function formatPayrollPeriodAr(month: number, year: number): string {
  const m = Math.max(1, Math.min(12, month))
  return `${AR_PAYROLL_MONTHS[m - 1]} ${year}`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function createWhatsTaskApproval(
  whatsTaskUrl: string,
  integrationSecret: string,
  callbackUrl: string,
  payload: Record<string, unknown>,
): Promise<{ task_id?: string; reused?: boolean; error?: string }> {
  const wtRes = await fetch(`${whatsTaskUrl}/functions/v1/hr-create-approval-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Integration-Secret': integrationSecret,
    },
    body: JSON.stringify(payload),
  })

  const wtRaw = await wtRes.text()
  let wtJson: { task_id?: string; error?: string; reused?: boolean } = {}
  try {
    wtJson = JSON.parse(wtRaw)
  } catch {
    wtJson = {}
  }

  if (!wtRes.ok) {
    return { error: wtJson.error ?? `Whats-Task error (${wtRes.status})` }
  }

  const taskId = String(wtJson.task_id ?? '').trim()
  if (!taskId) return { error: 'Whats-Task did not return task_id' }
  return { task_id: taskId, reused: Boolean(wtJson.reused) }
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
      'payroll_approver_wa_jid, payroll_approver_name, payroll_ceo_approver_wa_jid, payroll_ceo_approver_name, taskhub_workspace_user_id',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  if (settingsErr) return json({ error: settingsErr.message }, 500)

  const gmJid = String((settings as { payroll_approver_wa_jid?: string })?.payroll_approver_wa_jid ?? '').trim()
  const ceoJid = String((settings as { payroll_ceo_approver_wa_jid?: string })?.payroll_ceo_approver_wa_jid ?? '').trim()
  const workspaceUserId = String((settings as { taskhub_workspace_user_id?: string })?.taskhub_workspace_user_id ?? '').trim()

  if (!gmJid || !ceoJid || !workspaceUserId) {
    return json(
      {
        error:
          'Payroll approvers not configured. Set GM and CEO WhatsApp JIDs and Task Hub workspace user ID in Company Settings.',
      },
      400,
    )
  }

  let report: {
    id: string
    approval_status?: string
    report_data?: { meta?: { periodLabel?: string } }
    year?: number
    month?: number
  } | null = null

  if (reportId) {
    const { data, error } = await admin
      .from('payroll_reports')
      .select('id, approval_status, report_data, company_id, year, month')
      .eq('id', reportId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return json({ error: error.message }, 500)
    report = data
  } else if (year && month) {
    const { data, error } = await admin
      .from('payroll_reports')
      .select('id, approval_status, report_data, company_id, year, month')
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
  const blockedStatuses = ['pending_approval', 'pending_gm', 'pending_ceo', 'approved']
  if (blockedStatuses.includes(currentStatus)) {
    return json({ error: 'Payroll is already in approval workflow or approved' }, 409)
  }

  const reportMonth = Number(report.month ?? month)
  const reportYear = Number(report.year ?? year)
  const periodLabel = report.report_data?.meta?.periodLabel ?? `Payroll ${reportMonth}/${reportYear}`
  const periodLabelAr = formatPayrollPeriodAr(reportMonth, reportYear)
  const taskTitle = title || `اعتماد رواتب — ${periodLabel}`
  const taskDescription =
    description ||
    `طلب اعتماد كشف رواتب من NZSuite HR (المرحلة الأولى — المدير العام).\nالفترة: ${periodLabel}\nمقدم من: ${user.email ?? user.id}`

  const integrationRef = `payroll_report:${report.id}:gm`

  let attachmentPath: string | null = null
  if (excelBase64) {
    try {
      const binary = Uint8Array.from(atob(excelBase64), (c) => c.charCodeAt(0))
      attachmentPath = `${companyId}/${report.id}/approval`
      const { error: uploadErr } = await admin.storage
        .from(ATTACHMENT_BUCKET)
        .upload(attachmentPath, binary, {
          contentType: attachmentMime,
          upsert: true,
        })
      if (uploadErr) {
        console.error('attachment upload failed', uploadErr)
        attachmentPath = null
      }
    } catch (e) {
      console.error('attachment encode failed', e)
      attachmentPath = null
    }
  }

  const wtResult = await createWhatsTaskApproval(whatsTaskUrl, integrationSecret, callbackUrl, {
    workspace_user_id: workspaceUserId,
    assignee_wa_jid: gmJid,
    title: taskTitle,
    description: taskDescription,
    integration_ref: integrationRef,
    integration_callback_url: callbackUrl,
    sign_off: 'GM',
    period_label_ar: periodLabelAr,
    payroll_month: reportMonth,
    payroll_year: reportYear,
    attachment: excelBase64
      ? {
          filename: excelFilename,
          mime: attachmentMime,
          base64: excelBase64,
        }
      : undefined,
  })

  if (wtResult.error) return json({ error: wtResult.error }, 502)

  const taskId = wtResult.task_id!

  const { error: updErr } = await admin
    .from('payroll_reports')
    .update({
      approval_status: 'pending_gm',
      submitted_at: new Date().toISOString(),
      submitted_by_user_id: user.id,
      submitted_by_email: user.email ?? null,
      whats_task_id: taskId,
      whats_task_owner_id: workspaceUserId,
      gm_whats_task_id: taskId,
      ceo_whats_task_id: null,
      gm_approved_at: null,
      gm_approved_by_name: null,
      gm_approval_note: null,
      approved_at: null,
      approved_by_name: null,
      approval_note: null,
      approval_attachment_path: attachmentPath,
      approval_attachment_filename: excelBase64 ? excelFilename : null,
      approval_attachment_mime: excelBase64 ? attachmentMime : null,
    })
    .eq('id', report.id)

  if (updErr) return json({ error: updErr.message }, 500)

  return json({
    ok: true,
    payroll_report_id: report.id,
    whats_task_id: taskId,
    approval_stage: 'gm',
    reused: Boolean(wtResult.reused),
  })
})
