import ExcelJS from 'exceljs';
import type { KdaPayrollReportRow } from '../services/payrollReportService';
import {
  materializeWorksheetFormulas,
  purgeWorksheetFormulas,
  setPlainCellValue
} from './payrollExcelFormulaUtils';
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

const KWD_NUM_FMT = '#,##0.000_);[Red](#,##0.000)';
const DATA_ROW_HEIGHT = 24;
const HEADER_ROW_HEIGHTS: Record<number, number> = { 4: 32, 5: 52 };

/** Column widths (Excel character units) — tuned so KWD amounts and headers are not clipped. */
const PAYROLL_COLUMN_WIDTHS: Record<number, number> = {
  1: 6.5,
  2: 17.69,
  3: 45.3,
  4: 16.69,
  5: 18.38,
  6: 13.5,
  7: 13.5,
  8: 24,
  9: 20,
  10: 14.54,
  11: 14,
  12: 14.3,
  13: 22,
  14: 17.3,
  15: 14.38,
  16: 15.3,
  17: 14.69,
  18: 24,
  19: 24,
  20: 28,
  21: 22,
  22: 36.29
};

const MONEY_COLUMNS = new Set([5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21]);

export interface PayrollExcelExportOptions {
  companyName: string;
  companyNameArabic: string;
  periodLabel: string;
  departmentLabel: string;
  rows: KdaPayrollReportRow[];
  templateKind?: PayrollTemplateKind;
}

function numericOrZero(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function applyColumnWidths(ws: ExcelJS.Worksheet) {
  for (const [col, width] of Object.entries(PAYROLL_COLUMN_WIDTHS)) {
    ws.getColumn(Number(col)).width = width;
  }
}

function applyHeaderLayout(ws: ExcelJS.Worksheet) {
  for (const [rowNum, height] of Object.entries(HEADER_ROW_HEIGHTS)) {
    ws.getRow(Number(rowNum)).height = height;
  }
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    for (const rowNum of [4, 5]) {
      const cell = ws.getRow(rowNum).getCell(col);
      cell.alignment = {
        ...(cell.alignment ?? {}),
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };
    }
  }
}

function cloneCellStyle(style: Partial<ExcelJS.Style> | undefined): Partial<ExcelJS.Style> {
  if (!style) return {};
  try {
    return JSON.parse(JSON.stringify(style)) as Partial<ExcelJS.Style>;
  } catch {
    return { ...style };
  }
}

function copyRowStyleFromTemplate(
  ws: ExcelJS.Worksheet,
  targetRowNum: number,
  templateRowNum: number
) {
  const templateRow = ws.getRow(templateRowNum);
  const targetRow = ws.getRow(targetRowNum);
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    targetRow.getCell(col).style = cloneCellStyle(templateRow.getCell(col).style);
  }
}

function formatDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
  const row = ws.getRow(rowNum);
  row.height = DATA_ROW_HEIGHT;
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    const cell = row.getCell(col);
    if (MONEY_COLUMNS.has(col)) {
      cell.numFmt = KWD_NUM_FMT;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    } else if (col === 3) {
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    } else if (col === 20) {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    } else if (col === 22) {
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    }
  }
}

/** Copy row formatting from the template sample row (direct ref — safe for theme colours). */
function applyRowStyleFromTemplate(
  ws: ExcelJS.Worksheet,
  targetRowNum: number,
  templateRowNum: number
) {
  copyRowStyleFromTemplate(ws, targetRowNum, templateRowNum);
  formatDataRow(ws, targetRowNum);
}

/**
 * Clear a data row with explicit values.
 * Using null breaks shared formulas left in the template and corrupts the file.
 */
function clearDataRow(ws: ExcelJS.Worksheet, rowNum: number) {
  const row = ws.getRow(rowNum);
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    setPlainCellValue(row.getCell(col), col >= 5 && col <= 21 ? 0 : '');
  }
}

