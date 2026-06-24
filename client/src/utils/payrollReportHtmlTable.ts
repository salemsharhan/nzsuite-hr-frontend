import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import {
  computePayrollTotals,
  cellValue,
  PAYROLL_TABLE_COLUMNS,
  bilingualColumnHeader,
  getPayrollExportHeaderSections
} from './payrollReportTableColumns';
import type { PayrollReportExportMeta } from './payrollReportTableColumns';

const COL_COUNT = PAYROLL_TABLE_COLUMNS.length;

const STYLES = `
  .pr-wrap { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111111; background: #ffffff; padding: 20px 24px; box-sizing: border-box; }
  .pr-banner { border: 2px solid #294172; border-radius: 6px; overflow: hidden; margin-bottom: 14px; }
  .pr-banner-title { background: #294172; color: #ffffff; font-size: 18px; font-weight: 700; text-align: center; padding: 14px 16px; margin: 0; }
  .pr-banner-period { background: #e8eef7; color: #1e3a5f; font-size: 14px; font-weight: 700; text-align: center; padding: 10px 16px; margin: 0; border-top: 1px solid #9ca3af; }
  .pr-banner-dept { background: #f4f7fb; color: #334155; font-size: 12px; text-align: center; padding: 8px 16px; margin: 0; border-top: 1px solid #9ca3af; }
  .pr-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
  .pr-table th, .pr-table td { border: 1px solid #9ca3af; padding: 5px 6px; vertical-align: middle; word-wrap: break-word; overflow-wrap: anywhere; }
  .pr-table thead th { background: #d9e1f2; font-weight: 700; text-align: center; line-height: 1.25; }
  .pr-table .grp-gross, .pr-table .grp-ded { background: #fff2cc; }
  .pr-table .refund-h, .pr-table .refund-c { background: #fde68a; }
  .pr-table tbody tr:nth-child(even) { background: #f4f4f5; }
  .pr-table tbody tr:nth-child(odd) { background: #fff; }
  .pr-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pr-table .center { text-align: center; }
  .pr-table .left { text-align: left; }
  .pr-table .name { text-align: left; max-width: 180px; }
  .pr-table tfoot td { background: #e6ecf5; font-weight: 700; border-top: 2px solid #294172; }
  .pr-table tfoot .num { text-align: right; }
`;

function alignClass(colIdx: number): string {
  const col = PAYROLL_TABLE_COLUMNS[colIdx];
  if (col.align === 'right') return 'num';
  if (col.align === 'center') return 'center';
  if (col.key === 'nameArabicEnglish') return 'name';
  return 'left';
}

function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDepartmentBannerHtml(departmentLabel: string): string {
  const dept = departmentLabel.replace(/^Department\s*\/\s*/i, '').trim();
  if (!dept || departmentLabel.toLowerCase().includes('all')) {
    return 'القسم / Department · جميع الأقسام / All Departments';
  }
  return `القسم / Department · ${esc(dept)}`;
}

function buildExportTableHeaderHtml(): string {
  const { beforeGross, gross, deductions, afterDeductions } = getPayrollExportHeaderSections();

  const row1Parts: string[] = [];
  for (const col of beforeGross) {
    row1Parts.push(`<th rowspan="2">${bilingualColumnHeader(col)}</th>`);
  }
  row1Parts.push(
    `<th colspan="${gross.length}" class="grp-gross">Gross Accrual Month<br/>استحقاق الإجمالي للشهر</th>`
  );
  row1Parts.push(
    `<th colspan="${deductions.length}" class="grp-ded">Deductions<br/>الخصومات</th>`
  );
  for (const col of afterDeductions) {
    const cls = col.key === 'salaryRefund' ? ' refund-h' : '';
    row1Parts.push(`<th rowspan="2" class="${cls.trim()}">${bilingualColumnHeader(col)}</th>`);
  }

  const row2Parts: string[] = [];
  for (const col of gross) {
    row2Parts.push(`<th class="grp-gross">${bilingualColumnHeader(col)}</th>`);
  }
  for (const col of deductions) {
    row2Parts.push(`<th class="grp-ded">${bilingualColumnHeader(col)}</th>`);
  }

  return `<tr>${row1Parts.join('')}</tr><tr>${row2Parts.join('')}</tr>`;
}

