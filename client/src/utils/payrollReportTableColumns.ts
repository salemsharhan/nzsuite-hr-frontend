import type { KdaPayrollReportRow } from '@/services/payrollReportService';

export interface PayrollReportExportMeta {
  companyName: string;
  companyNameArabic: string;
  periodLabel: string;
  departmentLabel: string;
}

export interface PayrollTableColumn {
  key: keyof KdaPayrollReportRow | 'amountScheduledToPay';
  headerEn: string;
  headerAr: string;
  align?: 'left' | 'center' | 'right';
  format?: (row: KdaPayrollReportRow) => string | number;
}

export const PAYROLL_TABLE_COLUMNS: PayrollTableColumn[] = [
  { key: 'sn', headerEn: 'S/N', headerAr: 'م', align: 'center' },
  { key: 'empCode', headerEn: 'Emp. Code', headerAr: 'كود', align: 'center' },
  { key: 'nameArabicEnglish', headerEn: 'Name / Arabic', headerAr: 'الاسم', align: 'left' },
  { key: 'joinDate', headerEn: 'Join Date', headerAr: 'تاريخ التعيين', align: 'center' },
  {
    key: 'basicSalaryKwd',
    headerEn: 'Basic Salary KWD',
    headerAr: 'الراتب الأساسي',
    align: 'right',
    format: (r) => fmt3(r.basicSalaryKwd)
  },
  {
    key: 'actualWorkingDays',
    headerEn: 'Actual Working Days',
    headerAr: 'أيام العمل الفعلية',
    align: 'center',
    format: (r) => r.actualWorkingDays
  },
  {
    key: 'paidLeaveDays',
    headerEn: 'Paid leave Days',
    headerAr: 'اجازات مدفوعة',
    align: 'center',
    format: (r) => r.paidLeaveDays
  },
  { key: 'salaryKwd', headerEn: 'Salary KWD', headerAr: 'الراتب د.ك', align: 'right', format: (r) => fmt3(r.salaryKwd) },
  {
    key: 'paidLeaveKwd',
    headerEn: 'Paid Leave KWD',
    headerAr: 'اجازات مدفوعة د.ك',
    align: 'right',
    format: (r) => fmt3(r.paidLeaveKwd)
  },
  { key: 'overTimeKwd', headerEn: 'Over Time KWD', headerAr: 'إضافي د.ك', align: 'right', format: (r) => fmt3(r.overTimeKwd) },
  {
    key: 'housingAllowanceKwd',
    headerEn: 'Housing KWD',
    headerAr: 'بدل سكن',
    align: 'right',
    format: (r) => fmt3(r.housingAllowanceKwd)
  },
  { key: 'otherKwd', headerEn: 'Other', headerAr: 'أخرى', align: 'right', format: (r) => fmt3(r.otherKwd) },
  { key: 'totalGrossKwd', headerEn: 'Total Gross', headerAr: 'الإجمالي', align: 'right', format: (r) => fmt3(r.totalGrossKwd) },
  { key: 'penaltiesKwd', headerEn: 'Penalties', headerAr: 'جزاءات', align: 'right', format: (r) => fmt3(r.penaltiesKwd) },
  { key: 'deductionsKwd', headerEn: 'Deductions', headerAr: 'خصومات', align: 'right', format: (r) => fmt3(r.deductionsKwd) },
  { key: 'loanKwd', headerEn: 'Loan', headerAr: 'سلف', align: 'right', format: (r) => fmt3(r.loanKwd) },
  {
    key: 'deductionsOtherKwd',
    headerEn: 'Ded. Other',
    headerAr: 'خصومات أخرى',
    align: 'right',
    format: (r) => fmt3(r.deductionsOtherKwd)
  },
  { key: 'netSalaryKwd', headerEn: 'Net Salary KWD', headerAr: 'صافي الراتب', align: 'right', format: (r) => fmt3(r.netSalaryKwd) },
  {
    key: 'amountScheduledToPay',
    headerEn: 'Amount Scheduled',
    headerAr: 'المبلغ المجدول',
    align: 'right',
    format: (r) => fmt3(r.amountScheduledToPay)
  },
  {
    key: 'methodOfPayment',
    headerEn: 'Method of payment',
    headerAr: 'طريقة الدفع',
    align: 'center',
    format: (r) => r.methodOfPayment || 'Bank transfer'
  },
  { key: 'salaryRefund', headerEn: 'Salary Refund', headerAr: 'استرداد', align: 'right', format: (r) => fmt3(r.salaryRefund) },
  { key: 'notes', headerEn: 'Notes', headerAr: 'ملاحظات', align: 'left', format: (r) => r.notes || '' }
];

function fmt3(n: number): string {
  if (!Number.isFinite(n)) return '0.000';
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

export function bilingualHeader(col: PayrollTableColumn): string {
  return `${col.headerEn} / ${col.headerAr}`;
}

const INTEGER_KEYS = new Set<keyof KdaPayrollReportRow | 'amountScheduledToPay'>([
  'sn',
  'actualWorkingDays',
  'paidLeaveDays',
  'workingDaysInMonth',
  'absentDays'
]);

export function cellValue(row: KdaPayrollReportRow, col: PayrollTableColumn): string | number {
  if (col.format) return col.format(row);
  const v = row[col.key as keyof KdaPayrollReportRow];
  if (typeof v === 'number') {
    if (INTEGER_KEYS.has(col.key)) return v;
    return fmt3(v);
  }
  return v == null ? '' : String(v);
}

export function computePayrollTotals(rows: KdaPayrollReportRow[]) {
  const sum = (fn: (r: KdaPayrollReportRow) => number) =>
    Math.round(rows.reduce((s, r) => s + (fn(r) || 0), 0) * 1000) / 1000;
  return {
    totalGross: sum((r) => r.totalGrossKwd),
    totalNet: sum((r) => r.netSalaryKwd),
    totalScheduled: sum((r) => r.amountScheduledToPay),
    totalRefund: sum((r) => r.salaryRefund)
  };
}

export function buildPayrollTableBody(rows: KdaPayrollReportRow[]): (string | number)[][] {
  return rows.map((row) => PAYROLL_TABLE_COLUMNS.map((col) => cellValue(row, col)));
}

export function buildPayrollTotalsRow(rows: KdaPayrollReportRow[]): (string | number)[] {
  const t = computePayrollTotals(rows);
  return PAYROLL_TABLE_COLUMNS.map((col, idx) => {
    if (idx === 2) return 'TOTAL';
    if (col.key === 'totalGrossKwd') return fmt3(t.totalGross);
    if (col.key === 'netSalaryKwd') return fmt3(t.totalNet);
    if (col.key === 'amountScheduledToPay') return fmt3(t.totalScheduled);
    if (col.key === 'salaryRefund') return fmt3(t.totalRefund);
    return '';
  });
}
