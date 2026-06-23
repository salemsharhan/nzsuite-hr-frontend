import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import type { PayrollReportExportMeta } from './payrollReportTableColumns';
import { downloadPayrollStyledTable, buildPayrollStyledExcelBuffer } from './payrollReportStyledExcelExport';

/**
 * Styled table export (Excel .xlsx with colours, borders, merged headers).
 * Plain CSV cannot carry formatting — this delivers the neat tabular layout users expect.
 */
export async function downloadPayrollCsv(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[],
  filename: string
): Promise<void> {
  await downloadPayrollStyledTable(meta, rows, filename);
}

export async function buildPayrollCsvBuffer(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[]
): Promise<Uint8Array> {
  const buffer = await buildPayrollStyledExcelBuffer(meta, rows);
  return new Uint8Array(buffer);
}

export function payrollCsvRowCount(rows: KdaPayrollReportRow[]): number {
  return rows.length;
}
