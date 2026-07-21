import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-integration-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizeWhatsTaskBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!u) return ''
  const fnIdx = u.indexOf('/functions/v1')
  if (fnIdx > 0) u = u.slice(0, fnIdx).replace(/\/+$/, '')
  return u
}

function mapPollToStatus(raw: string): 'approved' | 'rejected' | 'on_hold' | 'forward_gm' | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (
    t.includes('forward') ||
    t.includes('تحويل') ||
    t.includes('للمدير') ||
    t.includes('مدير عام')
  ) {
    return 'forward_gm'
  }
  if (
    t.includes('موافقة') ||
    t.includes('موافق') ||
    t.includes('approve') ||
    t.includes('✅')
  ) {
    return 'approved'
  }
  if (t.includes('رفض') || t.includes('reject') || t.includes('❌')) {
    return 'rejected'
  }
  if (
    t.includes('تعليق') ||
    t.includes('hold') ||
    t.includes('انتظار') ||
    t.includes('on hold') ||
    t.includes('💬')
  ) {
    return 'on_hold'
  }
  return null
}

function leaveStatusFromApproval(status: 'approved' | 'rejected' | 'on_hold'): string {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return 'On_Hold'
}

async function handleLeaveHrPoll(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  body: Record<string, unknown>,
  integrationRef: string,
): Promise<Response> {
  const leaveId =
    String(body.leave_request_id ?? '').trim() ||
    integrationRef.slice('leave_hr:'.length).trim()
  if (!leaveId) {
    return new Response(JSON.stringify({ error: 'leave_hr leave id missing' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const pollChoice = String(body.poll_choice ?? body.choice ?? body.approval_status ?? '').trim()
  const note = String(body.note ?? body.comment ?? body.gm_note ?? body.approval_note ?? '')
    .trim()
    .slice(0, 2000)

  let status = mapPollToStatus(pollChoice)
  const waStatus = String(body.approval_status ?? '').trim().toLowerCase()
  if (!status) {
    if (waStatus === 'approved') status = 'approved'
    else if (waStatus === 'rejected') status = 'rejected'
    else if (waStatus === 'forward gm' || waStatus === 'forward_gm') status = 'forward_gm'
    else if (
      waStatus === 'on_hold' ||
      waStatus === 'held' ||
      waStatus === 'hold' ||
      waStatus === 'need update'
    ) {
      status = 'on_hold'
    }
  }

  if (!status) {
    return new Response(JSON.stringify({ error: 'Could not map leave HR decision', poll_choice: pollChoice }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: leave, error: leaveErr } = await admin
    .from('leave_requests')
    .select(
      'id, leave_type, start_date, end_date, reason, status, employee_id, employees!leave_requests_employee_id_fkey(first_name, last_name, arabic_first_name, arabic_last_name, employee_id, company_id)',
    )
    .eq('id', leaveId)
    .maybeSingle()

  if (leaveErr || !leave) {
    return new Response(JSON.stringify({ error: leaveErr?.message ?? 'Leave not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const emp = (leave as { employees?: Record<string, unknown> }).employees
  const companyId = String((emp as { company_id?: string })?.company_id ?? '').trim()
  const now = new Date().toISOString()

  if (status === 'approved' || status === 'rejected') {
    const leaveStatus = status === 'approved' ? 'Approved' : 'Rejected'
    const { error: updErr } = await admin
      .from('leave_requests')
      .update({
        status: leaveStatus,
        hr_decision_at: now,
        gm_note: note || null,
      })
      .eq('id', leaveId)

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, leave_request_id: leaveId, status: leaveStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (status === 'on_hold') {
    await admin
      .from('leave_requests')
      .update({ status: 'On_Hold', gm_note: note || null })
      .eq('id', leaveId)
    return new Response(JSON.stringify({ ok: true, leave_request_id: leaveId, status: 'On_Hold' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // forward_gm
  const currentStatus = String((leave as { status?: string }).status ?? '')
  if (currentStatus === 'Pending_GM' || currentStatus === 'Approved' || currentStatus === 'Rejected') {
    return new Response(
      JSON.stringify({ ok: true, leave_request_id: leaveId, status: currentStatus, skipped: 'already_decided' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (!companyId) {
    return new Response(JSON.stringify({ error: 'company_id missing on leave employee' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const empNameAr = [emp?.arabic_first_name, emp?.arabic_last_name].filter(Boolean).join(' ')
  const empNameEn = [emp?.first_name, emp?.last_name].filter(Boolean).join(' ')
  const name = empNameAr || empNameEn || 'موظف'
  const title = `إجازة: ${name} — ${String(leave.leave_type ?? '')}`
  const msg = [
    `الموظف: ${name}`,
    `النوع: ${String(leave.leave_type ?? '')}`,
    `من: ${String(leave.start_date).slice(0, 10)}`,
    `إلى: ${String(leave.end_date).slice(0, 10)}`,
    leave.reason ? `السبب: ${String(leave.reason)}` : '',
    note ? `ملاحظة الموارد البشرية: ${note}` : '',
    'تم التحويل من استطلاع واتساب للموارد البشرية.',
  ]
    .filter(Boolean)
    .join('\n')

  const forwardRes = await fetch(`${supabaseUrl}/functions/v1/submit-hr-approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      company_id: companyId,
      title,
      body: msg,
      source: 'leave',
      leave_request_id: leaveId,
    }),
  })
  const forwardData = await forwardRes.json().catch(() => ({}))
  if (!forwardRes.ok) {
    return new Response(
      JSON.stringify({
        error: (forwardData as { error?: string }).error ?? `Forward to GM failed (${forwardRes.status})`,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      ok: true,
      leave_request_id: leaveId,
      status: 'Pending_GM',
      approval_request_id: (forwardData as { approval_request_id?: string }).approval_request_id,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
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
    const expectedSecret =
      (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? Deno.env.get('NZSUITE_HR_INTEGRATION_SECRET') ?? '').trim()
    const gotSecret = (req.headers.get('x-integration-secret') ?? '').trim()
    const body = (await req.json()) as Record<string, unknown>
    const inAppDecision = body.in_app === true

    if (!inAppDecision && expectedSecret && gotSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const integrationRef = String(body.integration_ref ?? '').trim()

    // HR leave WhatsApp poll → update leave_requests (Employee Requests page)
    if (integrationRef.startsWith('leave_hr:')) {
      return await handleLeaveHrPoll(admin, supabaseUrl, serviceKey, body, integrationRef)
    }

    const approvalRequestId = String(body.approval_request_id ?? '').trim()
    const pollChoice = String(body.poll_choice ?? body.choice ?? body.approval_status ?? '').trim()
    const note = String(
      body.note ?? body.comment ?? body.gm_note ?? body.approval_note ?? '',
    )
      .trim()
      .slice(0, 2000)

    let status = mapPollToStatus(pollChoice)
    if (status === 'forward_gm') status = null
    const explicit = String(body.status ?? '').trim().toLowerCase()
    if (explicit === 'approved' || explicit === 'rejected' || explicit === 'on_hold') {
      status = explicit as 'approved' | 'rejected' | 'on_hold'
    }
    const waStatus = String(body.approval_status ?? '').trim().toLowerCase()
    if (!status) {
      if (waStatus === 'approved') status = 'approved'
      else if (waStatus === 'rejected') status = 'rejected'
      else if (
        waStatus === 'on_hold' ||
        waStatus === 'onhold' ||
        waStatus === 'held' ||
        waStatus === 'hold' ||
        waStatus === 'need update' ||
        waStatus === 'need_update'
      ) {
        status = 'on_hold'
      }
    }

    if (!status || status === 'forward_gm') {
      return new Response(JSON.stringify({ error: 'Could not map decision to status', poll_choice: pollChoice }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let query = admin.from('hr_approval_requests').select('*')
    if (approvalRequestId) query = query.eq('id', approvalRequestId)
    else if (integrationRef) query = query.eq('integration_ref', integrationRef)
    else {
      return new Response(JSON.stringify({ error: 'approval_request_id or integration_ref required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: row, error: findErr } = await query.maybeSingle()
    if (findErr || !row) {
      return new Response(JSON.stringify({ error: findErr?.message ?? 'Approval request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const id = String((row as { id: string }).id)
    const now = new Date().toISOString()
    const { error: updErr } = await admin
      .from('hr_approval_requests')
      .update({
        status,
        gm_note: note || (row as { gm_note?: string }).gm_note || null,
        decided_at: now,
        updated_at: now,
      })
      .eq('id', id)

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const source = String((row as { source?: string }).source ?? '')
    const leaveId = String((row as { leave_request_id?: string }).leave_request_id ?? '').trim()
    if (source === 'leave' && leaveId) {
      await admin
        .from('leave_requests')
        .update({
          status: leaveStatusFromApproval(status),
          gm_note: note || null,
          gm_decided_at: now,
        })
        .eq('id', leaveId)
    }

    const companyId = String((row as { company_id: string }).company_id)
    const { data: settings } = await admin
      .from('company_settings')
      .select('taskhub_workspace_user_id, payroll_hr_wa_jid')
      .eq('company_id', companyId)
      .maybeSingle()

    const workspaceUserId = String(
      (settings as { taskhub_workspace_user_id?: string })?.taskhub_workspace_user_id ?? '',
    ).trim()
    const hrJid = String((settings as { payroll_hr_wa_jid?: string })?.payroll_hr_wa_jid ?? '')
      .trim()
      .toLowerCase()
    const whatsTaskUrl = normalizeWhatsTaskBaseUrl(Deno.env.get('WHATS_TASK_URL') ?? '')
    const integrationSecret = (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()

    if (workspaceUserId && hrJid && whatsTaskUrl) {
      const title = String((row as { title?: string }).title ?? 'Approval')
      const statusLabel =
        status === 'approved' ? 'موافق / Approved' : status === 'rejected' ? 'مرفوض / Rejected' : 'معلّق / On hold'
      const text = [
        `نتيجة اعتماد المدير العام / GM decision`,
        '',
        `الطلب / Request: ${title}`,
        `الحالة / Status: ${statusLabel}`,
        note ? `ملاحظة / Note: ${note}` : '',
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 2000)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(integrationSecret ? { 'X-Integration-Secret': integrationSecret } : {}),
      }
      const anonKey = (Deno.env.get('WHATS_TASK_ANON_KEY') ?? '').trim()
      if (anonKey) {
        headers['apikey'] = anonKey
        headers['Authorization'] = `Bearer ${anonKey}`
      }
      await fetch(`${whatsTaskUrl}/functions/v1/hr-send-text-message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspace_user_id: workspaceUserId,
          recipient_wa_jid: hrJid,
          text,
        }),
      }).catch(() => null)
    }

    return new Response(JSON.stringify({ ok: true, status, approval_request_id: id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
