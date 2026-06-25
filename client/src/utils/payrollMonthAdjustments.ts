import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import { recalcPayrollRow } from './payrollRowRecalc';
import type { PayrollPeriodBounds } from './payrollPeriod';

export type PayrollMonthEntryType =
  | 'paid_leave'
  | 'paid_leave_from_balance'
  | 'unpaid_leave'
  | 'sick_leave'
  | 'emergency_leave'
  | 'permitted_late'
  | 'full_month_salary'
  | 'loan';

export type PayrollMonthInputMode = 'days_count' | 'date_range' | 'amount_kwd';

export type PayrollMonthEntryEffect = 'add_salary' | 'deduct_salary' | 'none';

export const PAYROLL_MONTH_ENTRY_EFFECT: Record<PayrollMonthEntryType, PayrollMonthEntryEffect> = {
  paid_leave: 'add_salary',
  paid_leave_from_balance: 'none',
  unpaid_leave: 'deduct_salary',
  sick_leave: 'none',
  emergency_leave: 'none',
  permitted_late: 'none',
  full_month_salary: 'none',
  loan: 'deduct_salary',
};

export interface PayrollMonthAdjustmentEntry {
  id?: string;
  employee_id: string;
  company_id: string;
  payroll_year: number;
  payroll_month: number;
  entry_type: PayrollMonthEntryType;
  input_mode: PayrollMonthInputMode;
  days_count?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  amount_kwd?: number | null;
  notes?: string | null;
}

export interface ResolvedMonthEntry {
  type: PayrollMonthEntryType;
  days: number;
  amount_kwd?: number;
  payroll_effect: PayrollMonthEntryEffect;
  date_from?: string;
  date_to?: string;
  notes?: string;
}

export interface MonthAdjustmentSummary {
  paid_leave_days: number;
  paid_leave_from_balance_days: number;
  unpaid_leave_days: number;
  sick_leave_days: number;
  emergency_leave_days: number;
  permitted_late_days: number;
  full_month_salary: boolean;
  /** Sum of loan entries for payroll Loan (سلف) column */
  loan_kwd: number;
  /** When set (e.g. overseas return), late penalties only from this date onward */
  late_penalty_count_from?: string;
  entries: ResolvedMonthEntry[];
}

function daysOverlappingPeriod(
  startDate: string,
  endDate: string,
  period: PayrollPeriodBounds,
): number {
  const from = startDate.slice(0, 10);
  const to = endDate.slice(0, 10);
  const periodStart = period.periodStart;
  const periodEnd = period.periodEnd;
  const overlapFrom = from < periodStart ? periodStart : from;
  const overlapTo = to > periodEnd ? periodEnd : to;
  if (overlapFrom > overlapTo) return 0;
  const a = new Date(`${overlapFrom}T12:00:00`);
  const b = new Date(`${overlapTo}T12:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

export function resolveEntryDays(
  entry: Pick<
    PayrollMonthAdjustmentEntry,
    'input_mode' | 'days_count' | 'date_from' | 'date_to'
  >,
  period: PayrollPeriodBounds,
): number {
  if (entry.input_mode === 'days_count') {
    return Math.max(0, Number(entry.days_count) || 0);
  }
  if (entry.date_from && entry.date_to) {
    return daysOverlappingPeriod(entry.date_from, entry.date_to, period);
  }
  return 0;
}

export function summarizeMonthAdjustments(
  entries: PayrollMonthAdjustmentEntry[],
  period: PayrollPeriodBounds,
): MonthAdjustmentSummary {
  const summary: MonthAdjustmentSummary = {
    paid_leave_days: 0,
    paid_leave_from_balance_days: 0,
    unpaid_leave_days: 0,
    sick_leave_days: 0,
    emergency_leave_days: 0,
    permitted_late_days: 0,
    full_month_salary: false,
    loan_kwd: 0,
    entries: [],
  };

  for (const entry of entries) {
    if (entry.entry_type === 'loan') {
      const amount = Math.max(0, Number(entry.amount_kwd) || 0);
      if (amount <= 0) continue;
      summary.loan_kwd += amount;
      summary.entries.push({
        type: 'loan',
        days: 0,
        amount_kwd: amount,
        payroll_effect: PAYROLL_MONTH_ENTRY_EFFECT.loan,
        notes: entry.notes?.trim() || undefined,
      });
      continue;
    }

    const days = resolveEntryDays(entry, period);
    if (days <= 0 && entry.entry_type !== 'full_month_salary') continue;

    const resolved: ResolvedMonthEntry = {
      type: entry.entry_type,
      days: entry.entry_type === 'full_month_salary' ? Math.max(days, 1) : days,
      payroll_effect: PAYROLL_MONTH_ENTRY_EFFECT[entry.entry_type],
      date_from: entry.date_from?.slice(0, 10) || undefined,
      date_to: entry.date_to?.slice(0, 10) || undefined,
      notes: entry.notes?.trim() || undefined,
    };
    summary.entries.push(resolved);

    switch (entry.entry_type) {
      case 'paid_leave':
        summary.paid_leave_days += days;
        break;
      case 'paid_leave_from_balance':
        summary.paid_leave_from_balance_days += days;
        break;
      case 'unpaid_leave':
        summary.unpaid_leave_days += days;
        break;
      case 'sick_leave':
        summary.sick_leave_days += days;
        break;
      case 'emergency_leave':
        summary.emergency_leave_days += days;
        break;
      case 'permitted_late':
        summary.permitted_late_days += days;
        break;
      case 'full_month_salary':
        summary.full_month_salary = true;
        if (entry.date_from) {
          const d = entry.date_from.slice(0, 10);
          if (!summary.late_penalty_count_from || d < summary.late_penalty_count_from) {
            summary.late_penalty_count_from = d;
          }
        }
        break;
    }
  }

  return summary;
}

/** Apply HR monthly settings to a payroll row (BEC buckets + loan). */
export function applyMonthAdjustmentsToPayrollRow(
  row: KdaPayrollReportRow,
  summary: MonthAdjustmentSummary | undefined,
): KdaPayrollReportRow {
  if (!summary) return row;
  const hasLeave = summary.entries.some((e) => e.type !== 'loan');
  const loanKwd = summary.loan_kwd ?? 0;
  if (!hasLeave && loanKwd <= 0) return row;

  const permittedLeaveAdd =
    summary.sick_leave_days +
    summary.emergency_leave_days +
    summary.paid_leave_from_balance_days;

  const scheduled = row.workingDaysInMonth ?? 26;
  const paidLeaveTotal = (row.paidLeaveDays ?? 0) + summary.paid_leave_days;
  const presentDays = summary.full_month_salary
    ? Math.max(0, scheduled - paidLeaveTotal)
    : Math.max(0, (row.actualWorkingDays ?? 0) - summary.unpaid_leave_days);

  return recalcPayrollRow(row, {
    ...(hasLeave
      ? {
          paidLeaveDays: paidLeaveTotal,
          permittedLeaveDays: (row.permittedLeaveDays ?? 0) + permittedLeaveAdd,
          permittedLateDays: (row.permittedLateDays ?? 0) + summary.permitted_late_days,
          actualWorkingDays: presentDays,
        }
      : {}),
    loanKwd,
  });
}
