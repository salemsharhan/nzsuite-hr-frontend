import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import { computePayrollTotals, cellValue, PAYROLL_TABLE_COLUMNS } from './payrollReportTableColumns';
import type { PayrollReportExportMeta } from './payrollReportTableColumns';

const COL_COUNT = PAYROLL_TABLE_COLUMNS.length;

const STYLES = `
  .pr-wrap { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; background: #fff; padding: 20px 24px; box-sizing: border-box; }
  .pr-title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
  .pr-sub { font-size: 13px; color: #555; margin: 0 0 14px; }
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

export function getPayrollReportInnerHtml(meta: PayrollReportExportMeta, rows: KdaPayrollReportRow[]): string {
  const companyLine = [meta.companyNameArabic, meta.companyName].filter(Boolean).join(' — ');
  const t = computePayrollTotals(rows);

  const subHeaders = `
    <tr>
      <th class="num">Salary KWD<br/>الراتب د.ك</th>
      <th class="num">Paid Leave KWD<br/>اجازات مدفوعة د.ك</th>
      <th class="num">Over Time KWD<br/>إضافي د.ك</th>
      <th class="num">housing allowance KWD<br/>بدل سكن د.ك</th>
      <th class="num">Other<br/>أخرى</th>
      <th class="num">Total<br/>الإجمالي</th>
      <th class="num">Penalties<br/>جزاءات</th>
      <th class="num">Deductions<br/>خصومات</th>
      <th class="num">Loan<br/>سلف</th>
      <th class="num">Other<br/>أخرى</th>
    </tr>`;

  const mainHeader = `
    <tr>
      <th rowspan="2">S/N<br/>م</th>
      <th rowspan="2">Emp. Code<br/>كود</th>
      <th rowspan="2">Name / Arabic<br/>الاسم / عربي</th>
      <th rowspan="2">Join Date<br/>تاريخ التعيين</th>
      <th rowspan="2">Basic Salary KWD<br/>الراتب الأساسي</th>
      <th rowspan="2">Actual Working Days<br/>أيام العمل الفعلية</th>
      <th rowspan="2">Paid leave Days<br/>اجازات مدفوعة</th>
      <th colspan="6" class="grp-gross">Gross Accrual Month</th>
      <th colspan="4" class="grp-ded">Deductions</th>
      <th rowspan="2">Net Salary KWD<br/>صافي الراتب</th>
      <th rowspan="2">The amount scheduled to pay</th>
      <th rowspan="2">Method of payment</th>
      <th rowspan="2" class="refund-h">SALARY REFUND</th>
      <th rowspan="2">Notes<br/>ملاحظات</th>
    </tr>
    ${subHeaders}`;

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
      <p class="pr-title">${esc(companyLine)}</p>
      <p class="pr-sub">${esc(meta.periodLabel)} · ${esc(meta.departmentLabel)}</p>
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
