/** Payroll Excel template variants from docs/ */
import becTemplateUrl from '@/assets/payroll-templates/Payroll-BEC-June-2026.xlsx?url';
import dylxTemplateUrl from '@/assets/payroll-templates/Payroll-DYLX-June-2026.xlsx?url';

export type PayrollTemplateKind = 'bec' | 'dylx';

export const PAYROLL_TEMPLATE_CONFIG: Record<
  PayrollTemplateKind,
  { file: string; sheet: string; refundHeader: string }
> = {
  bec: {
    file: becTemplateUrl,
    sheet: 'BEC (1-2026)',
    refundHeader: 'REFUND SALARY'
  },
  dylx: {
    file: dylxTemplateUrl,
    sheet: 'DYLX (6-2025)',
    refundHeader: ' SALARY REFUND'
  }
};

/** Divisor for Mon–Sat schedules (BEC Excel default, e.g. =E6/26*G6) */
export const PAYROLL_MONTH_DIVISOR = 26;

/** Divisor when employee shift has Saturday off (Sun–Fri) */
export const PAYROLL_SATURDAY_OFF_DIVISOR = 21;

/** Each unpermitted-late day deducts this fraction of a full daily rate (¼ day ≈ 2 hrs). */
export const PAYROLL_UNPERMITTED_LATE_DAY_FRACTION = 0.25;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function dailySalaryKwd(
  basicSalaryKwd: number,
  monthDivisor: number = PAYROLL_MONTH_DIVISOR
): number {
  return monthDivisor > 0 ? basicSalaryKwd / monthDivisor : 0;
}

/** Deduction for unpermitted late: (basic ÷ divisor) × ¼ per day. */
export function calcUnpermittedLateDeductionKwd(
  basicSalaryKwd: number,
  unpermittedLateDays: number,
  monthDivisor: number = PAYROLL_MONTH_DIVISOR
): number {
  const daily = dailySalaryKwd(basicSalaryKwd, monthDivisor);
  return round3(
    daily * PAYROLL_UNPERMITTED_LATE_DAY_FRACTION * Math.max(0, unpermittedLateDays)
  );
}

/**
 * BEC/DYLX Excel salary columns (verified June 2026 templates):
 * - Salary KWD (col 8)  = (basic ÷ divisor) × (present + company holidays + permitted/sick leave) − ¼-day unpermitted-late cuts
 * - Paid Leave KWD (col 9) = (basic ÷ divisor) × paid leave days
 * - Divisor: 26 (Mon–Sat) or 21 (Saturday off)
 * - Company holidays are paid (no absent cut) and included in col 8 salary amount; present col stays punch-only count
 * - Permitted leave / sick (excused, full pay) counts like present for col 8 — no separate paid-leave column
 */
export function calcBecSalaryParts(
  basicSalaryKwd: number,
  actualWorkingDays: number,
  paidLeaveDays: number,
  unpermittedLateDays = 0,
  companyHolidayDays = 0,
  permittedLeaveDays = 0,
  monthDivisor: number = PAYROLL_MONTH_DIVISOR
): { salaryKwd: number; paidLeaveKwd: number } {
  const daily = dailySalaryKwd(basicSalaryKwd, monthDivisor);
  const unpermittedDeduction =
    daily * PAYROLL_UNPERMITTED_LATE_DAY_FRACTION * Math.max(0, unpermittedLateDays);
  const paidWorkDays =
    Math.max(0, actualWorkingDays) +
    Math.max(0, companyHolidayDays) +
    Math.max(0, permittedLeaveDays);
  const salaryKwd = round3(Math.max(0, daily * paidWorkDays - unpermittedDeduction));
  const paidLeaveKwd = round3(daily * Math.max(0, paidLeaveDays));
  return { salaryKwd, paidLeaveKwd };
}

/** @deprecated use calcBecSalaryParts — returns salary column only */
export function calcBecSalaryKwd(
  basicSalaryKwd: number,
  paidLeaveDays: number,
  absentDays = 0,
  unpermittedLateDays = 0,
  actualWorkingDays?: number
): number {
  const present =
    actualWorkingDays ??
    Math.max(0, PAYROLL_MONTH_DIVISOR - absentDays - paidLeaveDays);
  return calcBecSalaryParts(
    basicSalaryKwd,
    present,
    paidLeaveDays,
    unpermittedLateDays,
    0
  ).salaryKwd;
}

/** On-paper salary when set; otherwise 0 (no fallback to basic). */
export function resolveOnPaperSalaryKwd(
  onPaperSalary: number | null | undefined,
  _basicSalaryKwd = 0
): number {
  const onPaper = Number(onPaperSalary);
  if (Number.isFinite(onPaper) && onPaper > 0) return onPaper;
  return 0;
}

/** Salary refund only when on-paper is set: on-paper − net, or full on-paper if base is 0. */
export function calcSalaryRefundKwd(
  rawOnPaperSalary: number,
  netSalaryKwd: number,
  basicSalaryKwd = 0
): number {
  const rawOnPaper = Number(rawOnPaperSalary);
  const hasOnPaper = Number.isFinite(rawOnPaper) && rawOnPaper > 0;
  if (!hasOnPaper) return 0;

  const basic = Math.max(0, basicSalaryKwd);
  if (basic <= 0) {
    return round3(rawOnPaper);
  }
  return round3(Math.max(0, rawOnPaper - netSalaryKwd));
}

/** @deprecated use calcBecSalaryKwd */
export function calcSalaryKwdFromDays(
  basicSalaryKwd: number,
  present: number,
  _companyHolidayDays: number,
  _permittedLateDays = 0,
  paidLeaveDays = 0,
  _scheduled = PAYROLL_MONTH_DIVISOR,
  _permittedLeaveDays = 0
): number {
  return calcBecSalaryKwd(basicSalaryKwd, paidLeaveDays, 0, 0);
}

export function detectPayrollTemplate(
  companyName: string,
  companyNameArabic: string
): PayrollTemplateKind {
  const combined = `${companyName} ${companyNameArabic}`.toLowerCase();
  if (
    combined.includes('basaier') ||
    combined.includes('بصائر') ||
    combined.includes('bec')
  ) {
    return 'bec';
  }
  return 'dylx';
}

export function formatCompanyTitle(
  kind: PayrollTemplateKind,
  companyName: string,
  companyNameArabic: string
): string {
  if (kind === 'bec') {
    const english = companyName || 'Basaier Charity';
    const arabic = companyNameArabic || 'جمعية بصائر الخيرية';
    return `${arabic}  ${english}`;
  }
  const english = companyName || 'Kuwait Dyslexia Association';
  const arabic = companyNameArabic || 'الجمعية الكويتية للدسلكسيا';
  return `${arabic}  ${english}`;
}
