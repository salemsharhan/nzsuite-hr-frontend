import ExcelJS from 'exceljs';
import path from 'path';

function argbToHex(argb) {
  if (!argb) return null;
  const s = String(argb).replace(/^FF/i, '');
  return s.length === 6 ? `#${s}` : `#${s.slice(-6)}`;
}

function getFill(cell) {
  return argbToHex(cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb);
}

async function styleSheet(file, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));
  const ws = wb.getWorksheet(sheetName);
  if (!ws) {
    console.log('Sheet not found:', sheetName);
    return;
  }
  console.log(`\n=== ${path.basename(file)} / ${sheetName} ===`);

  for (let r = 1; r <= 8; r++) {
    const row = ws.getRow(r);
    const info = [];
    for (let c = 1; c <= 22; c++) {
      const cell = row.getCell(c);
      const fill = getFill(cell);
      const border = cell.border;
      if (fill || border?.top?.style) {
        info.push({
          c,
          fill,
          bold: cell.font?.bold,
          align: cell.alignment?.horizontal,
          wrap: cell.alignment?.wrapText,
          borderTop: border?.top?.style,
        });
      }
    }
    if (info.length) console.log(`R${r}:`, JSON.stringify(info));
  }

  // column widths
  const widths = [];
  for (let c = 1; c <= 22; c++) {
    const col = ws.getColumn(c);
    widths.push({ c, w: col.width, hidden: col.hidden });
  }
  console.log('Widths:', widths.filter((w) => w.w));

  // row heights 1-5
  for (let r = 1; r <= 5; r++) {
    const h = ws.getRow(r).height;
    if (h) console.log(`Row ${r} height:`, h);
  }

  // sample data row colors
  const r6 = [];
  for (let c = 1; c <= 22; c++) {
    const cell = ws.getRow(6).getCell(c);
    const fill = getFill(cell);
    if (fill) r6.push({ c, fill });
  }
  if (r6.length) console.log('R6 fills:', r6);

  // find total row
  for (let r = ws.rowCount; r >= 1; r--) {
    const v = ws.getRow(r).getCell(1).value;
    if (String(v).toLowerCase() === 'total') {
      const fills = [];
      for (let c = 1; c <= 22; c++) {
        const fill = getFill(ws.getRow(r).getCell(c));
        if (fill) fills.push({ c, fill });
      }
      console.log(`Total row ${r} fills:`, fills);
      break;
    }
  }
}

await styleSheet('docs/Payroll-BEC -June  2026.xlsx', 'BEC (1-2026)');
await styleSheet('docs/Payroll-DYLX - June 2026.xlsx', 'DYLX (6-2025)');
