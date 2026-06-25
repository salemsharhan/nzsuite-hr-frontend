import ExcelJS from 'exceljs';
import type { Employee } from '@/services/employeeService';
import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import { materializeWorksheetFormulas } from './payrollExcelFormulaUtils';
import { PAYROLL_MONTH_DIVISOR } from './payrollTemplate';

const DATA_START_ROW = 6;
const JUNE_2026_COLS = {
  sn: 1,
  empCode: 2,
  name: 3,
  joinDate: 4,
  basicSalary: 5,
  actualDays: 6,
  paidLeaveDays: 7,
  salaryKwd: 8,
  paidLeaveKwd: 9,
  overTimeKwd: 10,
  housingKwd: 11,
  otherKwd: 12,
  totalGross: 13,
  penalties: 14,
  deductions: 15,
  loan: 16,
  deductionsOther: 17,
  netSalary: 18,
  amountScheduled: 19,
  method: 20,
  refund: 21,
  notes: 22
};

export interface PayrollExcelImportResult {
  meta: {
    companyName: string;
    companyNameArabic: string;
    periodLabel: string;
    departmentLabel: string;
  };
  rows: KdaPayrollReportRow[];
  matched: number;
  unmatchedNames: string[];
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && 'richText' in v && Array.isArray(v.richText)) {
    return v.richText.map((t) => t.text).join('');
  }
  if (typeof v === 'object' && 'result' in v && v.result != null) {
    return String(v.result);
  }
  if (typeof v === 'object' && 'text' in v && v.text) {
    return String(v.text);
  }
  return String(v);
}

function cellNumber(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'result' in v && typeof v.result === 'number') {
    return v.result;
  }
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Normalize for Arabic name comparison */
export function normalizeNameKey(name: string): string {
  return name
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Extract Arabic portion from bilingual name cell */
export function extractArabicName(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  const parts = text.split(/\s*[/|]\s*/);
  for (const part of parts) {
    if (/[\u0600-\u06FF]/.test(part)) return part.trim();
  }
  return text;
}

export function getEmployeeArabicFullName(emp: Employee): string {
  const parts = [
    emp.arabic_first_name || emp.arabicFirstName,
    emp.arabic_middle_name || emp.arabicMiddleName,
    emp.arabic_last_name || emp.arabicLastName
  ].filter(Boolean) as string[];
  return parts.join(' ').trim();
}

function findEmployeeByArabicName(
  arabicName: string,
  employees: Employee[],
  usedIds: Set<string>
): Employee | null {
  const key = normalizeNameKey(arabicName);
  if (!key) return null;

  const candidates = employees.filter((e) => !usedIds.has(e.id));
  const withArabic = candidates
    .map((e) => ({ e, arabic: getEmployeeArabicFullName(e), key: normalizeNameKey(getEmployeeArabicFullName(e)) }))
    .filter((x) => x.key);

  const exact = withArabic.find((x) => x.key === key);
  if (exact) return exact.e;

  const contains = withArabic.find(
    (x) => x.key.includes(key) || key.includes(x.key)
  );
  if (contains) return contains.e;

  const keyNoSpaces = key.replace(/\s/g, '');
  const loose = withArabic.find((x) => {
    const k = x.key.replace(/\s/g, '');
    return k === keyNoSpaces || k.includes(keyNoSpaces) || keyNoSpaces.includes(k);
  });
  return loose?.e ?? null;
}

function findPayrollSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  const preferred = [
    'BEC (1-2026)',
    'DYLX (6-2025)',
    'DYLX',
    'BEC (1-2026)'
  ];
  for (const name of preferred) {
    const ws = workbook.getWorksheet(name);
    if (ws) return ws;
  }
  for (const ws of workbook.worksheets) {
    for (let r = 4; r <= 5; r++) {
      for (let c = 1; c <= 5; c++) {
        const t = cellText(ws.getRow(r).getCell(c));
        if (t.includes('Name / Arabic') || t.includes('الاسم')) return ws;
      }
    }
  }
  return workbook.worksheets[0] ?? null;
}