function writeEmployeeRow(ws: ExcelJS.Worksheet, rowNum: number, row: KdaPayrollReportRow) {
  copyRowStyleFromTemplate(ws, rowNum, DATA_START_ROW);
  const excelRow = ws.getRow(rowNum);
  setPlainCellValue(excelRow.getCell(1), row.sn);
  setPlainCellValue(excelRow.getCell(2), row.empCode);
  setPlainCellValue(excelRow.getCell(3), row.nameArabicEnglish);
  setPlainCellValue(excelRow.getCell(4), row.joinDate);
  setPlainCellValue(excelRow.getCell(5), numericOrZero(row.basicSalaryKwd));
  setPlainCellValue(excelRow.getCell(6), numericOrZero(row.actualWorkingDays));
  setPlainCellValue(excelRow.getCell(7), numericOrZero(row.paidLeaveDays));
  setPlainCellValue(excelRow.getCell(8), numericOrZero(row.salaryKwd));
  setPlainCellValue(excelRow.getCell(9), numericOrZero(row.paidLeaveKwd));
  setPlainCellValue(excelRow.getCell(10), numericOrZero(row.overTimeKwd));
  setPlainCellValue(excelRow.getCell(11), numericOrZero(row.housingAllowanceKwd));
  setPlainCellValue(excelRow.getCell(12), numericOrZero(row.otherKwd));
  setPlainCellValue(excelRow.getCell(13), numericOrZero(row.totalGrossKwd));
  setPlainCellValue(excelRow.getCell(14), numericOrZero(row.penaltiesKwd));
  setPlainCellValue(excelRow.getCell(15), numericOrZero(row.deductionsKwd));
  setPlainCellValue(excelRow.getCell(16), numericOrZero(row.loanKwd));
  setPlainCellValue(excelRow.getCell(17), numericOrZero(row.deductionsOtherKwd));
  setPlainCellValue(excelRow.getCell(18), numericOrZero(row.netSalaryKwd));
  setPlainCellValue(excelRow.getCell(19), numericOrZero(row.amountScheduledToPay));
  setPlainCellValue(excelRow.getCell(20), row.methodOfPayment || 'Bank transfer');
  setPlainCellValue(excelRow.getCell(21), numericOrZero(row.salaryRefund));
  setPlainCellValue(excelRow.getCell(22), row.notes || '');
  formatDataRow(ws, rowNum);
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
    const rowNum = LAST_DATA_ROW + 1 + i;
    clearDataRow(ws, rowNum);
    applyRowStyleFromTemplate(ws, rowNum, DATA_START_ROW);
  }

  purgeWorksheetFormulas(ws, { minRow: DATA_START_ROW, maxRow: footerRow - 1, maxCol: COLUMN_COUNT });

  return footerRow;
}

/** Drop template rows below the footer so old sample data cannot appear in the file. */
function trimWorksheetBelowFooter(ws: ExcelJS.Worksheet, footerRow: number) {
  const trailing = ws.rowCount - footerRow;
  if (trailing > 0) {
    ws.spliceRows(footerRow + 1, trailing);
  }
}

function isolateTargetWorksheet(workbook: ExcelJS.Workbook, sheetName: string): ExcelJS.Worksheet {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) {
    throw new Error(`Template sheet not found: ${sheetName}`);
  }
  const keepId = ws.id;
  workbook.worksheets
    .filter((sheet) => sheet.id !== keepId)
    .forEach((sheet) => workbook.removeWorksheet(sheet.id));
  return ws;
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

  const ws = isolateTargetWorksheet(workbook, config.sheet);

  purgeWorksheetFormulas(ws, { minRow: 1, maxRow: Math.max(ws.rowCount, FOOTER_ROW), maxCol: COLUMN_COUNT });

  applyColumnWidths(ws);
  applyHeaderLayout(ws);

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
    formatDataRow(ws, rowNum);
  }

  const footer = ws.getRow(footerRow);
  footer.height = DATA_ROW_HEIGHT;
  footer.getCell(3).value = 'Prepared by:';
  footer.getCell(8).value = 'Checked by:';
  footer.getCell(19).value = 'Approved by:';

  purgeWorksheetFormulas(ws, { minRow: 1, maxRow: footerRow, maxCol: COLUMN_COUNT });

  trimWorksheetBelowFooter(ws, footerRow);
  applyColumnWidths(ws);

  return workbook;
}

/**
 * Trigger download of a styled payroll Excel file matching docs templates.
 */
/** Build Excel bytes for upload (e.g. payroll approval attachment). */
export async function buildPayrollExcelBuffer(
  options: PayrollExcelExportOptions
): Promise<ArrayBuffer> {
  const workbook = await buildPayrollExcelWorkbook(options);
  const ws = workbook.worksheets[0];
  if (ws) {
    purgeWorksheetFormulas(ws, { minRow: 1, maxRow: ws.rowCount, maxCol: COLUMN_COUNT });
  }
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export async function downloadPayrollExcel(
  options: PayrollExcelExportOptions,
  filename: string
): Promise<void> {
  const buffer = await buildPayrollExcelBuffer(options);
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
