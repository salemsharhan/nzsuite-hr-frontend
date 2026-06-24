import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import { PAYROLL_MONTH_DIVISOR } from './payrollTemplate';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Max paid-leave days: all non-present scheduled days can be classified as paid leave. */
export function maxPaidLeaveDaysForRow(row: KdaPayrollReportRow): number {
  const scheduled = row.workingDaysInMonth ?? PAYROLL_MONTH_DIVISOR;
  const present = row.actualWorkingDays ?? 0;
  return Math.max(0, scheduled - present);
}

/**
 * Recompute absent days, salary (present only), paid leave pay, and unpaid-absent deduction.
 * Unpaid absent days reduce gross via lower salary + paid leave split (not double-counted in deductions).
 */
export function recalcPayrollRow(
  row: KdaPayrollReportRow,
  updates: Partial<KdaPayrollReportRow> = {}
): KdaPayrollReportRow {
  const next = { ...row, ...updates };
  const scheduled = next.workingDaysInMonth ?? PAYROLL_MONTH_DIVISOR;
  const present = next.actualWorkingDays ?? 0;
  const maxLeave = Math.max(0, scheduled - present);
  const paidLeave = Math.min(Math.max(0, next.paidLeaveDays ?? 0), maxLeave);
  const absent = Math.max(0, scheduled - present - paidLeave);
  const daily = PAYROLL_MONTH_DIVISOR > 0 ? next.basicSalaryKwd / PAYROLL_MONTH_DIVISOR : 0;

  const salaryKwd = round3(daily * present);
  const paidLeaveKwd = round3(daily * paidLeave);
  const absentDeductionKwd = round3(daily * absent);

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

  return {
    ...next,
    paidLeaveDays: paidLeave,
    absentDays: absent,
    salaryKwd,
    paidLeaveKwd,
    absentDeductionKwd,
    totalGrossKwd,
    netSalaryKwd,
    amountScheduledToPay: round3(netSalaryKwd + (next.salaryRefund ?? 0))
  };
}