function detectNameColumn(ws: ExcelJS.Worksheet): number {
  for (let r = 4; r <= 5; r++) {
    for (let c = 1; c <= 6; c++) {
      const t = cellText(ws.getRow(r).getCell(c));
      if (t.includes('Name / Arabic') || t.includes('الاسم / عربي')) return c;
    }
  }
  return JUNE_2026_COLS.name;
}

function colOffset(nameCol: number): number {
  return nameCol - JUNE_2026_COLS.name;
}

function isFooterRow(name: string): boolean {
  const t = name.trim().toLowerCase();
  return (
    t === 'total' ||
    t.startsWith('prepared by') ||
    t.startsWith('checked by') ||
    t.startsWith('approved by')
  );
}

function shouldStopImportAtRow(ws: ExcelJS.Worksheet, rowNum: number, nameCol: number): boolean {
  const peek = cellText(ws.getRow(rowNum).getCell(nameCol)).trim().toLowerCase();
  return peek === 'total' || peek.startsWith('prepared by');
}

function rowHasPayrollData(ws: ExcelJS.Worksheet, rowNum: number, offset: number): boolean {
  const c = (base: number) => ws.getRow(rowNum).getCell(base + offset);
  if (cellText(c(JUNE_2026_COLS.name)).trim()) return true;
  if (cellText(c(JUNE_2026_COLS.empCode)).trim()) return true;
  return false;
}

function parseImportedRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  offset: number
): Omit<KdaPayrollReportRow, 'employeeId'> | null {
  const c = (base: number) => ws.getRow(rowNum).getCell(base + offset);
  const nameRaw = cellText(c(JUNE_2026_COLS.name));
  if (isFooterRow(nameRaw)) return null;
  const empCode = cellText(c(JUNE_2026_COLS.empCode)).trim();
  if (!nameRaw.trim() && !empCode) return null;
  if (!nameRaw.trim() && !rowHasPayrollData(ws, rowNum, offset)) return null;

  const basic = cellNumber(c(JUNE_2026_COLS.basicSalary));
  const actualDays = Math.round(cellNumber(c(JUNE_2026_COLS.actualDays)));
  const paidLeaveDays = Math.round(cellNumber(c(JUNE_2026_COLS.paidLeaveDays)));
  const workingDaysInMonth = PAYROLL_MONTH_DIVISOR;
  const absentDays = Math.max(0, workingDaysInMonth - actualDays - paidLeaveDays);

  const salaryKwd = round3(cellNumber(c(JUNE_2026_COLS.salaryKwd)));
  const paidLeaveKwd = round3(cellNumber(c(JUNE_2026_COLS.paidLeaveKwd)));
  const overTimeKwd = round3(cellNumber(c(JUNE_2026_COLS.overTimeKwd)));
  const housingAllowanceKwd = round3(cellNumber(c(JUNE_2026_COLS.housingKwd)));
  const otherKwd = round3(cellNumber(c(JUNE_2026_COLS.otherKwd)));
  let totalGrossKwd = round3(cellNumber(c(JUNE_2026_COLS.totalGross)));
  if (!totalGrossKwd) {
    totalGrossKwd = round3(salaryKwd + paidLeaveKwd + overTimeKwd + housingAllowanceKwd + otherKwd);
  }

  const penaltiesKwd = round3(cellNumber(c(JUNE_2026_COLS.penalties)));
  const deductionsKwd = round3(cellNumber(c(JUNE_2026_COLS.deductions)));
  const loanKwd = round3(cellNumber(c(JUNE_2026_COLS.loan)));
  const deductionsOtherKwd = round3(cellNumber(c(JUNE_2026_COLS.deductionsOther)));
  let netSalaryKwd = round3(cellNumber(c(JUNE_2026_COLS.netSalary)));
  if (!netSalaryKwd) {
    netSalaryKwd = round3(
      Math.max(0, totalGrossKwd - penaltiesKwd - deductionsKwd - loanKwd - deductionsOtherKwd)
    );
  }

  const salaryRefund = round3(cellNumber(c(JUNE_2026_COLS.refund)));
  let amountScheduledToPay = round3(cellNumber(c(JUNE_2026_COLS.amountScheduled)));
  if (!amountScheduledToPay) amountScheduledToPay = round3(netSalaryKwd + salaryRefund);

  return {
    sn: Math.round(cellNumber(c(JUNE_2026_COLS.sn))) || rowNum - DATA_START_ROW + 1,
    empCode: empCode || cellText(c(JUNE_2026_COLS.empCode)).trim(),
    nameArabicEnglish: nameRaw.trim(),
    joinDate: cellText(c(JUNE_2026_COLS.joinDate)).trim(),
    basicSalaryKwd: round3(basic),
    workingDaysInMonth,
    actualWorkingDays: actualDays,
    companyHolidayDays: 0,
    paidLeaveDays,
    permittedLateDays: 0,
    permittedLeaveDays: 0,
    unpermittedLateDays: 0,
    onPaperSalaryKwd: 0,
    absentDays,
    absentDeductionKwd: round3(
      (PAYROLL_MONTH_DIVISOR > 0 ? basic / PAYROLL_MONTH_DIVISOR : 0) * absentDays
    ),
    salaryKwd,
    paidLeaveKwd,
    overTimeKwd,
    housingAllowanceKwd,
    otherKwd,
    totalGrossKwd,
    penaltiesKwd,
    deductionsKwd,
    loanKwd,
    deductionsOtherKwd,
    netSalaryKwd,
    amountScheduledToPay,
    methodOfPayment: cellText(c(JUNE_2026_COLS.method)).trim() || 'Bank transfer',
    salaryRefund,
    notes: cellText(c(JUNE_2026_COLS.notes)).trim()
  };
}

