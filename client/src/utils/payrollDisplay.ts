import i18n from './i18n';
import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import type { Employee } from '@/services/employeeService';
import { getEmployeeDisplayName } from './employeeName';

export const PAYROLL_MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
] as const;

export function isPayrollArabic(): boolean {
  return (i18n.language || 'en').split('-')[0] === 'ar';
}

/** Pick Arabic or English name from stored "Arabic / English" payroll row value. */
export function getPayrollRowDisplayName(combined: string): string {
  if (!combined) return '';
  const idx = combined.indexOf(' / ');
  if (idx === -1) return combined;
  const arabic = combined.slice(0, idx).trim();
  const english = combined.slice(idx + 3).trim();
  if (isPayrollArabic()) return arabic || english;
  return english || arabic;
}

/** Prefer live employee profile names (Arabic in AR mode), then stored payroll row text. */
export function getPayrollEmployeeDisplayName(
  row: KdaPayrollReportRow,
  employeesById: Record<string, Employee | undefined>
): string {
  const emp = row.employeeId ? employeesById[row.employeeId] : undefined;
  if (emp) {
    const fromProfile = getEmployeeDisplayName(emp);
    if (fromProfile) return fromProfile;
  }
  return getPayrollRowDisplayName(row.nameArabicEnglish);
}

export function getPayrollMonthLabel(month: number | string, t: (key: string) => string): string {
  const m = typeof month === 'string' ? parseInt(month, 10) : month;
  const key = PAYROLL_MONTH_KEYS[m - 1] ?? 'january';
  return t(`payroll.months.${key}`);
}

export function formatPayrollPeriodLabel(
  month: number | string,
  year: number | string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  return t('payroll.periodLabel', {
    month: getPayrollMonthLabel(month, t),
    year: String(year)
  });
}

export function formatPayrollDepartmentLabel(
  department: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (!department || department === 'all') {
    return t('payroll.allDepartments');
  }
  return t('payroll.departmentSlash', { name: department });
}

export function formatPayrollCompanyTitle(
  companyName: string,
  companyNameArabic: string
): string {
  const ar = companyNameArabic?.trim();
  const en = companyName?.trim();
  if (isPayrollArabic()) {
    if (ar && en && ar !== en) return `${ar} — ${en}`;
    return ar || en || '';
  }
  if (en && ar && ar !== en) return `${en} — ${ar}`;
  return en || ar || '';
}

export function translatePaymentMethod(
  method: string,
  t: (key: string) => string
): string {
  const map: Record<string, string> = {
    'Bank transfer': t('payroll.payment.bankTransfer'),
    Check: t('payroll.payment.check'),
    Cash: t('payroll.payment.cash')
  };
  return map[method] ?? method;
}
