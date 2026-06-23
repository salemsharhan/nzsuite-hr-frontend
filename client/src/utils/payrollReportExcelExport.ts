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

export interface PayrollExcelExportOptions {
  companyName: string;
  companyNameArabic: string;
  periodLabel: string;
  departmentLabel: string;
  rows: KdaPayrollReportRow[];
  templateKind?: PayrollTemplateKind;
}

function cloneStyle(style: Partial<ExcelJS.Style> | undefined): Partial<ExcelJS.Style> {
  if (!style) return {};
  return JSON.parse(JSON.stringify(style)) as Partial<ExcelJS.Style>;
}

function setCell(
  row: ExcelJS.Row,
  col: number,
  value: ExcelJS.CellValue,
  style?: Partial<ExcelJS.Style>
) {
  const cell = row.getCell(col);
  cell.value = value;
  if (style) cell.style = cloneStyle(style);
}

function numericOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function writeEmployeeRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  styleRow: ExcelJS.Row,
  row: KdaPayrollReportRow
) {
  const excelRow = ws.getRow(rowNum);
  for (let c = 1; c <= COLUMN_COUNT; c++) {
    excelRow.getCell(c).style = cloneStyle(styleRow.getCell(c).style);
  }

  setCell(excelRow, 1, row.sn);
  setCell(excelRow, 2, row.empCode);
  setCell(excelRow, 3, row.nameArabicEnglish);
  setCell(excelRow, 4, row.joinDate);
  setCell(excelRow, 5, numericOrZero(row.basicSalaryKwd));
  setCell(excelRow, 6, numericOrZero(row.actualWorkingDays));
  setCell(excelRow, 7, numericOrZero(row.paidLeaveDays));
  setCell(excelRow, 8, numericOrZero(row.salaryKwd));
  setCell(excelRow, 9, numericOrZero(row.paidLeaveKwd));
  setCell(excelRow, 10, numericOrZero(row.overTimeKwd));
  setCell(excelRow, 11, numericOrZero(row.housingAllowanceKwd));
  setCell(excelRow, 12, numericOrZero(row.otherKwd));
  setCell(excelRow, 13, numericOrZero(row.totalGrossKwd));
  setCell(excelRow, 14, numericOrZero(row.penaltiesKwd));
  setCell(excelRow, 15, numericOrZero(row.deductionsKwd));
  setCell(excelRow, 16, numericOrZero(row.loanKwd));
  setCell(excelRow, 17, numericOrZero(row.deductionsOtherKwd));
  setCell(excelRow, 18, numericOrZero(row.netSalaryKwd));
  setCell(excelRow, 19, numericOrZero(row.amountScheduledToPay));
  setCell(excelRow, 20, row.methodOfPayment || '');
  setCell(excelRow, 21, numericOrZero(row.salaryRefund));
  setCell(excelRow, 22, row.notes || '');
  excelRow.commit();
}

function clearRow(ws: ExcelJS.Worksheet, rowNum: number) {
  const row = ws.getRow(rowNum);
  for (let c = 1; c <= COLUMN_COUNT; c++) {
    row.getCell(c).value = null;
  }
  row.commit();
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
  // XLSX is a ZIP archive — must start with "PK"
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

  const styleRow = ws.getRow(DATA_START_ROW);
  options.rows.forEach((row, index) => {
    writeEmployeeRow(ws, DATA_START_ROW + index, styleRow, row);
  });

  for (let r = DATA_START_ROW + options.rows.length; r <= LAST_DATA_ROW; r++) {
    clearRow(ws, r);
  }

  const footer = ws.getRow(FOOTER_ROW);
  footer.getCell(3).value = 'Prepared by:';
  footer.getCell(8).value = 'Checked by:';
  footer.getCell(19).value = 'Approved by:';
  footer.commit();

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
