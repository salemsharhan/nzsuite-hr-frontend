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

const HR_STATUS_MAP: Record<string, string> = {
  Approved: 'approved',
  Rejected: 'rejected',
  Held: 'on_hold',
  'Need update': 'need_update',
}

type ApprovalStage = 'gm' | 'ceo' | 'legacy'

function parseIntegrationRef(ref: string): { reportId: string; stage: ApprovalStage } | null {
  const gmMatch = /^payroll_report:(.+):gm$/.exec(ref)
  if (gmMatch) return { reportId: gmMatch[1], stage: 'gm' }

  const ceoMatch = /^payroll_report:(.+):ceo$/.exec(ref)
  if (ceoMatch) return { reportId: ceoMatch[1], stage: 'ceo' }

  const legacyMatch = /^payroll_report:(.+)$/.exec(ref)
  if (legacyMatch) return { reportId: legacyMatch[1], stage: 'legacy' }

  return null
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function createWhatsTaskApproval(
  whatsTaskUrl: string,
  integrationSecret: string,
  callbackUrl: string,
  payload: Record<string, unknown>,
): Promise<{ task_id?: string; error?: string }> {
  const wtRes = await fetch(`${whatsTaskUrl}/functions/v1/hr-create-approval-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Integration-Secret': integrationSecret,
    },
    body: JSON.stringify(payload),
  })

  const wtRaw = await wtRes.text()
  let wtJson: { task_id?: string; error?: string } = {}
  try {
    wtJson = JSON.parse(wtRaw)
  } catch {
    wtJson = {}
  }

  if (!wtRes.ok) return { error: wtJson.error ?? `Whats-Task error (${wtRes.status})` }
  const taskId = String(wtJson.task_id ?? '').trim()
  if (!taskId) return { error: 'Whats-Task did not return task_id' }
  return { task_id: taskId }
}

async function sendCeoApprovalTask(
  admin: ReturnType<typeof createClient>,
  report: Record<string, unknown>,
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
  const periodLabelAr =
    payrollMonth >= 1 && payrollMonth <= 12 && payrollYear > 0
      ? formatPayrollPeriodAr(payrollMonth, payrollYear)
      : String(
          (report as { report_data?: { meta?: { periodLabel?: string } } }).report_data?.meta?.periodLabel ?? 'الرواتب',
        )

  const { data: settings, error: settingsErr } = await admin
    .from('company_settings')
    .select('payroll_ceo_approver_wa_jid, taskhub_workspace_user_id')
    .eq('company_id', companyId)
    .maybeSingle()

  if (settingsErr) return { error: settingsErr.message }

  const ceoJid = String((settings as { payroll_ceo_approver_wa_jid?: string })?.payroll_ceo_approver_wa_jid ?? '').trim()
  const workspaceUserId = String((settings as { taskhub_workspace_user_id?: string })?.taskhub_workspace_user_id ?? '').trim()

  if (!ceoJid || !workspaceUserId) {
    return { error: 'CEO approver not configured' }
  }

  let attachmentBase64: string | undefined
  const attachmentPath = String(report.approval_attachment_path ?? '').trim()
  const attachmentFilename = String(report.approval_attachment_filename ?? 'payroll.xlsx').trim()
  const attachmentMime = String(
    report.approval_attachment_mime ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ).trim()

  if (attachmentPath) {
    const { data: fileData, error: dlErr } = await admin.storage.from(ATTACHMENT_BUCKET).download(attachmentPath)
    if (!dlErr && fileData) {
      const buf = new Uint8Array(await fileData.arrayBuffer())
      attachmentBase64 = bytesToBase64(buf)
    }
  }

  return createWhatsTaskApproval(whatsTaskUrl, integrationSecret, callbackUrl, {
    workspace_user_id: workspaceUserId,
    assignee_wa_jid: ceoJid,
    title: `اعتماد رواتب — ${periodLabelAr}`,
    description: `اعتماد نهائي لكشف رواتب شهر ${periodLabelAr}`,
    integration_ref: `payroll_report:${reportId}:ceo`,
    integration_callback_url: callbackUrl,
    sign_off: 'CEO',
    period_label_ar: periodLabelAr,
    payroll_month: payrollMonth,
    payroll_year: payrollYear,
    attachment: attachmentBase64
      ? { filename: attachmentFilename, mime: attachmentMime, base64: attachmentBase64 }
      : undefined,
  })
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

  const parsed = parseIntegrationRef(integrationRef)
  if (!parsed) return json({ error: 'Invalid integration_ref' }, 400)

  const { reportId, stage } = parsed
  const hrStatus = HR_STATUS_MAP[approvalStatus]
  if (!hrStatus) return json({ error: 'Unknown approval_status' }, 400)

  const { data: report, error: fetchErr } = await admin
    .from('payroll_reports')
    .select(
      'id, company_id, year, month, approval_status, report_data, approval_attachment_path, approval_attachment_filename, approval_attachment_mime',
    )
    .eq('id', reportId)
    .maybeSingle()

  if (fetchErr) return json({ error: fetchErr.message }, 500)
  if (!report) return json({ error: 'Payroll report not found' }, 404)

  const current = String((report as { approval_status?: string }).approval_status ?? 'draft')
  if (current === 'approved' && hrStatus !== 'approved') {
    return json({ ok: true, skipped: 'already_approved' }, 200)
  }

  // GM stage: approval advances to CEO; rejection/hold ends workflow
  if (stage === 'gm') {
    if (hrStatus === 'approved') {
      const ceoResult = await sendCeoApprovalTask(admin, report as Record<string, unknown>)
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

  // CEO stage (or legacy single-stage): final decision
  const patch: Record<string, unknown> = {
    approval_status: hrStatus,
    approved_at: new Date().toISOString(),
  }
  if (note) patch.approval_note = note
  if (approverName) patch.approved_by_name = approverName

  const { error: updErr } = await admin.from('payroll_reports').update(patch).eq('id', reportId)
  if (updErr) return json({ error: updErr.message }, 500)

  return json({ ok: true, report_id: reportId, approval_status: hrStatus, stage }, 200)
})
