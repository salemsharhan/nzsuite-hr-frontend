import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import { buildPayrollExcelBuffer } from './payrollReportExcelExport';
import { buildPayrollStyledExcelBuffer } from './payrollReportStyledExcelExport';
import { buildPayrollPdfBuffer } from './payrollReportPdfExport';
import type { PayrollReportExportMeta } from './payrollReportTableColumns';

export type PayrollApprovalAttachmentFormat = 'excel' | 'csv' | 'pdf';

export const PAYROLL_APPROVAL_FORMAT_OPTIONS: {
  value: PayrollApprovalAttachmentFormat;
  label: string;
  description: string;
  extension: string;
  mime: string;
}[] = [
  {
    value: 'excel',
    label: 'Excel',
    description: 'BEC payroll template (.xlsx)',
    extension: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  {
    value: 'csv',
    label: 'CSV / Table',
    description: 'Styled spreadsheet with colours and merged headers (.xlsx)',
    extension: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Printable table matching the on-screen layout (.pdf)',
    extension: 'pdf',
    mime: 'application/pdf'
  }
];

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function buildPayrollApprovalAttachment(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[],
  format: PayrollApprovalAttachmentFormat,
  baseName: string
): Promise<{ base64: string; filename: string; mime: string }> {
  const option = PAYROLL_APPROVAL_FORMAT_OPTIONS.find((o) => o.value === format)!;
  const filename = `${baseName}.${option.extension}`;

  let buffer: ArrayBuffer | Uint8Array;
  switch (format) {
    case 'excel':
      buffer = await buildPayrollExcelBuffer({ ...meta, rows });
      break;
    case 'csv':
      buffer = await buildPayrollStyledExcelBuffer(meta, rows);
      break;
    case 'pdf':
      buffer = await buildPayrollPdfBuffer(meta, rows);
      break;
    default:
      throw new Error(`Unsupported attachment format: ${format}`);
  }

  return {
    base64: bufferToBase64(buffer),
    filename,
    mime: option.mime
  };
}
