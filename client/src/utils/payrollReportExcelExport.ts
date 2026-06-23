import ExcelJS from 'exceljs';
import type { KdaPayrollReportRow } from '../services/payrollReportService';
import {
  detectPayrollTemplate,
  formatCompanyTitle,
  PAYROLL_TEMPLATE_CONFIG,
  type PayrollTemplateKind
} from './payrollTemplate';

const DATA_START_ROW = 6;
const LAST_DATA_ROW = 32;
const FOOTER_ROW = 33;
const COLUMN_COUNT = 22;
const TEMPLATE_DATA_SLOTS = LAST_DATA_ROW - DATA_START_ROW + 1;

/** Column widths from docs payroll templates (Excel character units). */
const PAYROLL_COLUMN_WIDTHS: Record<number, number> = {
  2: 17.69,
  3: 45.3,
  4: 16.69,
  5: 18.38,
  6: 12,
  7: 10.84,
  8: 21.3,
  9: 17.15,
  10: 14.54,
  11: 14,
  12: 14.3,
  13: 16.69,
  14: 17.3,
  15: 14.38,
  16: 15.3,
  17: 14.69,
  18: 21.15,
  19: 21.15,
  20: 21.15,
  21: 21.15,
  22: 36.29
};

export interface PayrollExcelExportOptions {
  companyName: string;
  companyNameArabic: string;
  periodLabel: string;
  departmentLabel: string;
  rows: KdaPayrollReportRow[];
  templateKind?: PayrollTemplateKind;
}

function numericOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function applyColumnWidths(ws: ExcelJS.Worksheet) {
  for (const [col, width] of Object.entries(PAYROLL_COLUMN_WIDTHS)) {
    ws.getColumn(Number(col)).width = width;
  }
}

/** Copy row formatting from the template sample row (direct ref — safe for theme colours). */
function applyRowStyleFromTemplate(
  ws: ExcelJS.Worksheet,
  targetRowNum: number,
  templateRowNum: number
) {
  const templateRow = ws.getRow(templateRowNum);
  const targetRow = ws.getRow(targetRowNum);
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    targetRow.getCell(col).style = templateRow.getCell(col).style;
  }
}

/**
 * Clear a data row with explicit values.
 * Using null breaks shared formulas left in the template and corrupts the file.
 */
function clearDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
  const row = ws.getRow(rowNum);
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    row.getCell(col).value = col >= 5 && col <= 21 ? 0 : '';
  }
}

function writeEmployeeRow(ws: ExcelJS.Worksheet, rowNum: number, row: KdaPayrollReportRow) {
  const excelRow = ws.getRow(rowNum);
  excelRow.getCell(1).value = row.sn;
  excelRow.getCell(2).value = row.empCode;
  excelRow.getCell(3).value = row.nameArabicEnglish;
  excelRow.getCell(4).value = row.joinDate;
  excelRow.getCell(5).value = numericOrZero(row.basicSalaryKwd);
  excelRow.getCell(6).value = numericOrZero(row.actualWorkingDays);
  excelRow.getCell(7).value = numericOrZero(row.paidLeaveDays);
  excelRow.getCell(8).value = numericOrZero(row.salaryKwd);
  excelRow.getCell(9).value = numericOrZero(row.paidLeaveKwd);
  excelRow.getCell(10).value = numericOrZero(row.overTimeKwd);
  excelRow.getCell(11).value = numericOrZero(row.housingAllowanceKwd);
  excelRow.getCell(12).value = numericOrZero(row.otherKwd);
  excelRow.getCell(13).value = numericOrZero(row.totalGrossKwd);
  excelRow.getCell(14).value = numericOrZero(row.penaltiesKwd);
  excelRow.getCell(15).value = numericOrZero(row.deductionsKwd);
  excelRow.getCell(16).value = numericOrZero(row.loanKwd);
  excelRow.getCell(17).value = numericOrZero(row.deductionsOtherKwd);
  excelRow.getCell(18).value = numericOrZero(row.netSalaryKwd);
  excelRow.getCell(19).value = numericOrZero(row.amountScheduledToPay);
  excelRow.getCell(20).value = row.methodOfPayment || '';
  excelRow.getCell(21).value = numericOrZero(row.salaryRefund);
  excelRow.getCell(22).value = row.notes || '';
}

function ensureFooterRow(ws: ExcelJS.Worksheet, rowCount: number): number {
  let footerRow = FOOTER_ROW;
  if (rowCount <= TEMPLATE_DATA_SLOTS) {
    return footerRow;
  }

  const extraRows = rowCount - TEMPLATE_DATA_SLOTS;
  ws.spliceRows(footerRow, 0, ...Array.from({ length: extraRows }, () => []));
  footerRow += extraRows;

  for (let i = 0; i < extraRows; i++) {
    applyRowStyleFromTemplate(ws, LAST_DATA_ROW + 1 + i, DATA_START_ROW);
  }

  return footerRow;
}

/**
 * Build an Excel workbook from the official payroll template (BEC or DYLX),
 * preserving merged headers, colours, borders, and column layout.
 */
export async function buildPayrollExcelWorkbook(
  options: PayrollExcelExportOptions
): Promise<ExcelJS.Workbook> {
  const kind =
    options.templateKind ??
    detectPayrollTemplate(options.companyName, options.companyNameArabic);
  const config = PAYROLL_TEMPLATE_CONFIG[kind];

  const response = await fetch(config.file);
  if (!response.ok) {
    throw new Error(`Failed to load payroll template (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const header = new Uint8Array(buffer, 0, 2);
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error('Payroll template file is invalid or missing. Please refresh and try again.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const ws = workbook.getWorksheet(config.sheet);
  if (!ws) {
    throw new Error(`Template sheet not found: ${config.sheet}`);
  }

  const companyTitle = formatCompanyTitle(
    kind,
    options.companyName,
    options.companyNameArabic
  );
  ws.getRow(1).getCell(1).value = companyTitle;
  ws.getRow(2).getCell(1).value = options.periodLabel;
  ws.getRow(3).getCell(1).value = options.departmentLabel;

  const footerRow = ensureFooterRow(ws, options.rows.length);

  options.rows.forEach((row, index) => {
    writeEmployeeRow(ws, DATA_START_ROW + index, row);
  });

  const firstUnusedRow = DATA_START_ROW + options.rows.length;
  for (let rowNum = firstUnusedRow; rowNum < footerRow; rowNum++) {
    clearDataRow(ws, rowNum);
  }

  const footer = ws.getRow(footerRow);
  footer.getCell(3).value = 'Prepared by:';
  footer.getCell(8).value = 'Checked by:';
  footer.getCell(19).value = 'Approved by:';

  applyColumnWidths(ws);

  workbook.worksheets
    .filter((sheet) => sheet.name !== config.sheet)
    .forEach((sheet) => workbook.removeWorksheet(sheet.id));

  return workbook;
}

/**
 * Trigger download of a styled payroll Excel file matching docs templates.
 */
export async function downloadPayrollExcel(
  options: PayrollExcelExportOptions,
  filename: string
): Promise<void> {
  const workbook = await buildPayrollExcelWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
