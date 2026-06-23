import type { KdaPayrollReportRow } from '@/services/payrollReportService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { mountPayrollReportInIframe } from './payrollReportHtmlTable';
import type { PayrollReportExportMeta } from './payrollReportTableColumns';

const PDF_MARGIN_MM = 8;

export async function downloadPayrollPdf(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[],
  filename: string
): Promise<void> {
  const doc = await buildPayrollPdfDocument(meta, rows);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export async function buildPayrollPdfDocument(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[]
): Promise<jsPDF> {
  const { iframe, target, cleanup } = await mountPayrollReportInIframe(meta, rows);
  const iframeWindow = iframe.contentWindow;
  if (!iframeWindow) {
    cleanup();
    throw new Error('Failed to access iframe window for PDF export.');
  }

  try {
    await iframeWindow.document.fonts?.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: target.scrollWidth + 48,
      window: iframeWindow,
      foreignObjectRendering: false
    });

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - PDF_MARGIN_MM * 2;
    const contentHeight = pageHeight - PDF_MARGIN_MM * 2;
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png', 1.0);

    let offsetY = 0;
    let page = 0;
    while (offsetY < imgHeight) {
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', PDF_MARGIN_MM, PDF_MARGIN_MM - offsetY, imgWidth, imgHeight);
      offsetY += contentHeight;
      page++;
    }

    const pageCount = pdf.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(
        `Page ${p} of ${pageCount}`,
        pageWidth - PDF_MARGIN_MM,
        pageHeight - 3,
        { align: 'right' }
      );
      pdf.setTextColor(0);
    }

    return pdf;
  } finally {
    cleanup();
  }
}

export async function buildPayrollPdfBuffer(
  meta: PayrollReportExportMeta,
  rows: KdaPayrollReportRow[]
): Promise<Uint8Array> {
  const doc = await buildPayrollPdfDocument(meta, rows);
  const ab = doc.output('arraybuffer') as ArrayBuffer;
  return new Uint8Array(ab);
}
