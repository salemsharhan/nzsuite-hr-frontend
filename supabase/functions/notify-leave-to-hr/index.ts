import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizeWhatsTaskBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!u) return ''
  const fnIdx = u.indexOf('/functions/v1')
  if (fnIdx > 0) u = u.slice(0, fnIdx).replace(/\/+$/, '')
  return u
}

function leaveTypeAr(raw: string): string {
  const t = raw.trim().toLowerCase()
  if (!t) return 'إجازة'
  if (t.includes('sick') || t.includes('مرض')) return 'مرضية'
  if (t.includes('annual') || t.includes('vacation') || t.includes('سنو')) return 'سنوية'
  if (t.includes('unpaid') || t.includes('بدون')) return 'بدون راتب'
  if (t.includes('emergency') || t.includes('طارئ')) return 'طارئة'
  if (t.includes('permission') || t.includes('early') || t.includes('إذن')) return 'إذن / خروج مبكر'
  return raw.trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
    const leaveRequestId = String(body.leave_request_id ?? '').trim()
    const companyId = String(body.company_id ?? '').trim()
    if (!leaveRequestId) {
      return new Response(JSON.stringify({ error: 'leave_request_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: leave, error: leaveErr } = await admin
      .from('leave_requests')
      .select(
        'id, leave_type, start_date, end_date, reason, status, employee_id, employees!leave_requests_employee_id_fkey(first_name, last_name, arabic_first_name, arabic_last_name, employee_id, company_id)',
      )
      .eq('id', leaveRequestId)
      .maybeSingle()

    if (leaveErr || !leave) {
      return new Response(JSON.stringify({ error: leaveErr?.message ?? 'Leave not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emp = (leave as { employees?: Record<string, unknown> }).employees
    const resolvedCompanyId =
      companyId || String((emp as { company_id?: string })?.company_id ?? '').trim()
    if (!resolvedCompanyId) {
      return new Response(JSON.stringify({ error: 'company_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: settings } = await admin
      .from('company_settings')
      .select(
        'taskhub_workspace_user_id, payroll_hr_wa_jid, payroll_hr_phone_e164, payroll_hr_name',
      )
      .eq('company_id', resolvedCompanyId)
      .maybeSingle()

    const workspaceUserId = String(
      (settings as { taskhub_workspace_user_id?: string })?.taskhub_workspace_user_id ?? '',
    ).trim()
    const hrJid = String((settings as { payroll_hr_wa_jid?: string })?.payroll_hr_wa_jid ?? '')
      .trim()
      .toLowerCase()
    const hrPhone = String(
      (settings as { payroll_hr_phone_e164?: string })?.payroll_hr_phone_e164 ?? '',
    ).trim()

    if (!workspaceUserId || !hrJid) {
      return new Response(
        JSON.stringify({
          ok: false,
          skipped: true,
          error: 'HR WhatsApp contact not configured in company settings',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const whatsTaskUrl = normalizeWhatsTaskBaseUrl(Deno.env.get('WHATS_TASK_URL') ?? '')
    const integrationSecret = (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()
    if (!whatsTaskUrl) {
      return new Response(JSON.stringify({ ok: false, skipped: true, error: 'WHATS_TASK_URL not set' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const empNameEn = [emp?.first_name, emp?.last_name].filter(Boolean).join(' ')
    const empNameAr = [emp?.arabic_first_name, emp?.arabic_last_name].filter(Boolean).join(' ')
    const empCode = String(emp?.employee_id ?? '')
    const name = empNameAr || empNameEn || 'موظف'
    const typeAr = leaveTypeAr(String(leave.leave_type ?? ''))
    const from = String(leave.start_date).slice(0, 10)
    const to = String(leave.end_date).slice(0, 10)
    const reason = leave.reason ? String(leave.reason).trim().slice(0, 300) : ''

    const pollTitle = [
      'طلب إجازة جديد',
      '',
      `الموظف: ${name}${empCode ? ` (${empCode})` : ''}`,
      `النوع: ${typeAr}`,
      `من: ${from}`,
      `إلى: ${to}`,
      reason ? `السبب: ${reason}` : '',
      '',
      'اختر القرار:',
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .slice(0, 900)

    const integrationRef = `leave_hr:${leaveRequestId}`
    const callbackUrl = `${supabaseUrl}/functions/v1/hr-approval-callback`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(integrationSecret ? { 'X-Integration-Secret': integrationSecret } : {}),
    }
    const anonKey = (Deno.env.get('WHATS_TASK_ANON_KEY') ?? '').trim()
    if (anonKey) {
      headers['apikey'] = anonKey
      headers['Authorization'] = `Bearer ${anonKey}`
    }

    const res = await fetch(`${whatsTaskUrl}/functions/v1/hr-create-approval-task`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workspace_user_id: workspaceUserId,
        assignee_wa_jid: hrJid,
        assignee_phone_e164: hrPhone || undefined,
        title: `إجازة: ${name} — ${typeAr}`,
        description: `من ${from} إلى ${to}`,
        integration_ref: integrationRef,
        integration_callback_url: callbackUrl,
        sign_off: 'HR',
        poll_title: pollTitle,
        poll_options: ['✅ موافقة', '❌ رفض', '↪️ تحويل للمدير العام'],
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: (data as { error?: string }).error ?? `WhatsApp poll failed (${res.status})`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        notified: true,
        poll: true,
        task_id: (data as { task_id?: string }).task_id ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
