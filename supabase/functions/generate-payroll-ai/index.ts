import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYROLL_RULES_CONDENSED = `BEC/DYLX payroll (21st prev month → 20th payroll month):
- Daily rate = Basic ÷ 26 (always 26, not scheduled count)
- Day balance: scheduled = present + holidays + absent + paid_leave + permitted_late + permitted_leave + unpermitted_late
- Absent: 1 full daily rate cut each
- Unpermitted late: ¼ daily rate each (separate from minute penalties)
- Paid leave: salary_kwd = (basic÷26)×(present_days+company_holiday_days); paid_leave_kwd = (basic÷26)×paid_leave_days. Holidays are paid in salary column (present col stays punch-only).
- Permitted late/leave: no salary cut, removes from absent pool
- Late clock-in deductions (deductions_kwd on BEC sheet): 0–15 min grace; 16–30 min late → 30 min pay; 31+ min → 60 min pay
  Formula: basic × (tier_minutes÷60) ÷ (26 × hours_per_day from shift length, e.g. 7h), round 3 decimals. One tier per day (earliest arrival). Put in deductions_kwd not penalties_kwd for BEC.
- Gross = salary_kwd + paid_leave_kwd + OT + housing + other
- Net = gross − penalties − deductions − loan − other_deductions
- Refund: on_paper − net when on_paper set; notes "*" when refund > 0
- Punch import: employees not in punch file with default_full_present=true → fully present (scheduled − holidays − approved leave)
- HR monthly_hr_settings (from employee profile): paid_leave=add salary; paid_leave_from_balance/sick_leave/emergency_leave=permitted leave (no pay change, no paid_leave_kwd); unpaid_leave=deduct (reduce present); permitted_late=approved late days (no pay cut)
- When monthly_hr_settings is present, use those day counts — they override AI guesses for leave buckets
- Carry-forward from 21st and overseas cases: apply per input notes/hints only when data supports it`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_EMPLOYEES_PER_REQUEST = 10
const MAX_PUNCH_CHARS = 6_000
const GEMINI_TIMEOUT_MS = 90_000

interface AiPayrollRow {
  emp_code: string
  working_days_in_month: number
  actual_working_days: number
  company_holiday_days: number
  paid_leave_days: number
  permitted_late_days: number
  permitted_leave_days: number
  unpermitted_late_days: number
  penalties_kwd: number
  over_time_kwd: number
  deductions_kwd: number
  loan_kwd: number
  deductions_other_kwd: number
  notes: string
}

interface CompactEmployee {
  emp_code: string
  basic_salary_kwd: number
  on_paper_salary_kwd: number
  scheduled_working_days: number
  company_holiday_days: number
  approved_paid_leave_days: number
  present_days_from_attendance: number | null
  present_days_from_punch: number | null
  default_full_present: boolean
  shifts?: { day_of_week: number; start_time: string; end_time: string }[]
  present_dates?: string[]
  late_records?: { date: string; minutes_late: number }[]
}

interface GeneratePayrollAiRequest {
  company_id: string
  year: number
  month: number
  department?: string
  late_tolerance_minutes: number
  default_hours_per_day: number
  period: { start: string; end: string; label: string }
  company_holidays: { date: string; name: string }[]
  employees: CompactEmployee[]
  punch_log_text?: string
}

const ROW_SCHEMA = {
  type: 'object',
  properties: {
    emp_code: { type: 'string' },
    working_days_in_month: { type: 'number' },
    actual_working_days: { type: 'number' },
    company_holiday_days: { type: 'number' },
    paid_leave_days: { type: 'number' },
    permitted_late_days: { type: 'number' },
    permitted_leave_days: { type: 'number' },
    unpermitted_late_days: { type: 'number' },
    penalties_kwd: { type: 'number' },
    over_time_kwd: { type: 'number' },
    deductions_kwd: { type: 'number' },
    loan_kwd: { type: 'number' },
    deductions_other_kwd: { type: 'number' },
    notes: { type: 'string' },
  },
  required: [
    'emp_code',
    'working_days_in_month',
    'actual_working_days',
    'company_holiday_days',
    'paid_leave_days',
    'permitted_late_days',
    'permitted_leave_days',
    'unpermitted_late_days',
    'penalties_kwd',
    'over_time_kwd',
    'deductions_kwd',
    'loan_kwd',
    'deductions_other_kwd',
  ],
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    rows: { type: 'array', items: ROW_SCHEMA },
  },
  required: ['rows'],
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildSystemPrompt(): string {
  return `You are a Kuwait payroll accountant for BEC/DYLX Excel payroll sheets.

RULES:
${PAYROLL_RULES_CONDENSED}

OUTPUT:
- JSON only, one row per employee in the batch (use emp_code exactly).
- Balance day buckets: scheduled = present + holidays + absent + paid_leave + permitted_late + permitted_leave + unpermitted_late
- Prefer present_days_from_punch when set; else present_days_from_attendance; else default_full_present rule.
- If monthly_hr_settings is provided, apply paid/unpaid/paid_leave_from_balance/sick/emergency/permitted_late day counts exactly.
- Compute penalties_kwd from late_records using tier rules.
- Round money to 3 decimals. notes must be exactly "" or "*" (no other text).
- over_time_kwd, deductions_kwd, loan_kwd, deductions_other_kwd default to 0.`
}

function stripMarkdownJsonFence(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  return cleaned.trim()
}

/** Extract complete row objects from truncated Gemini JSON. */
function salvageRowsFromBrokenJson(text: string): AiPayrollRow[] {
  const rows: AiPayrollRow[] = []
  let depth = 0
  let objStart = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (c === '\\') {
        escaped = true
      } else if (c === '"') {
        inString = false
      }
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && objStart >= 0) {
        try {
          const row = JSON.parse(text.slice(objStart, i + 1)) as AiPayrollRow
          if (row.emp_code) rows.push(normalizeAiRow(row))
        } catch {
          // skip malformed object
        }
        objStart = -1
      }
    }
  }
  return rows
}

