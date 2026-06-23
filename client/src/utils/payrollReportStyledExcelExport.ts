import ExcelJS from 'exceljs';
import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import {
  PAYROLL_TABLE_COLUMNS,
  cellValue,
  computePayrollTotals,
  type PayrollReportExportMeta
} from './payrollReportTableColumns';

const COL_COUNT = PAYROLL_TABLE_COLUMNS.length;
const KWD_NUM_FMT = '#,##0.000_);[Red](#,##0.000)';

const MONEY_COL_INDEXES = new Set(
  PAYROLL_TABLE_COLUMNS.map((c, i) => i).filter((i) => PAYROLL_TABLE_COLUMNS[i].align === 'right' && PAYROLL_TABLE_COLUMNS[i].key !== 'sn')
);

const COLUMN_WIDTHS = [6.5, 14, 42, 14, 16, 12, 12, 14, 14, 12, 12, 10, 12, 12, 12, 10, 10, 16, 18, 20, 14, 28];

const FILL_HEADER = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } };
const FILL_TITLE_BAR = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF294172' } };
const FILL_META_BAR = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8EEF7' } };
const FILL_META_BAR_LIGHT = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF4F7FB' } };
const FILL_GROUP = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF2CC' } };
const FILL_REFUND = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFDE68A' } };
const FILL_ALT = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF4F4F5' } };
const FILL_FOOTER = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE6ECF5' } };

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
  left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
  bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
  right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
};

function colLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function styleCell(
  cell: ExcelJS.Cell,
  opts: {
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    fill?: ExcelJS.Fill;
    numFmt?: string;
    border?: boolean;
  }
) {
  cell.font = { name: 'Calibri', size: 10, bold: opts.bold };
  cell.alignment = {
    vertical: 'middle',
    horizontal: opts.align ?? 'left',
    wrapText: true
  };
  if (opts.fill) cell.fill = opts.fill;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  if (opts.border !== false) cell.border = THIN_BORDER;
}

function styleBannerRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  lastCol: string,
  value: string,
  opts: {
    fontSize: number;
    bold?: boolean;
    fontColor?: string;
    fill: ExcelJS.Fill;
    align?: 'left' | 'center' | 'right';
    height: number;
    topBorder?: 'medium' | 'thin';
    bottomBorder?: 'medium' | 'thin';
  }
) {
  ws.mergeCells(`A${rowNum}:${lastCol}${rowNum}`);
  const cell = ws.getCell(`A${rowNum}`);
  cell.value = value;
  cell.font = {
    name: 'Calibri',
    size: opts.fontSize,
    bold: opts.bold ?? false,
    color: opts.fontColor ? { argb: opts.fontColor } : undefined
  };
  cell.alignment = { vertical: 'middle', horizontal: opts.align ?? 'center', wrapText: true };
  cell.fill = opts.fill;
  const edge = { argb: 'FF294172' };
  const line = { argb: 'FF9CA3AF' };
  cell.border = {
    top: opts.topBorder ? { style: opts.topBorder, color: edge } : undefined,
    bottom: opts.bottomBorder ? { style: opts.bottomBorder, color: opts.bottomBorder === 'medium' ? edge : line } : undefined,
    left: { style: 'thin', color: edge },
    right: { style: 'thin', color: edge }
  };
  ws.getRow(rowNum).height = opts.height;
}

function formatDepartmentBanner(departmentLabel: string): string {
  const dept = departmentLabel.replace(/^Department\s*\/\s*/i, '').trim();
  if (!dept || departmentLabel.toLowerCase().includes('all')) {
    return 'القسم / Department · جميع الأقسام / All Departments';
  }
  return `القسم / Department · ${dept}`;
}

