import { employeeService, Employee } from './employeeService';
import { companyService } from './companyService';
import { leaveService } from './leaveService';
import { companySettingsService, type EmployeeShift } from './companySettingsService';
import { attendanceService } from './attendanceService';

import { PAYROLL_MONTH_DIVISOR, calcBecSalaryParts, calcSalaryRefundKwd, resolveOnPaperSalaryKwd } from '@/utils/payrollTemplate';
import {
  countScheduledDaysInPeriod,
  countCompanyHolidayDaysInPeriod,
  holidayDatesInPeriod,
  employeeHasSaturdayOff,
  resolvePayrollMonthDivisor,
} from '@/utils/payrollWorkingDays';
import {
  getPayrollPeriodBounds,
  formatPayrollPeriodRange,
  isDateInPayrollPeriod,
  type PayrollPeriodBounds
} from '@/utils/payrollPeriod';
import { applyMonthAdjustmentsToPayrollRow, type MonthAdjustmentSummary } from '@/utils/payrollMonthAdjustments';

export { getPayrollPeriodBounds, formatPayrollPeriodRange, type PayrollPeriodBounds };

/** Default working days per month — matches Excel template divisor (e.g. =E6/26*F6) */
const DEFAULT_WORKING_DAYS = PAYROLL_MONTH_DIVISOR;

/** Approved leave types that add extra salary days (Paid Leave KWD column). Sick/unpaid are excluded. */
export function isPaidSalaryLeaveType(leaveType: string): boolean {
  const t = leaveType.trim().toLowerCase();
  if (!t) return false;
  if (
    /sick|unpaid|without\s*pay|emergency|مرض|غير\s*مدفوع|طارئ/.test(t)
  ) {
    return false;
  }
  if (/annual|vacation|personal|marriage|haj|bereavement|paternity|سنوية|مدفوعة/.test(t)) {
    return true;
  }
  return false;
}

/**
 * Sick / emergency approved leave — excused, full pay (permitted leave column), not paid-leave KWD.
 */
export function isPermittedExcusedLeaveType(leaveType: string): boolean {
  const t = leaveType.trim().toLowerCase();
  if (!t) return false;
  return /sick|emergency|مرض|طارئ/.test(t);
}

