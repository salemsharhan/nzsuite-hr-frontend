const AR_PAYROLL_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

/** Base URL only: https://PROJECT_REF.supabase.co */
export function normalizeWhatsTaskBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!u) return ''
  const fnIdx = u.indexOf('/functions/v1')
  if (fnIdx > 0) u = u.slice(0, fnIdx).replace(/\/+$/, '')
  return u
}

export function whatsTaskFunctionUrl(baseUrl: string, functionName: string): string {
  const base = normalizeWhatsTaskBaseUrl(baseUrl)
  return `${base}/functions/v1/${functionName}`
}

export function whatsTaskFetchHeaders(integrationSecret: string): Record<string, string> {
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

export async function callWhatsTaskFunction(
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

export function validateWhatsTaskBaseUrl(baseUrl: string): string | null {
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

export function formatPayrollPeriodAr(month: number, year: number): string {
  const m = Math.max(1, Math.min(12, month))
  return `${AR_PAYROLL_MONTHS[m - 1]} ${year}`
}

export function periodLabelFromReport(report: Record<string, unknown>): string {
  const payrollMonth = Number(report.month ?? 0)
  const payrollYear = Number(report.year ?? 0)
  if (payrollMonth >= 1 && payrollMonth <= 12 && payrollYear > 0) {
    return formatPayrollPeriodAr(payrollMonth, payrollYear)
  }
  return String(
    (report as { report_data?: { meta?: { periodLabel?: string } } }).report_data?.meta?.periodLabel ?? 'الرواتب',
  )
}

export async function sendWhatsAppText(
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

export interface PayrollNotifySettings {
  workspace_user_id: string
  hr_jid?: string
  gm_jid?: string
  ceo_jid?: string
  accountant_jid?: string
  hr_name?: string
  gm_name?: string
  accountant_name?: string
}

export async function loadPayrollNotifySettings(
  // Supabase client — kept untyped for edge bundler compatibility
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
      'taskhub_workspace_user_id, payroll_hr_wa_jid, payroll_hr_name, payroll_approver_wa_jid, payroll_approver_name, payroll_ceo_approver_wa_jid, payroll_accountant_wa_jid, payroll_accountant_name',
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
    hr_name: String((data as { payroll_hr_name?: string }).payroll_hr_name ?? '').trim() || undefined,
    gm_name: String((data as { payroll_approver_name?: string }).payroll_approver_name ?? '').trim() || undefined,
    accountant_jid:
      String((data as { payroll_accountant_wa_jid?: string }).payroll_accountant_wa_jid ?? '').trim() || undefined,
    accountant_name:
      String((data as { payroll_accountant_name?: string }).payroll_accountant_name ?? '').trim() || undefined,
  }
}

export async function notifyPayrollJids(
  whatsTaskUrl: string,
  integrationSecret: string,
  settings: PayrollNotifySettings,
  jids: string[],
  message: string,
): Promise<void> {
  const unique = [...new Set(jids.map((j) => j.trim().toLowerCase()).filter(Boolean))]
  for (const jid of unique) {
    const result = await sendWhatsAppText(
      whatsTaskUrl,
      integrationSecret,
      settings.workspace_user_id,
      jid,
      message,
    )
    if (!result.ok) console.error('payroll notify failed', jid, result.error)
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
