import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ATTACHMENT_BUCKET = 'payroll-approval-attachments'

// --- payrollWhatsApp (inlined for single-file Dashboard deploy) ---
const AR_PAYROLL_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

function normalizeWhatsTaskBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!u) return ''
  const fnIdx = u.indexOf('/functions/v1')
  if (fnIdx > 0) u = u.slice(0, fnIdx).replace(/\/+$/, '')
  return u
}

function whatsTaskFunctionUrl(baseUrl: string, functionName: string): string {
  return `${normalizeWhatsTaskBaseUrl(baseUrl)}/functions/v1/${functionName}`
}

function whatsTaskFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const anonKey = (Deno.env.get('WHATS_TASK_ANON_KEY') ?? '').trim()
  if (anonKey) {
    headers['apikey'] = anonKey
    headers['Authorization'] = `Bearer ${anonKey}`
  }
  return headers
}

function validateWhatsTaskBaseUrl(baseUrl: string): string | null {
  const base = normalizeWhatsTaskBaseUrl(baseUrl)
  if (!base) return 'WHATS_TASK_URL is not set'
  try {
    const host = new URL(base).hostname
    if (!host.endsWith('.supabase.co')) {
      return 'WHATS_TASK_URL must be https://YOUR_WHATS_TASK_PROJECT.supabase.co (not the nztask portal URL)'
    }
  } catch {
    return 'WHATS_TASK_URL is not a valid URL'
  }
  if (base.includes('wqfbltrnlwngyohvxjjq')) {
    return 'WHATS_TASK_URL points at NZSuite HR — use the Whats-Task project URL instead'
  }
  return null
}

async function callWhatsTaskFunction(
  baseUrl: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; url: string; data: Record<string, unknown>; raw: string }> {
  const url = whatsTaskFunctionUrl(baseUrl, functionName)
  const res = await fetch(url, {
    method: 'POST',
    headers: whatsTaskFetchHeaders(),
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(raw) as Record<string, unknown>
  } catch {
    data = {}
  }
  return { ok: res.ok, status: res.status, url, data, raw }
}

function formatPayrollPeriodAr(month: number, year: number): string {
  const m = Math.max(1, Math.min(12, month))
  return `${AR_PAYROLL_MONTHS[m - 1]} ${year}`
}

function buildUniquePayrollAttachmentMeta(
  reportYear: number,
  reportMonth: number,
  companyId: string,
  reportId: string,
  originalFilename: string,
): { storagePath: string; filename: string } {
  const now = new Date()
  const y = reportYear > 0 ? reportYear : now.getUTCFullYear()
  const m = reportMonth >= 1 && reportMonth <= 12 ? reportMonth : now.getUTCMonth() + 1
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '')
  const serial = crypto.randomUUID().slice(0, 8)
  const extMatch = originalFilename.match(/(\.[a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : '.xlsx'
  const filename = `payroll-${y}-${String(m).padStart(2, '0')}-${stamp}-${serial}${ext}`
  const storagePath = `${companyId}/${reportId}/submissions/${stamp}-${serial}${ext}`
  return { storagePath, filename }
}

interface PayrollNotifySettings {
  workspace_user_id: string
  hr_jid?: string
}

async function loadPayrollNotifySettings(
  admin: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: object | null; error: object | null }>
        }
      }
    }
  },
  companyId: string,
): Promise<PayrollNotifySettings | null> {
  const { data, error } = await admin
    .from('company_settings')
    .select('taskhub_workspace_user_id, payroll_hr_wa_jid')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error || !data) return null

  const workspaceUserId = String((data as { taskhub_workspace_user_id?: string }).taskhub_workspace_user_id ?? '').trim()
  if (!workspaceUserId) return null

  return {
    workspace_user_id: workspaceUserId,
    hr_jid: String((data as { payroll_hr_wa_jid?: string }).payroll_hr_wa_jid ?? '').trim() || undefined,
  }
}