function daysOverlappingPeriod(
  startDate: string,
  endDate: string,
  period: PayrollPeriodBounds
): number {
  const periodStart = new Date(period.periodStart);
  const periodEnd = new Date(period.periodEnd);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const from = start < periodStart ? periodStart : start;
  const to = end > periodEnd ? periodEnd : end;
  if (from > to) return 0;
  const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

/**
 * Fetch approved leave days per employee for a payroll period.
 * Returns Record<employeeId, days>.
 */
export async function getApprovedLeaveDaysForMonth(
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const period = getPayrollPeriodBounds(year, month);
  const requests = await leaveService.getAll({
    companyId,
    status: 'Approved',
    date_from: period.periodStart,
    date_to: period.periodEnd,
    limit: 2000
  });
  const byEmployee: Record<string, number> = {};
  for (const req of requests) {
    if (!isPaidSalaryLeaveType(req.leave_type ?? '')) continue;
    const days = daysOverlappingPeriod(req.start_date, req.end_date, period);
    const id = req.employee_id;
    byEmployee[id] = (byEmployee[id] || 0) + days;
  }
  return byEmployee;
}

/**
 * Approved sick / emergency leave days per employee (permitted leave — full pay, no absent cut).
 */
export async function getApprovedPermittedLeaveDaysForMonth(
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const period = getPayrollPeriodBounds(year, month);
  const requests = await leaveService.getAll({
    companyId,
    status: 'Approved',
    date_from: period.periodStart,
    date_to: period.periodEnd,
    limit: 2000
  });
  const byEmployee: Record<string, number> = {};
  for (const req of requests) {
    if (!isPermittedExcusedLeaveType(req.leave_type ?? '')) continue;
    const days = daysOverlappingPeriod(req.start_date, req.end_date, period);
    const id = req.employee_id;
    byEmployee[id] = (byEmployee[id] || 0) + days;
  }
  return byEmployee;
}

/**
 * Get company holidays overlapping a payroll period.
 */
export async function getCompanyHolidaysForMonth(
  companyId: string,
  year: number,
  month: number
): Promise<{ holiday_date: string; name: string }[]> {
  const period = getPayrollPeriodBounds(year, month);
  return companySettingsService.getCompanyHolidays(companyId, period.periodStart, period.periodEnd);
}

/**
 * Get actual working days (days present) from attendance for a given month.
 * Calls attendance API and counts distinct dates per employee. Returns Record<employeeId, days>.
 */
export async function getActualWorkingDaysFromAttendance(
  companyId: string,
  year: number,
  month: number,
  holidayDates?: Set<string>
): Promise<Record<string, number>> {
  const period = getPayrollPeriodBounds(year, month);
  const holidays =
    holidayDates ??
    holidayDatesInPeriod(
      await getCompanyHolidaysForMonth(companyId, year, month),
      period.periodStart,
      period.periodEnd
    );

  const response = await attendanceService.getAll({
    companyId,
    dateFrom: period.periodStart,
    dateTo: period.periodEnd
  });
  const { shiftsByEmp } = await getEmployeeShiftsMapForCompany(companyId);
  const byEmployee: Record<string, number> = {};
  const seen = new Map<string, Set<string>>();
  for (const log of response.data) {
    const empId = log.employee_id;
    const date = log.date?.slice(0, 10);
    if (!empId || !date) continue;
    if (!isDateInPayrollPeriod(date, period)) continue;
    if (holidays.has(date)) continue;
    if (log.status === 'Absent' || log.status === 'Leave') continue;
    // Late counts as present for salary; lateness is handled in deductions column
    if (log.status !== 'Present' && log.status !== 'Late') continue;

    const shifts = shiftsByEmp[empId] ?? [];
    if (shifts.length > 0) {
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      const onScheduledDay = shifts.some((s) => s.day_of_week === dayOfWeek);
      if (!onScheduledDay) continue;
    }

    if (!seen.has(empId)) seen.set(empId, new Set());
    seen.get(empId)!.add(date);
  }
  seen.forEach((dates, empId) => {
    byEmployee[empId] = dates.size;
  });
  return byEmployee;
}

/** One bulk shift fetch per company — shared by payroll rebuild helpers. */
async function getEmployeeShiftsMapForCompany(companyId: string): Promise<{
  employees: Employee[];
  shiftsByEmp: Record<string, EmployeeShift[]>;
}> {
  const employees = await employeeService.getAll(companyId);
  const shiftsByEmp = await companySettingsService.getEmployeeShiftsForEmployees(
    employees.map((e) => e.id),
    companyId
  );
  return { employees, shiftsByEmp };
}

function workingWeekdaysFromShifts(shifts: EmployeeShift[]): Set<number> {
  const workingWeekdays = new Set<number>();
  shifts.forEach((s) => workingWeekdays.add(s.day_of_week));
  return workingWeekdays;
}

/**
 * Get working days in a month based on employee shift (day_of_week).
 * Returns Record<employeeId, days>. Uses employee_shifts; if none, falls back to default (e.g. 26).
 */
export async function getWorkingDaysInMonthByEmployee(
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const period = getPayrollPeriodBounds(year, month);
  const { employees, shiftsByEmp } = await getEmployeeShiftsMapForCompany(companyId);
  const result: Record<string, number> = {};
  /** Mon–Sat when no employee shift is configured (typical 26-day month). */
  const defaultWeekdays = new Set([1, 2, 3, 4, 5, 6]);

  for (const emp of employees) {
    const workingWeekdays = workingWeekdaysFromShifts(shiftsByEmp[emp.id] ?? []);
    if (workingWeekdays.size === 0) {
      result[emp.id] = Math.min(
        PAYROLL_MONTH_DIVISOR,
        countScheduledDaysInPeriod(period, defaultWeekdays)
      );
      continue;
    }
    result[emp.id] = Math.min(
      PAYROLL_MONTH_DIVISOR,
      countScheduledDaysInPeriod(period, workingWeekdays)
    );
  }
  return result;
}

/** Paid company holidays per employee (on their working weekdays) in the payroll period. */
export async function getCompanyHolidayDaysByEmployee(
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const period = getPayrollPeriodBounds(year, month);
  const { employees, shiftsByEmp } = await getEmployeeShiftsMapForCompany(companyId);
  const holidayDates = holidayDatesInPeriod(
    await getCompanyHolidaysForMonth(companyId, year, month),
    period.periodStart,
    period.periodEnd
  );
  const result: Record<string, number> = {};
  const defaultWeekdays = new Set([1, 2, 3, 4, 5, 6]);

  for (const emp of employees) {
    const workingWeekdays = workingWeekdaysFromShifts(shiftsByEmp[emp.id] ?? []);
    if (workingWeekdays.size === 0) {
      result[emp.id] = countCompanyHolidayDaysInPeriod(period, defaultWeekdays, holidayDates);
      continue;
    }
    result[emp.id] = countCompanyHolidayDaysInPeriod(period, workingWeekdays, holidayDates);
  }
  return result;
}

/** Employee shifts keyed by UUID — used for late-grace checks on punch import. */
export async function getEmployeeShiftsByEmployeeId(
  companyId: string
): Promise<Record<string, EmployeeShift[]>> {
  const { shiftsByEmp } = await getEmployeeShiftsMapForCompany(companyId);
  return shiftsByEmp;
}

/** One row of the KDA-format payroll report */
export interface KdaPayrollReportRow {
  employeeId: string; // UUID for editing
  sn: number;
  empCode: string;
  nameArabicEnglish: string;
  joinDate: string;
  basicSalaryKwd: number;
  /** Daily-rate divisor for salary (26 Mon–Sat, 21 Saturday off) */
  payrollMonthDivisor: number;
  workingDaysInMonth: number; // scheduled days from shift
  actualWorkingDays: number;  // present days from attendance
  /** Company holidays on working days — paid, not counted as absent */
  companyHolidayDays: number;
  paidLeaveDays: number;
  /** Late days approved — paid like present, moved from absent manually */
  permittedLateDays: number;
  /** Approved leave — excused absence; no salary add or deduct */
  permittedLeaveDays: number;
  /** Late without approval — removes from absent; deducts ¼ day salary each */
  unpermittedLateDays: number;
  absentDays: number;         // scheduled - present - holidays - permitted/unpermitted late/leave (≥0)
  /** Salary not paid for unpaid absent days (informational; already reflected in salaryKwd) */
  absentDeductionKwd: number;
  /** Declared on-paper salary from employee profile (KWD) */
  onPaperSalaryKwd: number;
  /** Gross: Salary KWD (pro-rated) */
  salaryKwd: number;
  /** Gross: Paid Leave KWD */
  paidLeaveKwd: number;
  /** Gross: Over Time KWD */
  overTimeKwd: number;
  /** Gross: housing allowance KWD */
  housingAllowanceKwd: number;
  /** Gross: Other KWD */
  otherKwd: number;
  /** Gross: Total */
  totalGrossKwd: number;
  /** Deductions: Penalties */
  penaltiesKwd: number;
  /** Deductions: Deductions */
  deductionsKwd: number;
  /** Deductions: Loan */
  loanKwd: number;
  /** Deductions: Other */
  deductionsOtherKwd: number;
  /** Net Salary KWD */
  netSalaryKwd: number;
  /** The amount scheduled to pay (e.g. bank transfer amount) */
  amountScheduledToPay: number;
  /** Method of payment */
  methodOfPayment: string;
  /** Salary refund (amount employee returns) */
  salaryRefund: number;
  /** Notes */
  notes: string;
}

export interface KdaPayrollReportInput {
  companyId: string;
  month: number; // 1-12
  year: number;
  /** Optional: filter by department name */
  department?: string;
  /** Working days in month (default 26) - used when workingDaysByEmployeeId not set */
  workingDays?: number;
  /** Working days in month per employee (from shift/schedule); overrides workingDays */
  workingDaysByEmployeeId?: Record<string, number>;
  /** Paid leave days per employee for this month (optional; default 0) */
  paidLeaveDaysByEmployeeId?: Record<string, number>;
  /** Sick / emergency approved leave — permitted leave, full pay (optional; default 0) */
  permittedLeaveDaysByEmployeeId?: Record<string, number>;
  /** Actual days present from attendance API (optional); when set, used for actualWorkingDays */
  actualDaysByEmployeeId?: Record<string, number>;
  /** When set, only these employee UUIDs appear in the report (e.g. attendance import) */
  onlyEmployeeIds?: string[];
  /**
   * When actualDaysByEmployeeId is set (attendance import), employees missing from that map
   * are treated as fully present (scheduled days minus approved paid leave).
   */
  missingAttendanceDefaultsToFullPresent?: boolean;
  /** Override payment method per employee (optional) */
  paymentMethodByEmployeeId?: Record<string, string>;
  /** Return/refund amount per employee (optional; used for amount scheduled and salary refund) */
  returnAmountByEmployeeId?: Record<string, number>;
  /** HR monthly leave/late settings from employee profile */
  monthAdjustmentsByEmployeeId?: Record<string, MonthAdjustmentSummary>;
}

/**
 * Format join date as D.M.YYYY or DD.MM.YYYY to match Excel sample
 */
function formatJoinDate(joinDate: string | undefined): string {
  if (!joinDate) return '';
  const d = new Date(joinDate);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Name for report: Arabic first, then " / ", then English (e.g. "محمد أحمد / Mohammed Ahmed")
 */
function getNameArabicEnglish(emp: Employee): string {
  const arabicParts = [
    emp.arabic_first_name || emp.arabicFirstName,
    emp.arabic_middle_name || emp.arabicMiddleName,
    emp.arabic_last_name || emp.arabicLastName
  ].filter(Boolean);
  const englishParts = [
    emp.first_name || emp.firstName,
    emp.middle_name || emp.middleName,
    emp.last_name || emp.lastName
  ].filter(Boolean);
  const arabic = arabicParts.length ? arabicParts.join(' ') : '';
  const english = englishParts.length ? englishParts.join(' ') : '';
  if (arabic && english) return `${arabic} / ${english}`;
  if (arabic) return arabic;
  return english || '';
}

/**
 * Build payroll report rows in KDA (Kuwait Dyslexia Association) format.
 * Uses employee base_salary, housing_allowance, other allowances; defaults 26 working days, 0 paid leave.
 */
export async function buildKdaPayrollReport(input: KdaPayrollReportInput): Promise<{
  companyName: string;
  companyNameArabic: string;
  periodLabel: string;
  departmentLabel: string;
  rows: KdaPayrollReportRow[];
}> {
  const paidLeaveByEmp = input.paidLeaveDaysByEmployeeId ?? {};
  const permittedLeaveByEmp = input.permittedLeaveDaysByEmployeeId ?? {};
  const actualDaysByEmp = input.actualDaysByEmployeeId ?? {};
  const paymentMethodByEmp = input.paymentMethodByEmployeeId ?? {};
  const returnAmountByEmp = input.returnAmountByEmployeeId ?? {};
  const workingDaysByEmp = input.workingDaysByEmployeeId ?? {};
  const monthAdjByEmp = input.monthAdjustmentsByEmployeeId ?? {};
  const companyHolidayByEmp = await getCompanyHolidayDaysByEmployee(
    input.companyId,
    input.year,
    input.month
  );
  const shiftsByEmp = await getEmployeeShiftsByEmployeeId(input.companyId);

  let companyName = '';
  let companyNameArabic = '';
  try {
    const company = await companyService.getById(input.companyId);
    companyName = company.name || '';
    companyNameArabic = (company as any).name_ar || companyName;
  } catch {
    companyName = 'Company';
    companyNameArabic = 'Company';
  }

  const employees = await employeeService.getAll(input.companyId);
  let list: Employee[] = employees.filter(
    (e) => e.status === 'Active' && (e.employment_type !== 'Consultant' && e.employmentType !== 'Consultant')
  );
  if (input.department) {
    list = list.filter(
      (e) =>
        (e.department || '').toLowerCase() === input.department!.toLowerCase() ||
        ((e as any).departments?.name || '').toLowerCase() === input.department!.toLowerCase()
    );
  }
  if (input.onlyEmployeeIds?.length) {
    const allowed = new Set(input.onlyEmployeeIds);
    list = list.filter((e) => allowed.has(e.id));
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const period = getPayrollPeriodBounds(input.year, input.month);
  const periodLabel = `${monthNames[input.month - 1]} ${input.year} Payroll Report (${formatPayrollPeriodRange(period)})`;
  const departmentLabel = input.department ? `Department / ${input.department}` : 'Department / HR';

  const rows: KdaPayrollReportRow[] = list.map((emp, index) => {
    const baseSalary = Number(emp.base_salary ?? emp.salary ?? 0) || 0;
    const workingDaysInMonth = workingDaysByEmp[emp.id] ?? input.workingDays ?? DEFAULT_WORKING_DAYS;
    const saturdayOff = employeeHasSaturdayOff(shiftsByEmp[emp.id] ?? []);
    const payrollMonthDivisor = resolvePayrollMonthDivisor(workingDaysInMonth, { saturdayOff });
    const companyHolidayDays = companyHolidayByEmp[emp.id] ?? 0;
    const paidLeaveDays = paidLeaveByEmp[emp.id] ?? 0;
    const attendanceProvided = input.actualDaysByEmployeeId !== undefined;
    const actualWorkingDays =
      actualDaysByEmp[emp.id] !== undefined
        ? actualDaysByEmp[emp.id]
        : input.missingAttendanceDefaultsToFullPresent
          ? Math.max(0, workingDaysInMonth - paidLeaveDays - companyHolidayDays)
          : attendanceProvided || input.onlyEmployeeIds?.length
            ? 0
            : Math.max(0, workingDaysInMonth - paidLeaveDays - companyHolidayDays);
    const permittedLateDays = 0;
    const permittedLeaveDays = permittedLeaveByEmp[emp.id] ?? 0;
    const unpermittedLateDays = 0;
    const absentDays = Math.max(
      0,
      workingDaysInMonth -
        actualWorkingDays -
        companyHolidayDays -
        paidLeaveDays -
        permittedLateDays -
        permittedLeaveDays -
        unpermittedLateDays
    );
    const dailyRate = payrollMonthDivisor > 0 ? baseSalary / payrollMonthDivisor : 0;
    const absentDeductionKwd = round3(dailyRate * absentDays);
    const { salaryKwd, paidLeaveKwd } = calcBecSalaryParts(
      baseSalary,
      actualWorkingDays,
      paidLeaveDays,
      unpermittedLateDays,
      companyHolidayDays,
      permittedLeaveDays,
      payrollMonthDivisor
    );
    const overTimeKwd = 0;
    const housingAllowanceKwd = Number(emp.housing_allowance ?? 0) || 0;
    const otherKwd =
      Number(emp.transport_allowance ?? 0) +
      Number(emp.meal_allowance ?? 0) +
      Number(emp.medical_allowance ?? 0) +
      Number(emp.other_allowances ?? 0) || 0;

    const totalGrossKwd = salaryKwd + paidLeaveKwd + overTimeKwd + housingAllowanceKwd + otherKwd;

    const penaltiesKwd = 0;
    const deductionsKwd = 0;
    const loanKwd = 0;
    const deductionsOtherKwd = 0;
    const totalDeductions = penaltiesKwd + deductionsKwd + loanKwd + deductionsOtherKwd;

    const netSalaryKwd = Math.max(0, totalGrossKwd - totalDeductions);
    const rawOnPaper = Number(emp.on_paper_salary ?? 0) || 0;
    const onPaperSalaryKwd = resolveOnPaperSalaryKwd(rawOnPaper, baseSalary);
    const salaryRefund = calcSalaryRefundKwd(rawOnPaper, netSalaryKwd, baseSalary);
    const amountScheduledToPay = netSalaryKwd + salaryRefund;
    const methodOfPayment = paymentMethodByEmp[emp.id] ?? 'Bank transfer';
    const notes = salaryRefund > 0 ? '*' : '';

    return {
      employeeId: emp.id,
      sn: index + 1,
      empCode: emp.employee_id || emp.employeeId || '',
      nameArabicEnglish: getNameArabicEnglish(emp),
      joinDate: formatJoinDate(emp.join_date || emp.hireDate),
      basicSalaryKwd: baseSalary,
      payrollMonthDivisor,
      workingDaysInMonth,
      actualWorkingDays,
      companyHolidayDays,
      paidLeaveDays,
      permittedLateDays,
      permittedLeaveDays,
      unpermittedLateDays,
      absentDays,
      absentDeductionKwd,
      onPaperSalaryKwd: round3(onPaperSalaryKwd),
      salaryKwd: round3(salaryKwd),
      paidLeaveKwd: round3(paidLeaveKwd),
      overTimeKwd: round3(overTimeKwd),
      housingAllowanceKwd: round3(housingAllowanceKwd),
      otherKwd: round3(otherKwd),
      totalGrossKwd: round3(totalGrossKwd),
      penaltiesKwd: round3(penaltiesKwd),
      deductionsKwd: round3(deductionsKwd),
      loanKwd: round3(loanKwd),
      deductionsOtherKwd: round3(deductionsOtherKwd),
      netSalaryKwd: round3(netSalaryKwd),
      amountScheduledToPay: round3(amountScheduledToPay),
      methodOfPayment,
      salaryRefund: round3(salaryRefund),
      notes
    };
  }).map((row) => applyMonthAdjustmentsToPayrollRow(row, monthAdjByEmp[row.employeeId]));

  return {
    companyName,
    companyNameArabic,
    periodLabel,
    departmentLabel,
    rows
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
