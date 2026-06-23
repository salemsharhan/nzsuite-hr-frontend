import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const DATA_START_ROW = 6;
const LAST_DATA_ROW = 32;
const FOOTER_ROW = 33;
const COLUMN_COUNT = 22;
const TEMPLATE_DATA_SLOTS = LAST_DATA_ROW - DATA_START_ROW + 1;

function clearDataRow(ws, rowNum) {
  const row = ws.getRow(rowNum);
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    row.getCell(col).value = col >= 5 && col <= 21 ? 0 : '';
  }
}

function writeEmployeeRow(ws, rowNum, sn) {
  const row = ws.getRow(rowNum);
  row.getCell(1).value = sn;
  row.getCell(3).value = `Employee ${sn}`;
  row.getCell(5).value = 500;
  row.getCell(6).value = 26;
  for (let col = 8; col <= 17; col++) row.getCell(col).value = 0;
  row.getCell(13).value = 500;
  row.getCell(18).value = 500;
  row.getCell(19).value = 500;
}

function ensureFooterRow(ws, rowCount) {
  let footerRow = FOOTER_ROW;
  if (rowCount <= TEMPLATE_DATA_SLOTS) return footerRow;
  const extraRows = rowCount - TEMPLATE_DATA_SLOTS;
  ws.spliceRows(footerRow, 0, ...Array.from({ length: extraRows }, () => []));
  footerRow += extraRows;
  const styleRow = ws.getRow(DATA_START_ROW);
  for (let i = 0; i < extraRows; i++) {
    const targetRow = ws.getRow(LAST_DATA_ROW + 1 + i);
    for (let col = 1; col <= COLUMN_COUNT; col++) {
      targetRow.getCell(col).style = styleRow.getCell(col).style;
    }
  }
  return footerRow;
}

async function exportAndValidate(rowCount) {
  const file = path.join(root, 'client/src/assets/payroll-templates/Payroll-BEC-June-2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet('BEC (1-2026)');

  ws.getRow(1).getCell(1).value = 'Test Co';
  ws.getRow(2).getCell(1).value = 'June 2026 Payroll Report';

  const footerRow = ensureFooterRow(ws, rowCount);
  for (let i = 0; i < rowCount; i++) writeEmployeeRow(ws, DATA_START_ROW + i, i + 1);
  for (let r = DATA_START_ROW + rowCount; r < footerRow; r++) clearDataRow(ws, r);

  ws.getRow(footerRow).getCell(3).value = 'Prepared by:';
  wb.worksheets.filter((s) => s.name !== 'BEC (1-2026)').forEach((s) => wb.removeWorksheet(s.id));

  const out = path.join(root, `docs/test-export-${rowCount}.xlsx`);
  await wb.xlsx.writeFile(out);

  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(out);
  console.log(`rows=${rowCount} footer=${footerRow} ok sheets=${wb2.worksheets.length}`);
}

for (const count of [3, 10, 27, 35]) {
  await exportAndValidate(count);
}
