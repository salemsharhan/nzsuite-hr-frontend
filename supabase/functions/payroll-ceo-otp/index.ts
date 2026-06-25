import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OTP_TTL_MINUTES = 10
const UNLOCK_TTL_HOURS = 4
const OTP_LENGTH = 6

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function pepper(): string {
  return (Deno.env.get('PAYROLL_OTP_PEPPER') ?? Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? 'payroll-otp').trim()
}

async function hashOtp(otp: string, reportId: string): Promise<string> {
  return sha256Hex(`${pepper()}:${reportId}:${otp}`)
}

async function hashUnlockToken(token: string, reportId: string): Promise<string> {
  return sha256Hex(`${pepper()}:unlock:${reportId}:${token}`)
}

function randomOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return String(n).padStart(OTP_LENGTH, '0')
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function whatsTaskFunctionUrl(baseUrl: string, functionName: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '')
  const fnIdx = base.indexOf('/functions/v1')
  if (fnIdx > 0) base = base.slice(0, fnIdx).replace(/\/+$/, '')
  return `${base}/functions/v1/${functionName}`
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

async function sendCeoWhatsAppMessage(
  whatsTaskUrl: string,
  integrationSecret: string,
  workspaceUserId: string,
  ceoJid: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(whatsTaskFunctionUrl(whatsTaskUrl, 'hr-send-text-message'), {
    method: 'POST',
    headers: whatsTaskFetchHeaders(integrationSecret),
    body: JSON.stringify({
      workspace_user_id: workspaceUserId,
      recipient_wa_jid: ceoJid,
      text,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? `Whats-Task error (${res.status})` }
  return { ok: true }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const whatsTaskUrl = (Deno.env.get('WHATS_TASK_URL') ?? '').trim().replace(/\/+$/, '')
  const integrationSecret = (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()

  if (!whatsTaskUrl || !integrationSecret) {
    return json({ error: 'Payroll WhatsApp integration not configured on server' }, 503)
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

  const action = String(body.action ?? '').trim()
  const companyId = String(body.company_id ?? '').trim()
  const reportId = String(body.payroll_report_id ?? '').trim()

  if (!companyId || !reportId) return json({ error: 'Missing company_id or payroll_report_id' }, 400)

  const { data: report, error: reportErr } = await admin
    .from('payroll_reports')
    .select('id, company_id, approval_status, year, month, report_data')
    .eq('id', reportId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (reportErr) return json({ error: reportErr.message }, 500)
  if (!report) return json({ error: 'Payroll report not found' }, 404)

  if (action === 'send') {
    const { data: settings, error: settingsErr } = await admin
      .from('company_settings')
      .select('payroll_approver_wa_jid, payroll_approver_name, taskhub_workspace_user_id')
      .eq('company_id', companyId)
      .maybeSingle()

    if (settingsErr) return json({ error: settingsErr.message }, 500)

    const gmJid = String((settings as { payroll_approver_wa_jid?: string })?.payroll_approver_wa_jid ?? '').trim()
    const gmName = String((settings as { payroll_approver_name?: string })?.payroll_approver_name ?? 'GM').trim()
    const workspaceUserId = String((settings as { taskhub_workspace_user_id?: string })?.taskhub_workspace_user_id ?? '').trim()

    if (!gmJid || !workspaceUserId) {
      return json({ error: 'GM WhatsApp approver not configured in Company Settings' }, 400)
    }

    const otp = randomOtp()
    const otpHash = await hashOtp(otp, reportId)
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

    await admin.from('payroll_ceo_edit_unlocks').delete().eq('payroll_report_id', reportId).is('unlock_token_hash', null)

    const { error: insErr } = await admin.from('payroll_ceo_edit_unlocks').insert({
      payroll_report_id: reportId,
      company_id: companyId,
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      requested_by_user_id: user.id,
    })
    if (insErr) return json({ error: insErr.message }, 500)

    const periodLabel =
      (report.report_data as { meta?: { periodLabel?: string } })?.meta?.periodLabel ??
      `Payroll ${report.month}/${report.year}`
    const message =
      `السلام عليكم ${gmName},\n\n` +
      `رمز التحقق لتعديل كشف الرواتب (${periodLabel}):\n\n` +
      `*${otp}*\n\n` +
      `صالح لمدة ${OTP_TTL_MINUTES} دقائق.\n` +
      `طلب من: ${user.email ?? user.id}\n\n` +
      `NZSuite HR`

    const sent = await sendCeoWhatsAppMessage(whatsTaskUrl, integrationSecret, workspaceUserId, gmJid, message)
    if (!sent.ok) return json({ error: sent.error ?? 'Failed to send OTP' }, 502)

    return json({ ok: true, expires_at: expiresAt, otp_length: OTP_LENGTH })
  }

  if (action === 'verify') {
    const otp = String(body.otp ?? '').trim().replace(/\D/g, '')
    if (otp.length !== OTP_LENGTH) return json({ error: 'Invalid OTP format' }, 400)

    const { data: row, error: rowErr } = await admin
      .from('payroll_ceo_edit_unlocks')
      .select('id, otp_hash, otp_expires_at, unlock_token_hash')
      .eq('payroll_report_id', reportId)
      .is('unlock_token_hash', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rowErr) return json({ error: rowErr.message }, 500)
    if (!row) return json({ error: 'No active OTP — request a new code' }, 400)

    if (new Date(String(row.otp_expires_at)).getTime() < Date.now()) {
      return json({ error: 'OTP expired — request a new code' }, 400)
    }

    const expectedHash = await hashOtp(otp, reportId)
    if (expectedHash !== row.otp_hash) return json({ error: 'Incorrect OTP' }, 401)

    const unlockToken = randomToken()
    const unlockHash = await hashUnlockToken(unlockToken, reportId)
    const unlockExpiresAt = new Date(Date.now() + UNLOCK_TTL_HOURS * 60 * 60 * 1000).toISOString()

    const { error: updErr } = await admin
      .from('payroll_ceo_edit_unlocks')
      .update({
        unlock_token_hash: unlockHash,
        unlock_expires_at: unlockExpiresAt,
      })
      .eq('id', row.id)

    if (updErr) return json({ error: updErr.message }, 500)

    return json({
      ok: true,
      unlock_token: unlockToken,
      unlock_expires_at: unlockExpiresAt,
    })
  }

  if (action === 'check') {
    const unlockToken = String(body.unlock_token ?? '').trim()
    if (!unlockToken) return json({ valid: false }, 200)

    const tokenHash = await hashUnlockToken(unlockToken, reportId)
    const { data: row, error: rowErr } = await admin
      .from('payroll_ceo_edit_unlocks')
      .select('unlock_expires_at')
      .eq('payroll_report_id', reportId)
      .eq('unlock_token_hash', tokenHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rowErr) return json({ error: rowErr.message }, 500)
    if (!row?.unlock_expires_at) return json({ valid: false }, 200)

    const valid = new Date(String(row.unlock_expires_at)).getTime() > Date.now()
    return json({ valid, unlock_expires_at: row.unlock_expires_at })
  }

  return json({ error: 'Unknown action — use send, verify, or check' }, 400)
})
