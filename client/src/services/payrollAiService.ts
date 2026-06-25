import { supabase } from './supabase';
import { employeeService, type Employee } from './employeeService';
import { companySettingsService, type EmployeeShift } from './companySettingsService';
import { attendanceService } from './attendanceService';
import {
  buildKdaPayrollReport,
  getApprovedLeaveDaysForMonth,
  getWorkingDaysInMonthByEmployee,
  getActualWorkingDaysFromAttendance,
  getCompanyHolidaysForMonth,
  getEmployeeShiftsByEmployeeId,
  getCompanyHolidayDaysByEmployee,
  type KdaPayrollReportRow,
} from './payrollReportService';
import { employeePayrollMonthService } from './employeePayrollMonthService';
import { recalcPayrollRow } from '@/utils/payrollRowRecalc';
import { parsePunchLog } from '@/utils/payrollPunchLogParser';
import { holidayDatesInPeriod, PAYROLL_LATE_TOLERANCE_MINUTES } from '@/utils/payrollWorkingDays';
import { getPayrollPeriodBounds, formatPayrollPeriodRange, isDateInPayrollPeriod } from '@/utils/payrollPeriod';
import type { MonthAdjustmentSummary } from '@/utils/payrollMonthAdjustments';
import { applyMonthAdjustmentsToPayrollRow } from '@/utils/payrollMonthAdjustments';
import {
  computeLatePenaltiesFromPunchText,
  datesFromPermittedLateEntries,
  resolveHoursPerDay,
} from '@/utils/payrollLatePenalties';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const AI_PAYROLL_BATCH_SIZE = 10;

export interface AiPayrollRow {
  emp_code: string;
  working_days_in_month: number;
  actual_working_days: number;
  company_holiday_days: number;
  paid_leave_days: number;
  permitted_late_days: number;
  permitted_leave_days: number;
  unpermitted_late_days: number;
  penalties_kwd: number;
  over_time_kwd: number;
  deductions_kwd: number;
  loan_kwd: number;
  deductions_other_kwd: number;
  notes: string;
}

export interface GeneratePayrollWithAiInput {
  companyId: string;
  year: number;
  month: number;
  department?: string;
  punchLogText?: string;
  onBatchProgress?: (current: number, total: number) => void;
}

export interface GeneratePayrollWithAiResult {
  companyName: string;
  companyNameArabic: string;
  periodLabel: string;
  departmentLabel: string;
  rows: KdaPayrollReportRow[];
  model?: string;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

function mergeAiRow(
  base: KdaPayrollReportRow,
  ai: AiPayrollRow | undefined,
  hrSummary?: MonthAdjustmentSummary,
  computedLateDeductionKwd?: number,
  options: { trustAiAttendance?: boolean } = {},
): KdaPayrollReportRow {
  const withHr = applyMonthAdjustmentsToPayrollRow(base, hrSummary);
  if (!ai) {
    if (computedLateDeductionKwd != null && computedLateDeductionKwd > 0) {
      return recalcPayrollRow(withHr, {
        deductionsKwd: computedLateDeductionKwd,
        penaltiesKwd: 0,
      });
    }
    return withHr;
  }

  const hrActive = Boolean(hrSummary?.entries.length);
  const trustAiAttendance = options.trustAiAttendance ?? false;

  const lateKwd =
    computedLateDeductionKwd !== undefined
      ? computedLateDeductionKwd
      : (ai.penalties_kwd ?? 0);

  return recalcPayrollRow(withHr, {
    ...(trustAiAttendance
      ? {
          workingDaysInMonth: ai.working_days_in_month,
          actualWorkingDays: ai.actual_working_days,
          companyHolidayDays: ai.company_holiday_days,
        }
      : {}),
    ...(hrActive
      ? {}
      : {
          paidLeaveDays: ai.paid_leave_days,
          permittedLateDays: ai.permitted_late_days,
          permittedLeaveDays: ai.permitted_leave_days,
          unpermittedLateDays: ai.unpermitted_late_days,
        }),
    penaltiesKwd: 0,
    deductionsKwd: lateKwd > 0 ? lateKwd : ai.deductions_kwd,
    overTimeKwd: ai.over_time_kwd,
    loanKwd: hrSummary ? hrSummary.loan_kwd : (ai?.loan_kwd ?? 0),
    deductionsOtherKwd: ai.deductions_other_kwd,
    notes: ai.notes ?? '',
  });
}

export async function isGeminiPayrollConfigured(companyId: string): Promise<boolean> {
  const settings = await companySettingsService.getCompanySettings(companyId);
  return Boolean(settings?.gemini_api_key?.trim());
}

function punchMatchIdsForEmployee(emp: Employee): string[] {
  const ids: string[] = [];
  const code = emp.employee_id || emp.employeeId;
  if (code) ids.push(String(code).trim());
  const ext = emp.external_id ?? (emp as { externalId?: string | number }).externalId;
  if (ext != null && String(ext).trim()) ids.push(String(ext).trim());
  return ids;
}

function filterPunchForBatch(
  punchText: string,
  batchEmpCodes: Set<string>,
  employees: Employee[],
): string | undefined {
  const trimmed = punchText.trim();
  if (!trimmed) return undefined;

  const matchIds = new Set<string>();
  for (const emp of employees) {
    const code = (emp.employee_id || emp.employeeId || '').trim();
    if (!batchEmpCodes.has(code)) continue;
    for (const id of punchMatchIdsForEmployee(emp)) matchIds.add(id);
  }
  if (matchIds.size === 0) return undefined;

  const lines = trimmed.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    if (!t) return false;
    return matchIds.has(t.split(/\s+/)[0]);
  });
  return lines.length > 0 ? lines.join('\n') : undefined;
}

