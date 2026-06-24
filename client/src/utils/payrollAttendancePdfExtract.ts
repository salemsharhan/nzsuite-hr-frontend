import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Extract plain text from a single attendance PDF (all pages).
 */
export async function extractTextFromAttendancePdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    let pageText = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      pageText += item.str;
      if ('hasEOL' in item && item.hasEOL) {
        pageText += '\n';
      } else {
        pageText += ' ';
      }
    }
    pageTexts.push(pageText);
  }

  return normalizePdfExtractedText(pageTexts.join('\n'));
}

/** Collapse PDF column gaps and join lines that were split mid-record. */
function normalizePdfExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Extract and combine text from multiple attendance PDF files.
 */
export async function extractAttendanceTextFromPdfs(files: File[]): Promise<string> {
  const chunks: string[] = [];
  for (const file of files) {
    const text = await extractTextFromAttendancePdf(file);
    if (text.trim()) chunks.push(text);
  }
  return chunks.join('\n');
}
