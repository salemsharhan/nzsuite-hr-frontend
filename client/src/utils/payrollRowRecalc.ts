import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import {
  PAYROLL_MONTH_DIVISOR,
  PAYROLL_UNPERMITTED_LATE_DAY_FRACTION,
  calcBecSalaryParts,
  calcSalaryRefundKwd,
  dailySalaryKwd,
  resolveOnPaperSalaryKwd
} from './payrollTemplate';
import { resolvePayrollMonthDivisor } from './payrollWorkingDays';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Recompute absent days and salary (paid leave days × daily, or basic − deductions).
 */
export function recalcPayrollRow(
  row: KdaPayrollReportRow,
  updates: Partial<KdaPayrollReportRow> = {},
  options: { employeeBaseSalaryKwd?: number } = {}
): KdaPayrollReportRow {
  const next = { ...row, ...updates };
  const basicSalaryKwd =
    options.employeeBaseSalaryKwd ?? next.basicSalaryKwd ?? 0;
  const scheduled = next.workingDaysInMonth ?? PAYROLL_MONTH_DIVISOR;
  const monthDivisor = resolvePayrollMonthDivisor(scheduled, {
    storedDivisor: next.payrollMonthDivisor,
  });
  const present = next.actualWorkingDays ?? 0;
  const companyHolidayDays = Math.max(0, next.companyHolidayDays ?? 0);
  const paidLeave = Math.max(0, next.paidLeaveDays ?? 0);
  let permittedLate = Math.max(0, next.permittedLateDays ?? 0);
  let permittedLeave = Math.max(0, next.permittedLeaveDays ?? 0);
  let unpermittedLate = Math.max(0, next.unpermittedLateDays ?? 0);
  const pool = Math.max(0, scheduled - present - companyHolidayDays - paidLeave);
  permittedLeave = Math.min(permittedLeave, pool);
  let remaining = Math.max(0, pool - permittedLeave);
  permittedLate = Math.min(permittedLate, remaining);
  remaining = Math.max(0, remaining - permittedLate);
  unpermittedLate = Math.min(unpermittedLate, remaining);
  remaining = Math.max(0, remaining - unpermittedLate);
  const absent = remaining;
  const daily = dailySalaryKwd(basicSalaryKwd, monthDivisor);
  const absentDeductionKwd = round3(
    daily * absent + daily * PAYROLL_UNPERMITTED_LATE_DAY_FRACTION * unpermittedLate
  );
  const { salaryKwd, paidLeaveKwd } = calcBecSalaryParts(
    basicSalaryKwd,
    present,
    paidLeave,
    unpermittedLate,
    companyHolidayDays,
    permittedLeave,
    monthDivisor
  );

  const totalGrossKwd = round3(
    salaryKwd +
      paidLeaveKwd +
      (next.overTimeKwd ?? 0) +
      (next.housingAllowanceKwd ?? 0) +
      (next.otherKwd ?? 0)
  );
  const totalDeductions = round3(
    (next.penaltiesKwd ?? 0) +
      (next.deductionsKwd ?? 0) +
      (next.loanKwd ?? 0) +
      (next.deductionsOtherKwd ?? 0)
  );
  const netSalaryKwd = round3(Math.max(0, totalGrossKwd - totalDeductions));
  const rawOnPaper = Math.max(0, next.onPaperSalaryKwd ?? 0);
  const onPaperSalaryKwd = resolveOnPaperSalaryKwd(rawOnPaper, basicSalaryKwd);
  const salaryRefund = calcSalaryRefundKwd(rawOnPaper, netSalaryKwd, basicSalaryKwd);

  return {
    ...next,
    basicSalaryKwd,
    payrollMonthDivisor: monthDivisor,
    paidLeaveDays: paidLeave,
    permittedLateDays: permittedLate,
    permittedLeaveDays: permittedLeave,
    unpermittedLateDays: unpermittedLate,
    companyHolidayDays,
    absentDays: absent,
    salaryKwd,
    paidLeaveKwd,
    absentDeductionKwd,
    onPaperSalaryKwd,
    totalGrossKwd,
    netSalaryKwd,
    salaryRefund,
    amountScheduledToPay: round3(netSalaryKwd + salaryRefund),
    notes: salaryRefund > 0 ? '*' : ''
  };
}

const ATTENDANCE_FIELD_KEYS = new Set<keyof KdaPayrollReportRow>([
  'basicSalaryKwd',
  'workingDaysInMonth',
  'companyHolidayDays',
  'actualWorkingDays',
  'paidLeaveDays',
  'permittedLateDays',
  'permittedLeaveDays',
  'unpermittedLateDays',
  'absentDays'
]);

/** Manual override of money / totals (CEO unlock full edit). */
export function applyManualPayrollRow(
  row: KdaPayrollReportRow,
  updates: Partial<KdaPayrollReportRow>
): KdaPayrollReportRow {
  const next = { ...row, ...updates };
  const totalGrossKwd =
    'totalGrossKwd' in updates
      ? round3(next.totalGrossKwd ?? 0)
      : round3(
          (next.salaryKwd ?? 0) +
            (next.paidLeaveKwd ?? 0) +
            (next.overTimeKwd ?? 0) +
            (next.housingAllowanceKwd ?? 0) +
            (next.otherKwd ?? 0)
        );
  const totalDeductions = round3(
    (next.penaltiesKwd ?? 0) +
      (next.deductionsKwd ?? 0) +
      (next.loanKwd ?? 0) +
      (next.deductionsOtherKwd ?? 0)
  );
  const netSalaryKwd =
    'netSalaryKwd' in updates
      ? round3(next.netSalaryKwd ?? 0)
      : round3(Math.max(0, totalGrossKwd - totalDeductions));
  const salaryRefund = round3(next.salaryRefund ?? 0);
  const amountScheduledToPay =
    'amountScheduledToPay' in updates
      ? round3(next.amountScheduledToPay ?? 0)
      : round3(netSalaryKwd + salaryRefund);

  return {
    ...next,
    totalGrossKwd,
    netSalaryKwd,
    salaryRefund,
    amountScheduledToPay
  };
}

/** Route attendance edits through recalc; money fields through manual patch. */
export function patchPayrollRow(
  row: KdaPayrollReportRow,
  updates: Partial<KdaPayrollReportRow>,
  options: { employeeBaseSalaryKwd?: number } = {}
): KdaPayrollReportRow {
  const usesAttendance = (Object.keys(updates) as (keyof KdaPayrollReportRow)[]).some((k) =>
    ATTENDANCE_FIELD_KEYS.has(k)
  );
  if (usesAttendance) {
    return recalcPayrollRow(row, updates, options);
  }
  return applyManualPayrollRow(row, updates);
}
