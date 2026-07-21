import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ATTACHMENT_BUCKET = 'hr-approval-attachments'

function normalizeWhatsTaskBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!u) return ''
  const fnIdx = u.indexOf('/functions/v1')
  if (fnIdx > 0) u = u.slice(0, fnIdx).replace(/\/+$/, '')
  return u
}

function whatsTaskFetchHeaders(integrationSecret: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(integrationSecret ? { 'X-Integration-Secret': integrationSecret } : {}),
  }
  const anonKey = (Deno.env.get('WHATS_TASK_ANON_KEY') ?? '').trim()
  if (anonKey) {
    headers['apikey'] = anonKey
    headers['Authorization'] = `Bearer ${anonKey}`
  }
  return headers
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
    const companyId = String(body.company_id ?? '').trim()
    const title = String(body.title ?? '').trim().slice(0, 500)
    const message = String(body.body ?? body.message ?? '').trim().slice(0, 4000)
    const source = String(body.source ?? 'manual').trim() === 'leave' ? 'leave' : 'manual'
    const leaveRequestId = String(body.leave_request_id ?? '').trim() || null
    const hrCreatedBy = String(body.hr_created_by ?? '').trim() || null
    const attachmentBase64 = String(body.attachment_base64 ?? '').trim()
    const attachmentFilename = String(body.attachment_filename ?? 'attachment.bin').trim().slice(0, 200)
    const attachmentMime = String(body.attachment_mime ?? 'application/octet-stream').trim().slice(0, 200)

    if (!companyId || !title) {
      return new Response(JSON.stringify({ error: 'company_id and title required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (source === 'leave' && !leaveRequestId) {
      return new Response(JSON.stringify({ error: 'leave_request_id required when source=leave' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: settings } = await admin
      .from('company_settings')
      .select(
        'taskhub_workspace_user_id, payroll_approver_wa_jid, payroll_approver_phone_e164, payroll_approver_name, payroll_hr_wa_jid',
      )
      .eq('company_id', companyId)
      .maybeSingle()

    const workspaceUserId = String(
      (settings as { taskhub_workspace_user_id?: string })?.taskhub_workspace_user_id ?? '',
    ).trim()
    const gmJid = String((settings as { payroll_approver_wa_jid?: string })?.payroll_approver_wa_jid ?? '')
      .trim()
      .toLowerCase()
    const gmPhone = String(
      (settings as { payroll_approver_phone_e164?: string })?.payroll_approver_phone_e164 ?? '',
    ).trim()

    if (!workspaceUserId || !gmJid) {
      return new Response(JSON.stringify({ error: 'GM WhatsApp contact not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const whatsTaskUrl = normalizeWhatsTaskBaseUrl(Deno.env.get('WHATS_TASK_URL') ?? '')
    const integrationSecret = (Deno.env.get('WHATS_TASK_INTEGRATION_SECRET') ?? '').trim()
    if (!whatsTaskUrl) {
      return new Response(JSON.stringify({ error: 'WHATS_TASK_URL not set' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const integrationRef = `hr_approval:${crypto.randomUUID()}`
    const callbackUrl = `${supabaseUrl}/functions/v1/hr-approval-callback`

    let attachmentPath: string | null = null
    let whatsappFilename = attachmentFilename
    if (attachmentBase64) {
      const extMatch = attachmentFilename.match(/(\.[a-zA-Z0-9]{1,12})$/)
      const ext = extMatch ? extMatch[1].toLowerCase() : '.bin'
      let asciiBase = attachmentFilename
        .replace(/(\.[a-zA-Z0-9]{1,12})$/i, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
      if (!asciiBase || /^_+$/.test(asciiBase)) {
        asciiBase = `document-${Date.now().toString(36)}`
      }
      whatsappFilename = `${asciiBase}${ext}`.slice(0, 160)
      const safe = whatsappFilename
      attachmentPath = `${companyId}/${crypto.randomUUID()}_${safe}`
      const binary = Uint8Array.from(atob(attachmentBase64), (c) => c.charCodeAt(0))
      const { error: upErr } = await admin.storage.from(ATTACHMENT_BUCKET).upload(attachmentPath, binary, {
        contentType: attachmentMime,
        upsert: false,
      })
      if (upErr) {
        return new Response(JSON.stringify({ error: `Attachment upload failed: ${upErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: inserted, error: insErr } = await admin
      .from('hr_approval_requests')
      .insert({
        company_id: companyId,
        title,
        body: message || null,
        status: 'pending_gm',
        source,
        leave_request_id: leaveRequestId,
        attachment_path: attachmentPath,
        attachment_mime: attachmentBase64 ? attachmentMime : null,
        attachment_filename: attachmentBase64 ? whatsappFilename : null,
        hr_created_by: hrCreatedBy,
        integration_ref: integrationRef,
      })
      .select('id')
      .single()

    if (insErr || !inserted) {
      return new Response(JSON.stringify({ error: insErr?.message ?? 'Failed to create approval request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const approvalId = String((inserted as { id: string }).id)

    if (source === 'leave' && leaveRequestId) {
      await admin
        .from('leave_requests')
        .update({
          status: 'Pending_GM',
          forwarded_to_gm_at: new Date().toISOString(),
          approval_request_id: approvalId,
          hr_decision_at: new Date().toISOString(),
          hr_decided_by: hrCreatedBy,
        })
        .eq('id', leaveRequestId)
    }

    const description =
      message || (source === 'leave' ? 'طلب إجازة للمدير العام' : 'طلب اعتماد من الموارد البشرية')

    const wtBody: Record<string, unknown> = {
      workspace_user_id: workspaceUserId,
      assignee_wa_jid: gmJid,
      assignee_phone_e164: gmPhone || undefined,
      title,
      description,
      integration_ref: integrationRef,
      integration_callback_url: callbackUrl,
      sign_off: 'HR',
    }
    if (attachmentBase64) {
      wtBody.attachment = {
        filename: whatsappFilename,
        mime: attachmentMime,
        base64: attachmentBase64,
      }
    }

    const wtRes = await fetch(`${whatsTaskUrl}/functions/v1/hr-create-approval-task`, {
      method: 'POST',
      headers: whatsTaskFetchHeaders(integrationSecret),
      body: JSON.stringify(wtBody),
    })
    const wtRaw = await wtRes.text()
    let wtData: Record<string, unknown> = {}
    try {
      wtData = JSON.parse(wtRaw) as Record<string, unknown>
    } catch {
      /* ignore */
    }

    if (!wtRes.ok) {
      return new Response(
        JSON.stringify({
          error: (wtData.error as string) ?? `Whats-Task failed (${wtRes.status})`,
          approval_request_id: approvalId,
          whats_task_raw: wtRaw.slice(0, 400),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const taskId = String(wtData.task_id ?? '').trim()
    if (taskId) {
      await admin
        .from('hr_approval_requests')
        .update({ whats_task_task_id: taskId, updated_at: new Date().toISOString() })
        .eq('id', approvalId)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        approval_request_id: approvalId,
        whats_task_task_id: taskId || null,
        file_sent: Boolean(wtData.file_sent),
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
