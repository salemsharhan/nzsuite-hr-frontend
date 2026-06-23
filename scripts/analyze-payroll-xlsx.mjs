import ExcelJS from 'exceljs';
import path from 'path';

const files = [
  'docs/Payroll-BEC -June  2026.xlsx',
  'docs/Payroll-DYLX - June 2026.xlsx',
];

function argbToHex(argb) {
  if (!argb) return null;
  const s = String(argb).replace(/^FF/i, '');
  return s.length === 6 ? `#${s}` : `#${s.slice(-6)}`;
}

async function analyze(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));
  console.log(`\n========== ${file} ==========`);
  console.log('Sheets:', wb.worksheets.map((s) => s.name));

  for (const ws of wb.worksheets) {
    console.log(`\n--- Sheet: ${ws.name} ---`);
    console.log('Dimensions:', ws.dimensions);
    console.log('Merges:', ws.model?.merges?.slice(0, 30));

    const maxRow = Math.min(ws.rowCount || 50, 50);
    const maxCol = Math.min(ws.columnCount || 30, 30);

    for (let r = 1; r <= maxRow; r++) {
      const row = ws.getRow(r);
      const cells = [];
      for (let c = 1; c <= maxCol; c++) {
        const cell = row.getCell(c);
        if (cell.value == null || cell.value === '') continue;
        let val = cell.value;
        if (typeof val === 'object' && val.richText) {
          val = val.richText.map((t) => t.text).join('');
        } else if (typeof val === 'object' && val.formula) {
          val = `=${val.formula}`;
        } else if (typeof val === 'object' && val.result !== undefined) {
          val = val.result;
        }
        const fill = cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb;
        const font = cell.font;
        cells.push({
          col: c,
          val: String(val).replace(/\n/g, ' | ').slice(0, 80),
          fill: argbToHex(fill),
          bold: font?.bold,
          color: argbToHex(font?.color?.argb),
        });
      }
      if (cells.length) {
        console.log(`R${r}:`, JSON.stringify(cells));
      }
    }

    // column widths
    const widths = [];
    for (let c = 1; c <= maxCol; c++) {
      const col = ws.getColumn(c);
      if (col.width) widths.push({ c, w: col.width });
    }
    if (widths.length) console.log('Col widths:', widths.slice(0, 30));

    // sample header row colors (rows 1-10)
    for (let r = 1; r <= 12; r++) {
      const fills = [];
      for (let c = 1; c <= 25; c++) {
        const cell = ws.getRow(r).getCell(c);
        const fill = cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb;
        if (fill) fills.push({ c, fill: argbToHex(fill) });
      }
      if (fills.length) console.log(`Row ${r} fills:`, fills);
    }
  }
}

for (const f of files) {
  await analyze(f);
}