export async function buildPayrollStyledWorkbook(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[]
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NZSuite HR';
  const ws = wb.addWorksheet('Payroll', {
    views: [{ state: 'frozen', ySplit: 6, xSplit: 0 }]
  });

  COLUMN_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const lastCol = colLetter(COL_COUNT);
  const companyLine = [meta.companyNameArabic, meta.companyName].filter(Boolean).join('  —  ');

  styleBannerRow(ws, 1, lastCol, companyLine, {
    fontSize: 16,
    bold: true,
    fontColor: 'FFFFFFFF',
    fill: FILL_TITLE_BAR,
    align: 'center',
    height: 38,
    topBorder: 'medium',
    bottomBorder: 'thin'
  });

  styleBannerRow(ws, 2, lastCol, meta.periodLabel, {
    fontSize: 13,
    bold: true,
    fontColor: 'FF1E3A5F',
    fill: FILL_META_BAR,
    align: 'center',
    height: 28,
    bottomBorder: 'thin'
  });

  styleBannerRow(ws, 3, lastCol, formatDepartmentBanner(meta.departmentLabel), {
    fontSize: 11,
    fontColor: 'FF334155',
    fill: FILL_META_BAR_LIGHT,
    align: 'center',
    height: 24,
    bottomBorder: 'medium'
  });

  ws.getRow(4).height = 8;

  const h1 = 5;
  const h2 = 6;
  ws.getRow(h1).height = 36;
  ws.getRow(h2).height = 36;

  const headerRow1 = [
    { en: 'S/N', ar: 'م', rowspan: 2 },
    { en: 'Emp. Code', ar: 'كود', rowspan: 2 },
    { en: 'Name / Arabic', ar: 'الاسم / عربي', rowspan: 2 },
    { en: 'Join Date', ar: 'تاريخ التعيين', rowspan: 2 },
    { en: 'Basic Salary KWD', ar: 'الراتب الأساسي', rowspan: 2, align: 'right' as const },
    { en: 'Actual Working Days', ar: 'أيام العمل الفعلية', rowspan: 2, align: 'center' as const },
    { en: 'Paid leave Days', ar: 'اجازات مدفوعة', rowspan: 2, align: 'center' as const },
    { en: 'Gross Accrual Month', ar: 'استحقاق الإجمالي للشهر', colspan: 6, group: true },
    { en: 'Deductions', ar: 'الخصومات', colspan: 4, group: true },
    { en: 'Net Salary KWD', ar: 'صافي الراتب', rowspan: 2, align: 'right' as const },
    { en: 'The amount scheduled to pay', ar: '', rowspan: 2, align: 'right' as const },
    { en: 'Method of payment', ar: '', rowspan: 2 },
    { en: 'SALARY REFUND', ar: '', rowspan: 2, align: 'right' as const, refund: true },
    { en: 'Notes', ar: 'ملاحظات', rowspan: 2 }
  ];

  let col = 1;
  for (const h of headerRow1) {
    const startCol = col;
    const endCol = h.colspan ? col + h.colspan - 1 : col;
    const endRow = h.rowspan === 2 ? h2 : h1;
    const start = `${colLetter(startCol)}${h1}`;
    const end = `${colLetter(endCol)}${endRow}`;
    if (start !== end) ws.mergeCells(`${start}:${end}`);
    const cell = ws.getCell(start);
    cell.value = h.ar ? `${h.en}\n${h.ar}` : h.en;
    styleCell(cell, {
      bold: true,
      align: h.align ?? 'center',
      fill: h.refund ? FILL_REFUND : h.group ? FILL_GROUP : FILL_HEADER
    });
    col = endCol + 1;
  }

  const subHeaders = [
    { en: 'Salary KWD', ar: 'الراتب د.ك' },
    { en: 'Paid Leave KWD', ar: 'اجازات مدفوعة د.ك' },
    { en: 'Over Time KWD', ar: 'إضافي د.ك' },
    { en: 'housing allowance KWD', ar: 'بدل سكن د.ك' },
    { en: 'Other', ar: 'أخرى' },
    { en: 'Total', ar: 'الإجمالي' },
    { en: 'Penalties', ar: 'جزاءات' },
    { en: 'Deductions', ar: 'خصومات' },
    { en: 'Loan', ar: 'سلف' },
    { en: 'Other', ar: 'أخرى' }
  ];
  subHeaders.forEach((label, i) => {
    const c = ws.getCell(h2, 8 + i);
    c.value = `${label.en}\n${label.ar}`;
    styleCell(c, {
      bold: true,
      align: 'center',
      fill: FILL_GROUP
    });
  });

  let dataRow = 7;
  rows.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(dataRow);
    excelRow.height = 22;
    PAYROLL_TABLE_COLUMNS.forEach((colDef, ci) => {
      const cell = excelRow.getCell(ci + 1);
      const raw = cellValue(row, colDef);
      const isMoney =
        MONEY_COL_INDEXES.has(ci) &&
        colDef.key !== 'actualWorkingDays' &&
        colDef.key !== 'paidLeaveDays' &&
        colDef.key !== 'sn';
      if (isMoney && typeof raw === 'string' && raw !== '') {
        cell.value = parseFloat(raw);
        styleCell(cell, {
          align: 'right',
          fill: rowIdx % 2 === 1 ? FILL_ALT : undefined,
          numFmt: KWD_NUM_FMT,
          border: true
        });
      } else if (colDef.key === 'actualWorkingDays' || colDef.key === 'paidLeaveDays' || colDef.key === 'sn') {
        cell.value = typeof raw === 'number' ? raw : parseInt(String(raw), 10) || 0;
        styleCell(cell, {
          align: 'center',
          fill: rowIdx % 2 === 1 ? FILL_ALT : undefined
        });
      } else {
        cell.value = raw;
        styleCell(cell, {
          align: colDef.align ?? 'left',
          fill:
            colDef.key === 'salaryRefund'
              ? FILL_REFUND
              : rowIdx % 2 === 1
                ? FILL_ALT
                : undefined
        });
      }
    });
    dataRow++;
  });

  const t = computePayrollTotals(rows);
  const footRow = ws.getRow(dataRow);
  footRow.height = 24;
  PAYROLL_TABLE_COLUMNS.forEach((colDef, ci) => {
    const cell = footRow.getCell(ci + 1);
    let val: string | number = '';
    if (ci === 2) val = 'TOTAL';
    else if (colDef.key === 'totalGrossKwd') val = t.totalGross;
    else if (colDef.key === 'netSalaryKwd') val = t.totalNet;
    else if (colDef.key === 'amountScheduledToPay') val = t.totalScheduled;
    else if (colDef.key === 'salaryRefund') val = t.totalRefund;

    const isMoney = typeof val === 'number';
    cell.value = val;
    styleCell(cell, {
      bold: true,
      align: ci === 2 ? 'left' : isMoney ? 'right' : 'center',
      fill: colDef.key === 'salaryRefund' ? FILL_REFUND : FILL_FOOTER,
      numFmt: isMoney ? KWD_NUM_FMT : undefined
    });
  });

  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9
  };

  return wb;
}

export async function buildPayrollStyledExcelBuffer(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[]
): Promise<ArrayBuffer> {
  const wb = await buildPayrollStyledWorkbook(meta, rows);
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export async function downloadPayrollStyledTable(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[],
  filename: string
): Promise<void> {
  const buffer = await buildPayrollStyledExcelBuffer(meta, rows);
  const name = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.csv$/i, '')}.xlsx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
