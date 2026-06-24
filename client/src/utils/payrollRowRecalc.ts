import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import { PAYROLL_MONTH_DIVISOR, calcSalaryKwdFromDays } from './payrollTemplate';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Recompute absent days, salary (present + permitted late), paid leave pay, and unpaid-absent deduction.
 * Paid leave and permitted late are manual — any non-negative value is allowed.
 */
export function recalcPayrollRow(
  row: KdaPayrollReportRow,
  updates: Partial<KdaPayrollReportRow> = {}
): KdaPayrollReportRow {
  const next = { ...row, ...updates };
  const scheduled = next.workingDaysInMonth ?? PAYROLL_MONTH_DIVISOR;
  const present = next.actualWorkingDays ?? 0;
  const companyHolidayDays = Math.max(0, next.companyHolidayDays ?? 0);
  const paidLeave = Math.max(0, next.paidLeaveDays ?? 0);
  let permittedLate = Math.max(0, next.permittedLateDays ?? 0);
  const grossAbsent = scheduled - present - paidLeave - companyHolidayDays;
  permittedLate = Math.min(permittedLate, Math.max(0, grossAbsent));
  const absent = Math.max(0, grossAbsent - permittedLate);
  const daily = PAYROLL_MONTH_DIVISOR > 0 ? next.basicSalaryKwd / PAYROLL_MONTH_DIVISOR : 0;

  const salaryKwd = calcSalaryKwdFromDays(
    next.basicSalaryKwd,
    present,
    companyHolidayDays,
    permittedLate,
    paidLeave,
    scheduled
  );
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
  const salaryRefund = round3(Math.max(0, next.salaryRefund ?? 0));

  return {
    ...next,
    paidLeaveDays: paidLeave,
    permittedLateDays: permittedLate,
    companyHolidayDays,
    absentDays: absent,
    salaryKwd,
    paidLeaveKwd,
    absentDeductionKwd,
    totalGrossKwd,
    netSalaryKwd,
    salaryRefund,
    amountScheduledToPay: round3(netSalaryKwd + salaryRefund)
  };
}