async function sendWhatsAppText(
  whatsTaskUrl: string,
  workspaceUserId: string,
  recipientJid: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const jid = recipientJid.trim().toLowerCase()
  if (!jid) return { ok: false, error: 'Missing recipient JID' }

  const res = await fetch(whatsTaskFunctionUrl(whatsTaskUrl, 'hr-send-text-message'), {
    method: 'POST',
    headers: whatsTaskFetchHeaders(),
    body: JSON.stringify({
      workspace_user_id: workspaceUserId,
      recipient_wa_jid: jid,
      text: text.slice(0, 2000),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string }).error ?? `Whats-Task error (${res.status})` }
  }
  return { ok: true }
}

async function notifyPayrollJids(
  whatsTaskUrl: string,
  settings: PayrollNotifySettings,
  jids: string[],
  message: string,
): Promise<void> {
  const unique = [...new Set(jids.map((j) => j.trim().toLowerCase()).filter(Boolean))]
  for (const jid of unique) {
    const result = await sendWhatsAppText(whatsTaskUrl, settings.workspace_user_id, jid, message)
    if (!result.ok) console.error('payroll notify failed', jid, result.error)
  }
}
// --- end payrollWhatsApp ---

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function createWhatsTaskApproval(
  whatsTaskUrl: string,
  _callbackUrl: string,
  payload: Record<string, unknown>,
): Promise<{ task_id?: string; reused?: boolean; attachment_links?: string[]; assignee_jid?: string; error?: string }> {
  const wt = await callWhatsTaskFunction(
    whatsTaskUrl,
    'hr-create-approval-task',
    payload,
  )

  const wtJson = wt.data as {
    task_id?: string
    error?: string
    reused?: boolean
    attachment_links?: string[]
    whatsapp_skipped?: boolean
    whatsapp_sent?: boolean
    assignee_jid?: string
  }

  if (!wt.ok) {
    const detail = String(wtJson.error ?? '') || (wt.raw.slice(0, 300) || `HTTP ${wt.status}`)
    const hint =
      wt.status === 405
        ? ` — check WHATS_TASK_URL (must be https://YOUR_WHATS_TASK_PROJECT.supabase.co, not nztask portal) and set WHATS_TASK_ANON_KEY. Called ${wt.url}`
        : ''
    return { error: `Whats-Task hr-create-approval-task: ${detail}${hint}` }
  }

  const taskId = String(wtJson.task_id ?? '').trim()
  if (!taskId) return { error: 'Whats-Task did not return task_id' }

  if (wtJson.whatsapp_skipped || wtJson.whatsapp_sent === false) {
    return {
      error:
        'Task was created but GM WhatsApp poll was not sent. Redeploy hr-create-approval-task on Whats-Task, revert payroll to draft, and submit again.',
      task_id: taskId,
    }
  }

  return {
    task_id: taskId,
    reused: Boolean(wtJson.reused),
    assignee_jid: wtJson.assignee_jid ? String(wtJson.assignee_jid) : undefined,
    attachment_links: Array.isArray(wtJson.attachment_links)
      ? wtJson.attachment_links.map((l) => String(l).trim()).filter(Boolean)
      : [],
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const whatsTaskUrl = (Deno.env.get('WHATS_TASK_URL') ?? '').trim().replace(/\/+$/, '')
  const callbackUrl = `${supabaseUrl}/functions/v1/payroll-approval-callback`

  if (!whatsTaskUrl) {
    return json({ error: 'WHATS_TASK_URL is not configured on server' }, 503)
  }

  const whatsTaskUrlError = validateWhatsTaskBaseUrl(whatsTaskUrl)
  if (whatsTaskUrlError) {
    return json({ error: whatsTaskUrlError, step: 'whats_task_config' }, 503)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  let submittedByUserId = String(body.submitted_by_user_id ?? '').trim() || null
  let submittedByEmail = String(body.submitted_by_email ?? '').trim() || null

  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader.replace(/^Bearer\s+/i, '').trim()) {
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData } = await userClient.auth.getUser()
    if (authData?.user) {
      submittedByUserId = authData.user.id
      submittedByEmail = authData.user.email ?? submittedByEmail
    }
  }

  const submitterLabel = submittedByEmail ?? submittedByUserId ?? 'NZSuite HR'

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
      'payroll_approver_wa_jid, payroll_approver_name, payroll_approver_phone_e164, payroll_ceo_approver_wa_jid, payroll_ceo_approver_name, taskhub_workspace_user_id',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  if (settingsErr) return json({ error: settingsErr.message }, 500)

  const gmJid = String((settings as { payroll_approver_wa_jid?: string })?.payroll_approver_wa_jid ?? '').trim()
  const gmPhone = String((settings as { payroll_approver_phone_e164?: string })?.payroll_approver_phone_e164 ?? '').trim()
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
  const blockedStatuses = ['pending_approval', 'pending_gm', 'pending_ceo', 'pending_accountant', 'completed', 'approved']
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
    `طلب اعتماد كشف رواتب من NZSuite HR (المرحلة الأولى — المدير العام).\nالفترة: ${periodLabel}\nمقدم من: ${submitterLabel}`

  const integrationRef = `payroll_report:${report.id}:gm`

  let attachmentPath: string | null = null
  let submissionFilename = excelFilename
  if (excelBase64) {
    try {
      const binary = Uint8Array.from(atob(excelBase64), (c) => c.charCodeAt(0))
      const uniqueMeta = buildUniquePayrollAttachmentMeta(
        reportYear,
        reportMonth,
        companyId,
        report.id,
        excelFilename,
      )
      attachmentPath = uniqueMeta.storagePath
      submissionFilename = uniqueMeta.filename
      const { error: uploadErr } = await admin.storage
        .from(ATTACHMENT_BUCKET)
        .upload(attachmentPath, binary, {
          contentType: attachmentMime,
          upsert: false,
        })
      if (uploadErr) {
        console.error('attachment upload failed', uploadErr)
        attachmentPath = null
        submissionFilename = excelFilename
      }
    } catch (e) {
      console.error('attachment encode failed', e)
      attachmentPath = null
      submissionFilename = excelFilename
    }
  }

  const taskPayload = {
    workspace_user_id: workspaceUserId,
    assignee_wa_jid: gmJid,
    assignee_phone_e164: gmPhone || undefined,
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
          filename: submissionFilename,
          mime: attachmentMime,
          base64: excelBase64,
        }
      : undefined,
  }

  const wtResult = await createWhatsTaskApproval(whatsTaskUrl, callbackUrl, taskPayload)

  if (wtResult.error) {
    console.error('whats-task create failed', wtResult.error)
    return json({ error: wtResult.error, step: 'whats_task_create' }, 502)
  }

  const taskId = wtResult.task_id!

  const { error: updErr } = await admin
    .from('payroll_reports')
    .update({
      approval_status: 'pending_gm',
      submitted_at: new Date().toISOString(),
      submitted_by_user_id: submittedByUserId,
      submitted_by_email: submittedByEmail,
      whats_task_id: taskId,
      whats_task_owner_id: workspaceUserId,
      gm_whats_task_id: taskId,
      ceo_whats_task_id: null,
      accountant_whats_task_id: null,
      accountant_completed_at: null,
      accountant_completed_by_name: null,
      gm_approved_at: null,
      gm_approved_by_name: null,
      gm_approval_note: null,
      approved_at: null,
      approved_by_name: null,
      approval_note: null,
      approval_attachment_path: attachmentPath,
      approval_attachment_filename: excelBase64 ? submissionFilename : null,
      approval_attachment_mime: excelBase64 ? attachmentMime : null,
    })
    .eq('id', report.id)

  if (updErr) return json({ error: updErr.message }, 500)

  const notifySettings = await loadPayrollNotifySettings(admin, companyId)
  if (notifySettings?.hr_jid) {
    await notifyPayrollJids(
      whatsTaskUrl,
      notifySettings,
      [notifySettings.hr_jid],
      `📋 تحديث رواتب — ${periodLabelAr}\n\n` +
        `➡️ تم إرسال كشف رواتب شهر ${periodLabelAr} إلى المدير العام (GM) للاعتماد.\n` +
        `مقدم من: ${submitterLabel}`,
    )
  }

  return json({
    ok: true,
    payroll_report_id: report.id,
    whats_task_id: taskId,
    approval_stage: 'gm',
    reused: Boolean(wtResult.reused),
    assignee_jid: wtResult.assignee_jid ?? gmJid,
  })
  } catch (e) {
    console.error('submit-payroll-approval error', e)
    return json({ error: e instanceof Error ? e.message : 'Internal server error' }, 500)
  }
})