async function invokePayrollAiBatch(
  token: string,
  body: Record<string, unknown>,
): Promise<{ rows: AiPayrollRow[]; model?: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-payroll-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: { rows?: AiPayrollRow[]; model?: string; error?: string; expected?: number; received?: number } = {};
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error(`AI payroll returned invalid JSON (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `AI payroll failed (${res.status})`);
  }
  return {
    rows: (data.rows ?? []) as AiPayrollRow[],
    model: data.model,
  };
}

function shouldSplitBatch(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('timed out') ||
    msg.includes('unterminated string') ||
    msg.includes('invalid payroll json') ||
    msg.includes('truncated') ||
    msg.includes('invalid json')
  );
}

async function processEmployeeBatches(
  token: string,
  requestBase: Record<string, unknown>,
  employeePayload: Record<string, unknown>[],
  punchText: string,
  employees: Employee[],
  onBatchProgress?: (current: number, total: number) => void,
): Promise<{ rows: AiPayrollRow[]; model?: string }> {
  const chunks: Record<string, unknown>[][] = [];
  for (let i = 0; i < employeePayload.length; i += AI_PAYROLL_BATCH_SIZE) {
    chunks.push(employeePayload.slice(i, i + AI_PAYROLL_BATCH_SIZE));
  }
  if (chunks.length === 0) chunks.push([]);

  const allRows: AiPayrollRow[] = [];
  let model: string | undefined;

  const runChunk = async (chunk: Record<string, unknown>[], attempt = 1): Promise<void> => {
    if (chunk.length === 0) return;

    const codes = new Set(chunk.map((e) => String((e as { emp_code?: string }).emp_code ?? '').trim()));
    const batchPunch = filterPunchForBatch(punchText, codes, employees);

    try {
      const result = await invokePayrollAiBatch(token, {
        ...requestBase,
        employees: chunk,
        punch_log_text: batchPunch,
      });

      const got = new Set(result.rows.map((r) => String(r.emp_code).trim()));
      allRows.push(...result.rows);
      model = result.model ?? model;

      const missing = chunk.filter(
        (e) => !got.has(String((e as { emp_code?: string }).emp_code ?? '').trim()),
      );
      if (missing.length > 0 && missing.length < chunk.length) {
        for (const emp of missing) {
          await runChunk([emp as Record<string, unknown>], attempt + 1);
        }
      } else if (missing.length === chunk.length && chunk.length === 1 && attempt < 3) {
        throw new Error('Gemini returned no row for employee');
      }
    } catch (err) {
      if (chunk.length > 1 && attempt < 3 && shouldSplitBatch(err)) {
        const mid = Math.ceil(chunk.length / 2);
        await runChunk(chunk.slice(0, mid), attempt + 1);
        await runChunk(chunk.slice(mid), attempt + 1);
        return;
      }
      throw err;
    }
  };

  for (let i = 0; i < chunks.length; i++) {
    onBatchProgress?.(i + 1, chunks.length);
    await runChunk(chunks[i]);
  }

  const byCode = new Map<string, AiPayrollRow>();
  for (const row of allRows) {
    const code = String(row.emp_code).trim();
    if (code) byCode.set(code, row);
  }

  return { rows: [...byCode.values()], model };
}

export async function generatePayrollWithAi(
  input: GeneratePayrollWithAiInput
): Promise<GeneratePayrollWithAiResult> {
  const { companyId, year, month, department, punchLogText, onBatchProgress } = input;
  const period = getPayrollPeriodBounds(year, month);
  const deptFilter = department && department !== 'all' ? department : undefined;

  const [
    settings,
    holidays,
    leaveDays,
    workingDaysMap,
    actualDaysMap,
    shiftsByEmployeeId,
    holidayDaysMap,
    attendanceResponse,
    employees,
    monthAdjustmentsByEmp,
  ] = await Promise.all([
    companySettingsService.getCompanySettings(companyId),
    getCompanyHolidaysForMonth(companyId, year, month),
    getApprovedLeaveDaysForMonth(companyId, year, month),
    getWorkingDaysInMonthByEmployee(companyId, year, month),
    getActualWorkingDaysFromAttendance(companyId, year, month),
    getEmployeeShiftsByEmployeeId(companyId),
    getCompanyHolidayDaysByEmployee(companyId, year, month),
    attendanceService.getAll({
      companyId,
      dateFrom: period.periodStart,
      dateTo: period.periodEnd,
    }),
    employeeService.getAll(companyId),
    employeePayrollMonthService.getSummariesByCompanyMonth(companyId, year, month),
  ]);

  const holidayDates = holidayDatesInPeriod(holidays, period.periodStart, period.periodEnd);
  const punchText = punchLogText?.trim() ?? '';

  let punchPresentByEmp: Record<string, number> = {};
  if (punchText) {
    const parseResult = parsePunchLog(punchText, period, employees, {
      holidayDates,
      shiftsByEmployeeId,
      lateToleranceMinutes: settings?.late_tolerance_minutes ?? PAYROLL_LATE_TOLERANCE_MINUTES,
    });
    punchPresentByEmp = parseResult.actualDaysByEmployeeId;
  }

  const activeEmployees = employees.filter(
    (e) =>
      e.status === 'Active' &&
      e.employment_type !== 'Consultant' &&
      e.employmentType !== 'Consultant' &&
      (!deptFilter ||
        (e.department || '').toLowerCase() === deptFilter.toLowerCase() ||
        ((e as { departments?: { name?: string } }).departments?.name || '').toLowerCase() ===
          deptFilter.toLowerCase())
  );

  const lateByEmp: Record<string, { date: string; minutes_late: number }[]> = {};
  const lateTolerance = settings?.late_tolerance_minutes ?? PAYROLL_LATE_TOLERANCE_MINUTES;

  for (const log of attendanceResponse.data) {
    const empId = log.employee_id;
    const date = log.date?.slice(0, 10);
    if (!empId || !date) continue;
    if (!isDateInPayrollPeriod(date, period)) continue;
    if (holidayDates.has(date)) continue;

    const lateMin = Number(log.late_minutes ?? 0);
    if (lateMin > lateTolerance) {
      if (!lateByEmp[empId]) lateByEmp[empId] = [];
      lateByEmp[empId].push({ date, minutes_late: lateMin });
    }
  }

  const employeePayload = activeEmployees.map((emp) => {
    const empCode = emp.employee_id || emp.employeeId || '';
    const shifts = (shiftsByEmployeeId[emp.id] ?? []).map((s: EmployeeShift) => ({
      day_of_week: s.day_of_week,
      start_time: String(s.start_time).slice(0, 5),
      end_time: String(s.end_time).slice(0, 5),
    }));
    const inPunchFile = emp.id in punchPresentByEmp;
    const scheduled = workingDaysMap[emp.id] ?? 26;
    const approvedLeave = leaveDays[emp.id] ?? 0;
    const presentFromApi = actualDaysMap[emp.id];
    const presentFromPunch = punchPresentByEmp[emp.id];
    const lateRecords = lateByEmp[emp.id];
    const monthHr = monthAdjustmentsByEmp[emp.id];

    return {
      emp_code: empCode,
      basic_salary_kwd: Number(emp.base_salary ?? emp.salary ?? 0) || 0,
      on_paper_salary_kwd: Number(emp.on_paper_salary ?? 0) || 0,
      scheduled_working_days: scheduled,
      company_holiday_days: holidayDaysMap[emp.id] ?? 0,
      approved_paid_leave_days: approvedLeave,
      present_days_from_attendance: presentFromApi ?? null,
      present_days_from_punch: presentFromPunch ?? null,
      default_full_present: punchText.length > 0 && !inPunchFile,
      shifts: shifts.length > 0 ? shifts : undefined,
      late_records: lateRecords && lateRecords.length > 0 ? lateRecords : undefined,
      monthly_hr_settings: monthHr?.entries.length
        ? {
            paid_leave_days: monthHr.paid_leave_days,
            paid_leave_from_balance_days: monthHr.paid_leave_from_balance_days,
            unpaid_leave_days: monthHr.unpaid_leave_days,
            sick_leave_days: monthHr.sick_leave_days,
            emergency_leave_days: monthHr.emergency_leave_days,
            permitted_late_days: monthHr.permitted_late_days,
            loan_kwd: monthHr.loan_kwd,
            full_month_salary: monthHr.full_month_salary,
            late_penalty_count_from: monthHr.late_penalty_count_from,
            entries: monthHr.entries,
          }
        : undefined,
    };
  });

  const token = await getAccessToken();

  const requestBase = {
    company_id: companyId,
    year,
    month,
    department: deptFilter ?? 'all',
    late_tolerance_minutes: settings?.late_tolerance_minutes ?? PAYROLL_LATE_TOLERANCE_MINUTES,
    default_hours_per_day: Number(settings?.default_working_hours_per_day ?? 8),
    period: {
      start: period.periodStart,
      end: period.periodEnd,
      label: formatPayrollPeriodRange(period),
    },
    company_holidays: holidays.map((h) => ({
      date: h.holiday_date.slice(0, 10),
      name: h.name,
    })),
  };

  const { rows: aiRows, model } = await processEmployeeBatches(
    token,
    requestBase,
    employeePayload,
    punchText,
    activeEmployees,
    onBatchProgress,
  );

  const aiByCode = new Map(aiRows.map((r) => [String(r.emp_code).trim(), r]));

  const defaultHours = Number(settings?.default_working_hours_per_day ?? 8);
  const lateDeductionByEmpId: Record<string, number> = {};

  if (punchText) {
    for (const emp of activeEmployees) {
      const empCode = emp.employee_id || emp.employeeId || '';
      const matchIds = new Set(punchMatchIdsForEmployee(emp));
      if (matchIds.size === 0) continue;

      const monthHr = monthAdjustmentsByEmp[emp.id];
      const excludedDates = monthHr?.entries.length
        ? datesFromPermittedLateEntries(monthHr.entries, period)
        : new Set<string>();

      const shifts = shiftsByEmployeeId[emp.id] ?? [];
      const hoursPerDay = resolveHoursPerDay(shifts, defaultHours);
      const basic = Number(emp.base_salary ?? emp.salary ?? 0) || 0;

      const { total_kwd } = computeLatePenaltiesFromPunchText(punchText, {
        period,
        machineIds: matchIds,
        shifts,
        basicSalaryKwd: basic,
        hoursPerDay,
        holidayDates,
        excludedDates,
        countFromDate: monthHr?.late_penalty_count_from,
      });

      lateDeductionByEmpId[emp.id] = total_kwd;
    }
  }

  const baseReport = await buildKdaPayrollReport({
    companyId,
    month,
    year,
    department: deptFilter,
    workingDaysByEmployeeId: workingDaysMap,
    paidLeaveDaysByEmployeeId: leaveDays,
    actualDaysByEmployeeId: punchText ? punchPresentByEmp : actualDaysMap,
    missingAttendanceDefaultsToFullPresent: Boolean(punchText),
  });

  const rows = baseReport.rows.map((row) =>
    mergeAiRow(
      row,
      aiByCode.get(row.empCode.trim()),
      monthAdjustmentsByEmp[row.employeeId],
      lateDeductionByEmpId[row.employeeId],
      { trustAiAttendance: false },
    ),
  );

  return {
    companyName: baseReport.companyName,
    companyNameArabic: baseReport.companyNameArabic,
    periodLabel: baseReport.periodLabel,
    departmentLabel: baseReport.departmentLabel,
    rows,
    model,
  };
}
