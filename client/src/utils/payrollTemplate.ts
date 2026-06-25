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

/** Divisor used in template formulas (e.g. =E6/26*G6) */
export const PAYROLL_MONTH_DIVISOR = 26;

/** Each unpermitted-late day deducts this fraction of a full daily rate (¼ day ≈ 2 hrs). */
export const PAYROLL_UNPERMITTED_LATE_DAY_FRACTION = 0.25;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function dailySalaryKwd(basicSalaryKwd: number): number {
  return PAYROLL_MONTH_DIVISOR > 0 ? basicSalaryKwd / PAYROLL_MONTH_DIVISOR : 0;
}

/** Deduction for unpermitted late: (basic ÷ 26) × ¼ per day. */
export function calcUnpermittedLateDeductionKwd(
  basicSalaryKwd: number,
  unpermittedLateDays: number
): number {
  const daily = dailySalaryKwd(basicSalaryKwd);
  return round3(
    daily * PAYROLL_UNPERMITTED_LATE_DAY_FRACTION * Math.max(0, unpermittedLateDays)
  );
}

/**
 * BEC payroll salary:
 * - Paid leave days > 0: (basic ÷ 26) × paid leave days (e.g. Eid with 27 days).
 * - Paid leave days = 0: basic − full-day absent − ¼-day unpermitted late deductions.
 * Paid leave KWD is always 0.
 */
export function calcBecSalaryKwd(
  basicSalaryKwd: number,
  paidLeaveDays: number,
  absentDays = 0,
  unpermittedLateDays = 0
): number {
  const daily = dailySalaryKwd(basicSalaryKwd);
  if (paidLeaveDays > 0) {
    return round3(daily * paidLeaveDays);
  }
  const deduction =
    daily * Math.max(0, absentDays) +
    daily * PAYROLL_UNPERMITTED_LATE_DAY_FRACTION * Math.max(0, unpermittedLateDays);
  if (deduction > 0) {
    return round3(Math.max(0, basicSalaryKwd - deduction));
  }
  return round3(basicSalaryKwd);
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
