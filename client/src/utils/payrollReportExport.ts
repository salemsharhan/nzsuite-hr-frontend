import type { KdaPayrollReportRow } from '../services/payrollReportService';

/** Escape a cell for CSV (wrap in quotes if contains comma, quote, or newline) */
function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Build CSV content for KDA payroll report (Excel-compatible, UTF-8 with BOM).
 * Column order and headers match the provided Excel template (bilingual).
 */
export function buildKdaPayrollCsv(
  options: {
    companyNameArabic: string;
    companyName: string;
    periodLabel: string;
    departmentLabel: string;
    rows: KdaPayrollReportRow[];
  }
): string {
  const { companyNameArabic, companyName, periodLabel, departmentLabel, rows } = options;
  const lines: string[] = [];

  // Header block (optional - Excel might use first row as title)
  lines.push(csvCell(`${companyNameArabic}  ${companyName}`));
  lines.push(csvCell(periodLabel));
  lines.push(csvCell(departmentLabel));
  lines.push('');

  // Column headers (bilingual) - main row
  const headerRow1 = [
    'S/N',
    'Emp. Code كود',
    'Name / Arabic الاسم / عربي',
    'Join Date تاريخ التعيين',
    'Basic Salary KWD الراتب الأساسي',
    'Scheduled Days (from shift) أيام الجدول',
    'Present Days أيام الحضور',
    'Paid leave Days اجازات مدفوعة',
    'Absent Days أيام الغياب',
    'Salary KWD الراتب د.ك',
    'Paid Leave KWD اجازات مدفوعة د.ك',
    'Over Time KWD إضافي د.ك',
    'housing allowance KWD بدل سكن د.ك',
    'Other أخرى',
    'Total الإجمالي',
    'Penalties جزاءات',
    'Deductions خصومات',
    'Loan سلف',
    'Other أخرى',
    'Net Salary KWD صافي الراتب',
    'The amount scheduled to pay',
    'Method of payment',
    'SALARY REFUND',
    'Notes ملاحظات'
  ];
  lines.push(headerRow1.map(csvCell).join(','));

  // Data rows
  for (const r of rows) {
    const row = [
      r.sn,
      r.empCode,
      r.nameArabicEnglish,
      r.joinDate,
      r.basicSalaryKwd,
      r.workingDaysInMonth,
      r.actualWorkingDays,
      r.paidLeaveDays,
      r.absentDays,
      r.salaryKwd.toFixed(3),
      r.paidLeaveKwd.toFixed(3),
      r.overTimeKwd.toFixed(3),
      r.housingAllowanceKwd.toFixed(3),
      r.otherKwd.toFixed(3),
      r.totalGrossKwd.toFixed(3),
      r.penaltiesKwd.toFixed(3),
      r.deductionsKwd.toFixed(3),
      r.loanKwd.toFixed(3),
      r.deductionsOtherKwd.toFixed(3),
      r.netSalaryKwd.toFixed(3),
      r.amountScheduledToPay.toFixed(3),
      r.methodOfPayment,
      r.salaryRefund.toFixed(3),
      r.notes
    ];
    lines.push(row.map(csvCell).join(','));
  }

  const csv = lines.join('\r\n');
  const BOM = '\uFEFF';
  return BOM + csv;
}

/**
 * Trigger download of a CSV file
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