function normalizeAiRow(row: AiPayrollRow): AiPayrollRow {
  const notes = String(row.notes ?? '').trim()
  return {
    ...row,
    emp_code: String(row.emp_code ?? '').trim(),
    working_days_in_month: Number(row.working_days_in_month) || 0,
    actual_working_days: Number(row.actual_working_days) || 0,
    company_holiday_days: Number(row.company_holiday_days) || 0,
    paid_leave_days: Number(row.paid_leave_days) || 0,
    permitted_late_days: Number(row.permitted_late_days) || 0,
    permitted_leave_days: Number(row.permitted_leave_days) || 0,
    unpermitted_late_days: Number(row.unpermitted_late_days) || 0,
    penalties_kwd: Number(row.penalties_kwd) || 0,
    over_time_kwd: Number(row.over_time_kwd) || 0,
    deductions_kwd: Number(row.deductions_kwd) || 0,
    loan_kwd: Number(row.loan_kwd) || 0,
    deductions_other_kwd: Number(row.deductions_other_kwd) || 0,
    notes: notes === '*' ? '*' : '',
  }
}

function parsePayrollRowsJson(text: string, expectedCount: number): AiPayrollRow[] {
  const cleaned = stripMarkdownJsonFence(text)

  try {
    const data = JSON.parse(cleaned) as { rows?: AiPayrollRow[] }
    if (Array.isArray(data.rows) && data.rows.length > 0) {
      return data.rows.map(normalizeAiRow)
    }
  } catch {
    const salvaged = salvageRowsFromBrokenJson(cleaned)
    if (salvaged.length > 0) return salvaged
    throw new Error(
      `Gemini returned invalid payroll JSON (expected ${expectedCount} rows). Try again or use a smaller batch.`,
    )
  }

  const salvaged = salvageRowsFromBrokenJson(cleaned)
  if (salvaged.length > 0) return salvaged

  throw new Error(`Gemini response missing rows array (expected ${expectedCount} employees)`)
}

function truncatePunch(text: string | undefined): string | undefined {
  const t = text?.trim()
  if (!t) return undefined
  if (t.length <= MAX_PUNCH_CHARS) return t
  return t.slice(0, MAX_PUNCH_CHARS) + '\n...[truncated]'
}

async function callGemini(
  apiKey: string,
  body: GeneratePayrollAiRequest,
): Promise<AiPayrollRow[]> {
  const systemPrompt = buildSystemPrompt()
  const punchLog = truncatePunch(body.punch_log_text)
  const userPayload = JSON.stringify({
    payroll_month: body.month,
    payroll_year: body.year,
    department: body.department ?? 'all',
    period: body.period,
    late_tolerance_minutes: body.late_tolerance_minutes,
    default_hours_per_day: body.default_hours_per_day,
    company_holidays: body.company_holidays,
    employees: body.employees,
    punch_log_text: punchLog,
  })

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPayload }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    })
  } finally {
    clearTimeout(timer)
  }

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${raw.slice(0, 400)}`)
  }

  let parsed: { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Gemini returned invalid JSON envelope')
  }

  const finishReason = (parsed.candidates?.[0] as { finishReason?: string } | undefined)?.finishReason
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned no content')
  }

  const rows = parsePayrollRowsJson(text, body.employees.length)

  if (rows.length < body.employees.length) {
    if (finishReason === 'MAX_TOKENS') {
      throw new Error(
        `Gemini output truncated (${rows.length}/${body.employees.length} rows). Retry with fewer employees per batch.`,
      )
    }
    if (rows.length === 0) {
      throw new Error(`Gemini returned no valid payroll rows (expected ${body.employees.length})`)
    }
    // Partial salvage — caller may retry missing employees
    console.warn(`generate-payroll-ai: partial rows ${rows.length}/${body.employees.length}`)
  }

  return rows
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Server configuration missing' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => null) as GeneratePayrollAiRequest | null
    if (!body) {
      return json({ error: 'Invalid request JSON body' }, 400)
    }
    const companyId = String(body.company_id ?? '').trim()
    if (!companyId) {
      return json({ error: 'company_id is required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: membership } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!membership) {
      return json({ error: 'Forbidden for this company' }, 403)
    }

    const { data: settings, error: settingsError } = await admin
      .from('company_settings')
      .select('gemini_api_key')
      .eq('company_id', companyId)
      .maybeSingle()

    if (settingsError) {
      return json({ error: settingsError.message }, 500)
    }

    const apiKey = String((settings as { gemini_api_key?: string } | null)?.gemini_api_key ?? '').trim()
    if (!apiKey) {
      return json(
        { error: 'Gemini API key not configured. Add it in Settings → Company Settings.' },
        400,
      )
    }

    if (!Array.isArray(body.employees) || body.employees.length === 0) {
      return json({ error: 'employees array is required' }, 400)
    }
    if (body.employees.length > MAX_EMPLOYEES_PER_REQUEST) {
      return json(
        { error: `Max ${MAX_EMPLOYEES_PER_REQUEST} employees per request — client should batch` },
        400,
      )
    }

    const rows = await callGemini(apiKey, body)

    return json({
      ok: true,
      rows,
      model: GEMINI_MODEL,
      expected: body.employees.length,
      received: rows.length,
    })
  } catch (err) {
    console.error('generate-payroll-ai error', err)
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Gemini request timed out — try fewer employees or a shorter punch log'
        : err instanceof Error
          ? err.message
          : 'Unknown error'
    return json({ error: message }, 500)
  }
})
