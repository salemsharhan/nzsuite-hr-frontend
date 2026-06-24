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

/** Divisor used in template formulas (e.g. =E6/26*F6) */
export const PAYROLL_MONTH_DIVISOR = 26;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Company holidays add to salary only when the employee has no unpaid absent days
 * (i.e. they attended every non-holiday scheduled day, or gaps are covered by paid leave).
 */
export function effectiveHolidayPayDays(
  present: number,
  companyHolidayDays: number,
  permittedLateDays: number,
  paidLeaveDays: number,
  scheduled: number
): number {
  const unpaidAbsent =
    scheduled -
    present -
    paidLeaveDays -
    permittedLateDays -
    companyHolidayDays;
  return unpaidAbsent <= 0 ? Math.max(0, companyHolidayDays) : 0;
}

/** Paid salary days from attendance + eligible holidays + permitted late, capped at 26. */
export function payableSalaryDays(
  present: number,
  companyHolidayDays: number,
  permittedLateDays = 0,
  paidLeaveDays = 0,
  scheduled = PAYROLL_MONTH_DIVISOR
): number {
  const holidayPay = effectiveHolidayPayDays(
    present,
    companyHolidayDays,
    permittedLateDays,
    paidLeaveDays,
    scheduled
  );
  return Math.min(
    PAYROLL_MONTH_DIVISOR,
    Math.max(0, present) + Math.max(0, permittedLateDays) + holidayPay
  );
}

export function calcSalaryKwdFromDays(
  basicSalaryKwd: number,
  present: number,
  companyHolidayDays: number,
  permittedLateDays = 0,
  paidLeaveDays = 0,
  scheduled = PAYROLL_MONTH_DIVISOR
): number {
  const daily =
    PAYROLL_MONTH_DIVISOR > 0 ? basicSalaryKwd / PAYROLL_MONTH_DIVISOR : 0;
  return round3(
    daily *
      payableSalaryDays(
        present,
        companyHolidayDays,
        permittedLateDays,
        paidLeaveDays,
        scheduled
      )
  );
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
