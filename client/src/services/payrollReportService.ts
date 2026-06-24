import { employeeService, Employee } from './employeeService';
import { companyService } from './companyService';
import { leaveService } from './leaveService';
import { companySettingsService } from './companySettingsService';
import { attendanceService } from './attendanceService';

import { PAYROLL_MONTH_DIVISOR } from '@/utils/payrollTemplate';

/** Default working days per month — matches Excel template divisor (e.g. =E6/26*F6) */
const DEFAULT_WORKING_DAYS = PAYROLL_MONTH_DIVISOR;

/**
 * Get number of days that a date range overlaps with a given month.
 */
function daysOverlappingMonth(
  startDate: string,
  endDate: string,
  year: number,
  month: number
): number {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const from = start < monthStart ? monthStart : start;
  const to = end > monthEnd ? monthEnd : end;
  if (from > to) return 0;
  const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

/**
 * Fetch approved leave days per employee for a given month.
 * Returns Record<employeeId, days>.
 */
export async function getApprovedLeaveDaysForMonth(
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const requests = await leaveService.getAll({
    companyId,
    status: 'Approved',
    date_from: monthStart,
    date_to: monthEnd,
    limit: 2000
  });
  const byEmployee: Record<string, number> = {};
  for (const req of requests) {
    const days = daysOverlappingMonth(req.start_date, req.end_date, year, month);
    const id = req.employee_id;
    byEmployee[id] = (byEmployee[id] || 0) + days;
  }
  return byEmployee;
}

/**
 * Get actual working days (days present) from attendance for a given month.
 * Calls attendance API and counts distinct dates per employee. Returns Record<employeeId, days>.
 */
export async function getActualWorkingDaysFromAttendance(
  companyId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const response = await attendanceService.getAll({
    companyId,
    dateFrom: monthStart,
    dateTo: monthEnd
    // no limit/page so we get full aggregated list
  });
  const byEmployee: Record<string, number> = {};
  const seen = new Map<string, Set<string>>(); // employeeId -> Set<date>
  for (const log of response.data) {
    const empId = log.employee_id;
    const date = log.date;
    if (!empId || !date) continue;
    if (!seen.has(empId)) seen.set(empId, new Set());
    seen.get(empId)!.add(date);
  }
  seen.forEach((dates, empId) => {
    byEmployee[empId] = dates.size;
  });
  return byEmployee;
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
  const employees = await employeeService.getAll(companyId);
  const result: Record<string, number> = {};
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const totalDays = monthEnd.getDate();

  for (const emp of employees) {
    const shifts = await companySettingsService.getEmployeeShifts(emp.id);
    const workingWeekdays = new Set<number>();
    shifts.forEach((s) => workingWeekdays.add(s.day_of_week));
    if (workingWeekdays.size === 0) {
      result[emp.id] = DEFAULT_WORKING_DAYS;
      continue;
    }
    let count = 0;
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      if (workingWeekdays.has(date.getDay())) count++;
    }
    result[emp.id] = count;
  }
  return result;
}

/** One row of the KDA-format payroll report */
export interface KdaPayrollReportRow {
  employeeId: string; // UUID for editing
  sn: number;
  empCode: string;
  nameArabicEnglish: string;
  joinDate: string;
  basicSalaryKwd: number;
  workingDaysInMonth: number; // scheduled days from shift
  actualWorkingDays: number;  // present days from attendance
  paidLeaveDays: number;
  absentDays: number;         // scheduled - present - leave (≥0)
  /** Salary not paid for unpaid absent days (informational; already reflected in salaryKwd) */
  absentDeductionKwd: number;
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
  /** Actual days present from attendance API (optional); when set, used for actualWorkingDays */
  actualDaysByEmployeeId?: Record<string, number>;
  /** When set, only these employee UUIDs appear in the report (e.g. attendance import) */
  onlyEmployeeIds?: string[];
  /** Override payment method per employee (optional) */
  paymentMethodByEmployeeId?: Record<string, string>;
  /** Return/refund amount per employee (optional; used for amount scheduled and salary refund) */
  returnAmountByEmployeeId?: Record<string, number>;
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
  const actualDaysByEmp = input.actualDaysByEmployeeId ?? {};
  const paymentMethodByEmp = input.paymentMethodByEmployeeId ?? {};
  const returnAmountByEmp = input.returnAmountByEmployeeId ?? {};
  const workingDaysByEmp = input.workingDaysByEmployeeId ?? {};

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
  const periodLabel = `${monthNames[input.month - 1]} ${input.year} Payroll Report`;
  const departmentLabel = input.department ? `Department / ${input.department}` : 'Department / HR';

  const rows: KdaPayrollReportRow[] = list.map((emp, index) => {
    const baseSalary = Number(emp.base_salary ?? emp.salary ?? 0) || 0;
    const workingDaysInMonth = workingDaysByEmp[emp.id] ?? input.workingDays ?? DEFAULT_WORKING_DAYS;
    const paidLeaveDays = paidLeaveByEmp[emp.id] ?? 0;
    const attendanceProvided = input.actualDaysByEmployeeId !== undefined;
    const actualWorkingDays =
      actualDaysByEmp[emp.id] !== undefined
        ? actualDaysByEmp[emp.id]
        : attendanceProvided || input.onlyEmployeeIds?.length
          ? 0
          : Math.max(0, workingDaysInMonth - paidLeaveDays);
    const absentDays = Math.max(0, workingDaysInMonth - actualWorkingDays - paidLeaveDays);
    const dailyRate =
      DEFAULT_WORKING_DAYS > 0 ? baseSalary / DEFAULT_WORKING_DAYS : 0;
    const absentDeductionKwd = round3(dailyRate * absentDays);

    const salaryKwd = round3(dailyRate * actualWorkingDays);
    const paidLeaveKwd = round3(dailyRate * paidLeaveDays);
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
    const returnAmount = returnAmountByEmp[emp.id] ?? 0;
    const amountScheduledToPay = netSalaryKwd + returnAmount;
    const methodOfPayment = paymentMethodByEmp[emp.id] ?? 'Bank transfer';
    const salaryRefund = returnAmount;
    const notes = returnAmount > 0 ? '*' : '';

    return {
      employeeId: emp.id,
      sn: index + 1,
      empCode: emp.employee_id || emp.employeeId || '',
      nameArabicEnglish: getNameArabicEnglish(emp),
      joinDate: formatJoinDate(emp.join_date || emp.hireDate),
      basicSalaryKwd: baseSalary,
      workingDaysInMonth,
      actualWorkingDays,
      paidLeaveDays,
      absentDays,
      absentDeductionKwd,
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
  });

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
