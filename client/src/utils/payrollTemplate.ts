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