function parseHeaderMeta(ws: ExcelJS.Worksheet): PayrollExcelImportResult['meta'] {
  const title = cellText(ws.getRow(1).getCell(1));
  const periodLabel = cellText(ws.getRow(2).getCell(1)) || 'Payroll Report';
  const departmentLabel = cellText(ws.getRow(3).getCell(1)) || 'Department / HR';

  let companyNameArabic = title;
  let companyName = title;
  if (title.includes('  ')) {
    const [ar, en] = title.split(/\s{2,}/);
    companyNameArabic = ar?.trim() || title;
    companyName = en?.trim() || title;
  }

  return { companyName, companyNameArabic, periodLabel, departmentLabel };
}

/**
 * Import payroll rows from an external Excel file (docs June 2026 layout).
 * Tries to match employees by Arabic name; unmatched rows are still included as-is.
 */
export async function importPayrollExcel(
  file: File,
  employees: Employee[] = [],
  options?: {
    department?: string;
  }
): Promise<PayrollExcelImportResult> {
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer, 0, 2);
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error('File is not a valid Excel (.xlsx) workbook.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const ws = findPayrollSheet(workbook);
  if (!ws) throw new Error('No payroll sheet found in the workbook.');

  materializeWorksheetFormulas(ws);

  const meta = parseHeaderMeta(ws);
  if (options?.department && options.department !== 'all') {
    meta.departmentLabel = `Department / ${options.department}`;
  }

  const nameCol = detectNameColumn(ws);
  const offset = colOffset(nameCol);
  const usedIds = new Set<string>();
  const unmatchedNames: string[] = [];
  const importedRows: KdaPayrollReportRow[] = [];
  let matched = 0;

  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    if (shouldStopImportAtRow(ws, r, nameCol)) break;

    const parsed = parseImportedRow(ws, r, offset);
    if (!parsed) {
      continue;
    }

    const arabicName = extractArabicName(parsed.nameArabicEnglish);
    const emp = employees.length
      ? findEmployeeByArabicName(arabicName, employees, usedIds)
      : null;

    if (emp) {
      matched++;
      usedIds.add(emp.id);
      importedRows.push({
        ...parsed,
        employeeId: emp.id,
        empCode: parsed.empCode || emp.employee_id || emp.employeeId || ''
      });
      continue;
    }

    const label = parsed.nameArabicEnglish || arabicName || `Row ${r}`;
    unmatchedNames.push(label);
    importedRows.push({
      ...parsed,
      employeeId: `import-row-${r}`
    });
  }

  if (importedRows.length === 0) {
    throw new Error('No payroll data rows found in the Excel file.');
  }

  const rows = importedRows
    .sort((a, b) => a.sn - b.sn)
    .map((row, index) => ({ ...row, sn: index + 1 }));

  return {
    meta,
    rows,
    matched,
    unmatchedNames
  };
}