export function getPayrollReportInnerHtml(meta: PayrollReportExportMeta, rows: KdaPayrollReportRow[]): string {
  const companyLine = [meta.companyNameArabic, meta.companyName].filter(Boolean).join('  —  ');
  const t = computePayrollTotals(rows);
  const mainHeader = buildExportTableHeaderHtml();

  const bodyRows = rows
    .map((row) => {
      const cells = PAYROLL_TABLE_COLUMNS.map((col, ci) => {
        const cls = alignClass(ci) + (col.key === 'salaryRefund' ? ' refund-c' : '');
        return `<td class="${cls}">${esc(cellValue(row, col))}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const footCells = PAYROLL_TABLE_COLUMNS.map((col, idx) => {
    if (idx === 2) return `<td class="left">TOTAL</td>`;
    if (col.key === 'totalGrossKwd') return `<td class="num">${esc(t.totalGross.toFixed(3))}</td>`;
    if (col.key === 'netSalaryKwd') return `<td class="num">${esc(t.totalNet.toFixed(3))}</td>`;
    if (col.key === 'amountScheduledToPay') return `<td class="num">${esc(t.totalScheduled.toFixed(3))}</td>`;
    if (col.key === 'salaryRefund') return `<td class="num refund-c">${esc(t.totalRefund.toFixed(3))}</td>`;
    return '<td></td>';
  }).join('');

  return `
    <style>${STYLES}</style>
    <div class="pr-wrap" style="width:${COL_COUNT * 92}px">
      <div class="pr-banner">
        <p class="pr-banner-title">${esc(companyLine)}</p>
        <p class="pr-banner-period">${esc(meta.periodLabel)}</p>
        <p class="pr-banner-dept">${formatDepartmentBannerHtml(meta.departmentLabel)}</p>
      </div>
      <table class="pr-table">
        <colgroup>
          ${PAYROLL_TABLE_COLUMNS.map((col) => {
            let w = 72;
            if (col.key === 'nameArabicEnglish') w = 160;
            else if (col.key === 'notes') w = 100;
            else if (col.key === 'methodOfPayment') w = 110;
            else if (col.align === 'right') w = 82;
            return `<col style="width:${w}px" />`;
          }).join('')}
        </colgroup>
        <thead>${mainHeader}</thead>
        <tbody>${bodyRows}</tbody>
        <tfoot><tr>${footCells}</tr></tfoot>
      </table>
    </div>`;
}

export function buildPayrollReportHtml(meta: PayrollReportExportMeta, rows: KdaPayrollReportRow[]): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>html,body{margin:0;padding:0;background:#ffffff;color:#111111;}</style></head><body style="background:#ffffff;color:#111111;">${getPayrollReportInnerHtml(meta, rows)}</body></html>`;
}

export function mountPayrollReportPrintNode(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[]
): HTMLDivElement {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-20000px;top:0;z-index:-1;pointer-events:none;background:#ffffff;color:#111111;';
  host.innerHTML = getPayrollReportInnerHtml(meta, rows);
  document.body.appendChild(host);
  return host;
}

/** Isolated iframe document — avoids Tailwind oklch() colors breaking html2canvas on the main page. */
export async function mountPayrollReportInIframe(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[]
): Promise<{
  iframe: HTMLIFrameElement;
  target: HTMLElement;
  cleanup: () => void;
}> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Payroll PDF export');
  iframe.style.cssText =
    'position:fixed;left:-20000px;top:0;border:0;width:4200px;height:16000px;background:#ffffff;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Failed to create isolated document for PDF export.');
  }

  doc.open();
  doc.write(buildPayrollReportHtml(meta, rows));
  doc.close();

  await new Promise<void>((resolve) => {
    if (doc.readyState === 'complete') {
      resolve();
      return;
    }
    iframe.addEventListener('load', () => resolve(), { once: true });
  });

  const target = doc.querySelector('.pr-wrap') as HTMLElement | null;
  if (!target) {
    document.body.removeChild(iframe);
    throw new Error('Failed to prepare payroll table for PDF export.');
  }

  return {
    iframe,
    target,
    cleanup: () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
  };
}
