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

function whatsTaskFetchHeaders(integrationSecret: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Integration-Secret': integrationSecret,
  }
  const anonKey = (Deno.env.get('WHATS_TASK_ANON_KEY') ?? '').trim()
  if (anonKey) {
    headers['apikey'] = anonKey
    headers['Authorization'] = `Bearer ${anonKey}`
  }
  return headers
}

async function callWhatsTaskFunction(
  baseUrl: string,
  functionName: string,
  integrationSecret: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; url: string; data: Record<string, unknown>; raw: string }> {
  const url = whatsTaskFunctionUrl(baseUrl, functionName)
  const res = await fetch(url, {
    method: 'POST',
    headers: whatsTaskFetchHeaders(integrationSecret),
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

function periodLabelFromReport(report: Record<string, unknown>): string {
  const payrollMonth = Number(report.month ?? 0)
  const payrollYear = Number(report.year ?? 0)
  if (payrollMonth >= 1 && payrollMonth <= 12 && payrollYear > 0) {
    return formatPayrollPeriodAr(payrollMonth, payrollYear)
  }
  return String(
    (report as { report_data?: { meta?: { periodLabel?: string } } }).report_data?.meta?.periodLabel ?? 'الرواتب',
  )
}

interface PayrollNotifySettings {
  workspace_user_id: string
  hr_jid?: string
  gm_jid?: string
  accountant_jid?: string
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
    .select(
      'taskhub_workspace_user_id, payroll_hr_wa_jid, payroll_approver_wa_jid, payroll_accountant_wa_jid',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  if (error || !data) return null

  const workspaceUserId = String((data as { taskhub_workspace_user_id?: string }).taskhub_workspace_user_id ?? '').trim()
  if (!workspaceUserId) return null

  return {
    workspace_user_id: workspaceUserId,
    hr_jid: String((data as { payroll_hr_wa_jid?: string }).payroll_hr_wa_jid ?? '').trim() || undefined,
    gm_jid: String((data as { payroll_approver_wa_jid?: string }).payroll_approver_wa_jid ?? '').trim() || undefined,
    accountant_jid:
      String((data as { payroll_accountant_wa_jid?: string }).payroll_accountant_wa_jid ?? '').trim() || undefined,
  }
}

async function sendWhatsAppText(
  whatsTaskUrl: string,
  integrationSecret: string,
  workspaceUserId: string,
  recipientJid: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const jid = recipientJid.trim().toLowerCase()
  if (!jid) return { ok: false, error: 'Missing recipient JID' }

  const res = await fetch(whatsTaskFunctionUrl(whatsTaskUrl, 'hr-send-text-message'), {
    method: 'POST',
    headers: whatsTaskFetchHeaders(integrationSecret),
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
  integrationSecret: string,
  settings: PayrollNotifySettings,
  jids: string[],
  message: string,
): Promise<void> {
  const unique = [...new Set(jids.map((j) => j.trim().toLowerCase()).filter(Boolean))]
  for (const jid of unique) {
    const result = await sendWhatsAppText(whatsTaskUrl, integrationSecret, settings.workspace_user_id, jid, message)
    if (!result.ok) console.error('payroll notify failed', jid, result.error)
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
// --- end payrollWhatsApp ---

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

type ApprovalStage = 'gm' | 'ceo' | 'accountant' | 'legacy'

function parseIntegrationRef(ref: string): { reportId: string; stage: ApprovalStage } | null {
  const gmMatch = /^payroll_report:(.+):gm$/.exec(ref)
  if (gmMatch) return { reportId: gmMatch[1], stage: 'gm' }

  const ceoMatch = /^payroll_report:(.+):ceo$/.exec(ref)
  if (ceoMatch) return { reportId: ceoMatch[1], stage: 'ceo' }

  const accountantMatch = /^payroll_report:(.+):accountant$/.exec(ref)
  if (accountantMatch) return { reportId: accountantMatch[1], stage: 'accountant' }

  const legacyMatch = /^payroll_report:(.+)$/.exec(ref)
  if (legacyMatch) return { reportId: legacyMatch[1], stage: 'legacy' }

  return null
}

async function createWhatsTaskApproval(
  whatsTaskUrl: string,
  integrationSecret: string,
  _callbackUrl: string,
  payload: Record<string, unknown>,
): Promise<{ task_id?: string; error?: string }> {
  const wt = await callWhatsTaskFunction(
    whatsTaskUrl,
    'hr-create-approval-task',
    integrationSecret,
    payload,
  )

  const wtJson = wt.data as { task_id?: string; error?: string }

  if (!wt.ok) {
    const detail = String(wtJson.error ?? '') || (wt.raw.slice(0, 300) || `HTTP ${wt.status}`)
    return { error: `Whats-Task hr-create-approval-task: ${detail}` }
  }
  const taskId = String(wtJson.task_id ?? '').trim()
  if (!taskId) return { error: 'Whats-Task did not return task_id' }
  return { task_id: taskId }
}

async function loadReportAttachment(
  admin: ReturnType<typeof createClient>,
  report: Record<string, unknown>,
): Promise<{ base64?: string; filename: string; mime: string }> {
  const attachmentPath = String(report.approval_attachment_path ?? '').trim()
  const attachmentFilename = String(report.approval_attachment_filename ?? 'payroll.xlsx').trim()
  const attachmentMime = String(
    report.approval_attachment_mime ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ).trim()

  if (!attachmentPath) return { filename: attachmentFilename, mime: attachmentMime }

  const { data: fileData, error: dlErr } = await admin.storage.from(ATTACHMENT_BUCKET).download(attachmentPath)
  if (dlErr || !fileData) return { filename: attachmentFilename, mime: attachmentMime }

  const buf = new Uint8Array(await fileData.arrayBuffer())
  return {
    base64: bytesToBase64(buf),
    filename: attachmentFilename,
    mime: attachmentMime,
  }
}

async function sendStageApprovalTask(
  admin: ReturnType<typeof createClient>,
  report: Record<string, unknown>,
  stage: 'ceo' | 'accountant',
): Promise<{ task_id?: string; error?: string }> {
  const whatsTaskUrl = (Deno.env.get('WHATS_TASK_URL') ?? '').trim().replace(/\/+$/, '')
  const integrationSecret = (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()
  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/payroll-approval-callback`

  if (!whatsTaskUrl || !integrationSecret) {
    return { error: 'Payroll integration not configured on server' }
  }

  const companyId = String(report.company_id ?? '')
  const reportId = String(report.id ?? '')
  const payrollMonth = Number(report.month ?? 0)
  const payrollYear = Number(report.year ?? 0)
  const periodLabelAr = periodLabelFromReport(report)

  const notifySettings = await loadPayrollNotifySettings(admin, companyId)
  if (!notifySettings) return { error: 'Company payroll settings not configured' }

  const { data: approverSettings } = await admin
    .from('company_settings')
    .select(
      'payroll_ceo_approver_wa_jid, payroll_ceo_approver_phone_e164, payroll_accountant_wa_jid, payroll_accountant_phone_e164',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  const assigneeJid =
    stage === 'ceo'
      ? String((approverSettings as { payroll_ceo_approver_wa_jid?: string })?.payroll_ceo_approver_wa_jid ?? '').trim()
      : String((approverSettings as { payroll_accountant_wa_jid?: string })?.payroll_accountant_wa_jid ?? notifySettings.accountant_jid ?? '').trim()

  const assigneePhone =
    stage === 'ceo'
      ? String((approverSettings as { payroll_ceo_approver_phone_e164?: string })?.payroll_ceo_approver_phone_e164 ?? '').trim()
      : String((approverSettings as { payroll_accountant_phone_e164?: string })?.payroll_accountant_phone_e164 ?? '').trim()

  if (!assigneeJid) {
    return { error: stage === 'ceo' ? 'CEO approver not configured' : 'Accountant not configured' }
  }

  const attachment = await loadReportAttachment(admin, report)

  const title =
    stage === 'ceo'
      ? `اعتماد رواتب — ${periodLabelAr}`
      : `معالجة رواتب — ${periodLabelAr}`
  const description =
    stage === 'ceo'
      ? `اعتماد نهائي لكشف رواتب شهر ${periodLabelAr}`
      : `يرجى معالجة التحويلات البنكية لرواتب شهر ${periodLabelAr} والضغط على موافقة عند الانتهاء.`

  return createWhatsTaskApproval(whatsTaskUrl, integrationSecret, callbackUrl, {
    workspace_user_id: notifySettings.workspace_user_id,
    assignee_wa_jid: assigneeJid,
    assignee_phone_e164: assigneePhone || undefined,
    title,
    description,
    integration_ref: `payroll_report:${reportId}:${stage}`,
    integration_callback_url: callbackUrl,
    sign_off: stage === 'ceo' ? 'CEO' : 'Accountant',
    period_label_ar: periodLabelAr,
    payroll_month: payrollMonth,
    payroll_year: payrollYear,
    attachment: attachment.base64
      ? { filename: attachment.filename, mime: attachment.mime, base64: attachment.base64 }
      : undefined,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const whatsTaskUrl = (Deno.env.get('WHATS_TASK_URL') ?? '').trim().replace(/\/+$/, '')
  const integrationSecret = (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()
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

  const parsed = parseIntegrationRef(integrationRef)
  if (!parsed) return json({ error: 'Invalid integration_ref' }, 400)

  const { reportId, stage } = parsed
  const hrStatus = HR_STATUS_MAP[approvalStatus]
  if (!hrStatus) return json({ error: 'Unknown approval_status' }, 400)

  const { data: report, error: fetchErr } = await admin
    .from('payroll_reports')
    .select(
      'id, company_id, year, month, approval_status, report_data, approval_attachment_path, approval_attachment_filename, approval_attachment_mime, ceo_whats_task_id, accountant_whats_task_id, gm_approved_at',
    )
    .eq('id', reportId)
    .maybeSingle()

  if (fetchErr) return json({ error: fetchErr.message }, 500)
  if (!report) return json({ error: 'Payroll report not found' }, 404)

  const companyId = String((report as { company_id?: string }).company_id ?? '')
  const periodLabelAr = periodLabelFromReport(report as Record<string, unknown>)
  const notifySettings = await loadPayrollNotifySettings(admin, companyId)

  const current = String((report as { approval_status?: string }).approval_status ?? 'draft')
  if (current === 'completed' && hrStatus === 'approved') {
    return json({ ok: true, skipped: 'already_completed' }, 200)
  }

  // GM stage: approval advances to CEO; rejection/hold ends workflow
  if (stage === 'gm') {
    if (hrStatus === 'approved') {
      const ceoTaskId = String((report as { ceo_whats_task_id?: string }).ceo_whats_task_id ?? '').trim()
      if (current === 'pending_ceo' && ceoTaskId) {
        return json({ ok: true, skipped: 'ceo_already_sent', report_id: reportId, approval_status: current }, 200)
      }

      const ceoResult = await sendStageApprovalTask(admin, report as Record<string, unknown>, 'ceo')
      if (ceoResult.error) return json({ error: ceoResult.error }, 502)

      const patch: Record<string, unknown> = {
        approval_status: 'pending_ceo',
        gm_approved_at: new Date().toISOString(),
        whats_task_id: ceoResult.task_id,
        ceo_whats_task_id: ceoResult.task_id,
      }
      if (approverName) patch.gm_approved_by_name = approverName
      if (note) patch.gm_approval_note = note

      const { error: updErr } = await admin.from('payroll_reports').update(patch).eq('id', reportId)
      if (updErr) return json({ error: updErr.message }, 500)

      if (notifySettings && whatsTaskUrl && integrationSecret && notifySettings.hr_jid) {
        await notifyPayrollJids(
          whatsTaskUrl,
          integrationSecret,
          notifySettings,
          [notifySettings.hr_jid],
          `📋 تحديث رواتب — ${periodLabelAr}\n\n` +
            `✅ اعتماد المدير العام\n` +
            `➡️ تم إرسال الكشف إلى المدير التنفيذي (CEO) للاعتماد النهائي.`,
        )
      }

      return json({ ok: true, report_id: reportId, approval_status: 'pending_ceo', stage: 'ceo_sent' }, 200)
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
  }

  // CEO stage: approval sends final draft to accountant
  if (stage === 'ceo') {
    if (hrStatus === 'approved') {
      const accountantTaskId = String((report as { accountant_whats_task_id?: string }).accountant_whats_task_id ?? '').trim()
      if (current === 'pending_accountant' && accountantTaskId) {
        return json({ ok: true, skipped: 'accountant_already_sent', report_id: reportId, approval_status: current }, 200)
      }

      const accountantResult = await sendStageApprovalTask(admin, report as Record<string, unknown>, 'accountant')
      if (accountantResult.error) return json({ error: accountantResult.error }, 502)

      const patch: Record<string, unknown> = {
        approval_status: 'pending_accountant',
        approved_at: new Date().toISOString(),
        whats_task_id: accountantResult.task_id,
        accountant_whats_task_id: accountantResult.task_id,
      }
      if (approverName) patch.approved_by_name = approverName
      if (note) patch.approval_note = note

      const { error: updErr } = await admin.from('payroll_reports').update(patch).eq('id', reportId)
      if (updErr) return json({ error: updErr.message }, 500)

      if (notifySettings && whatsTaskUrl && integrationSecret && notifySettings.hr_jid) {
        await notifyPayrollJids(
          whatsTaskUrl,
          integrationSecret,
          notifySettings,
          [notifySettings.hr_jid],
          `📋 تحديث رواتب — ${periodLabelAr}\n\n` +
            `✅ اعتماد المدير التنفيذي (CEO)\n` +
            `➡️ تم إرسال المسودة النهائية إلى المحاسب/ة للمعالجة.`,
        )
      }

      return json(
        { ok: true, report_id: reportId, approval_status: 'pending_accountant', stage: 'accountant_sent' },
        200,
      )
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
  }

  // Accountant stage: mark payroll processing complete
  if (stage === 'accountant') {
    if (hrStatus === 'approved') {
      const patch: Record<string, unknown> = {
        approval_status: 'completed',
        accountant_completed_at: new Date().toISOString(),
      }
      if (approverName) patch.accountant_completed_by_name = approverName
      if (note) patch.approval_note = note

      const { error: updErr } = await admin.from('payroll_reports').update(patch).eq('id', reportId)
      if (updErr) return json({ error: updErr.message }, 500)

      if (notifySettings && whatsTaskUrl && integrationSecret) {
        const jids: string[] = []
        if (notifySettings.hr_jid) jids.push(notifySettings.hr_jid)
        if (notifySettings.gm_jid) jids.push(notifySettings.gm_jid)
        if (jids.length) {
          await notifyPayrollJids(
            whatsTaskUrl,
            integrationSecret,
            notifySettings,
            jids,
            `✅ اكتمل كشف رواتب — ${periodLabelAr}\n\n` +
              `أكمل/ت المحاسب/ة معالجة الرواتب.\n` +
              (approverName ? `بواسطة: ${approverName}` : ''),
          )
        }
      }

      return json({ ok: true, report_id: reportId, approval_status: 'completed', stage: 'completed' }, 200)
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
  }

  // Legacy single-stage
  const patch: Record<string, unknown> = {
    approval_status: hrStatus,
    approved_at: new Date().toISOString(),
  }
  if (note) patch.approval_note = note
  if (approverName) patch.approved_by_name = approverName

  const { error: updErr } = await admin.from('payroll_reports').update(patch).eq('id', reportId)
  if (updErr) return json({ error: updErr.message }, 500)

  return json({ ok: true, report_id: reportId, approval_status: hrStatus, stage }, 200)
  } catch (e) {
    console.error('payroll-approval-callback error', e)
    return json({ error: e instanceof Error ? e.message : 'Internal server error' }, 500)
  }
})
