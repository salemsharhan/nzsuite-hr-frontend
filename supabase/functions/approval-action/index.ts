// Approve / reject / route a request from the HR app.
// The decision is executed by the same n8n engine that handles the WhatsApp polls, so the app,
// the GM/HR WhatsApp polls and the employee notifications always stay in sync.
//
// POST { approval_id, action: 'approve'|'reject'|'to_gm'|'to_hr'|'docs_received'|'ready', note? }
// Caller must be an active super_admin, or an admin of the request's company.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ACTIONS = new Set(['approve', 'reject', 'to_gm', 'to_hr', 'docs_received', 'ready'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const actionUrl = (Deno.env.get('N8N_APPROVAL_ACTION_URL') ?? '').trim()
  const actionSecret = (Deno.env.get('N8N_APPROVAL_ACTION_SECRET') ?? '').trim()
  if (!actionUrl || !actionSecret) return json({ ok: false, error: 'Approval engine is not configured' }, 503)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData } = await userClient.auth.getUser()
  const user = userData?.user
  if (!user) return json({ ok: false, error: 'Please sign in again' }, 401)

  let body: { approval_id?: string; action?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }
  const approvalId = String(body.approval_id ?? '').trim()
  const action = String(body.action ?? '').trim()
  const note = String(body.note ?? '').trim().slice(0, 500)
  if (!approvalId || !ACTIONS.has(action)) return json({ ok: false, error: 'approval_id and a valid action are required' }, 400)

  const admin = createClient(url, serviceKey)
  const { data: approval } = await admin
    .from('request_approvals')
    .select('id, company_id')
    .eq('id', approvalId)
    .maybeSingle()
  if (!approval) return json({ ok: false, error: 'Request not found' }, 404)

  const { data: roles } = await admin
    .from('user_roles')
    .select('role, company_id, email, employee_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
  const role = (roles ?? []).find(
    (r) => r.role === 'super_admin' || (r.role === 'admin' && r.company_id === approval.company_id),
  )
  if (!role) return json({ ok: false, error: 'You are not allowed to decide requests for this company' }, 403)

  let name = role.email || user.email || 'HR admin'
  if (role.employee_id) {
    const { data: emp } = await admin
      .from('employees')
      .select('first_name, last_name')
      .eq('id', role.employee_id)
      .maybeSingle()
    const full = `${emp?.first_name ?? ''} ${emp?.last_name ?? ''}`.trim()
    if (full) name = full
  }

  const res = await fetch(actionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Action-Secret': actionSecret },
    body: JSON.stringify({ approval_id: approvalId, action, note, actor: { name, user_id: user.id, role: role.role } }),
  })
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = { ok: false, error: `Approval engine error (${res.status})` }
  }
  return json(data, res.ok ? 200 : res.status === 403 ? 502 : res.status)
})
