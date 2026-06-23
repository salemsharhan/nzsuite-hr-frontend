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

function cellText(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((t) => t.text).join('');
  if (typeof v === 'object' && v.formula) return `=${v.formula}`;
  if (typeof v === 'object' && v.result !== undefined) return String(v.result);
  return String(v);
}

async function analyze(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));
  console.log(`\n========== ${path.basename(file)} ==========`);

  for (const ws of wb.worksheets) {
    console.log(`\n--- Sheet: ${ws.name} (${ws.rowCount} rows x ${ws.columnCount} cols) ---`);
    console.log('Merges:', JSON.stringify(ws.model?.merges || []));

    // Header rows 1-5
    for (let r = 1; r <= 5; r++) {
      const parts = [];
      for (let c = 1; c <= 30; c++) {
        const cell = ws.getRow(r).getCell(c);
        const txt = cellText(cell).replace(/\n/g, ' | ').trim();
        if (!txt) continue;
        const fill = argbToHex(cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb);
        parts.push(`C${c}:${JSON.stringify(txt)}${fill ? ` bg=${fill}` : ''}`);
      }
      if (parts.length) console.log(`Row ${r}: ${parts.join(' | ')}`);
    }

    // Unique header fills rows 4-5
    const fillMap = new Map();
    for (let r = 4; r <= 5; r++) {
      for (let c = 1; c <= 30; c++) {
        const cell = ws.getRow(r).getCell(c);
        const fill = argbToHex(cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb);
        if (fill) fillMap.set(`R${r}C${c}`, fill);
      }
    }
    if (fillMap.size) console.log('Header fills:', Object.fromEntries(fillMap));

    // Sample data row 6
    const r6 = [];
    for (let c = 1; c <= 30; c++) {
      const cell = ws.getRow(6).getCell(c);
      const txt = cellText(cell).trim();
      if (!txt) continue;
      const fill = argbToHex(cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb);
      r6.push(`C${c}:${txt}${fill ? ` bg=${fill}` : ''}`);
    }
    if (r6.length) console.log('Row 6 sample:', r6.join(' | '));

    // Totals row - find last row with SUM
    for (let r = ws.rowCount; r >= Math.max(1, ws.rowCount - 5); r--) {
      const parts = [];
      for (let c = 1; c <= 30; c++) {
        const cell = ws.getRow(r).getCell(c);
        const txt = cellText(cell).trim();
        if (!txt) continue;
        const fill = argbToHex(cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb);
        parts.push(`C${c}:${txt}${fill ? ` bg=${fill}` : ''}`);
      }
      if (parts.length) {
        console.log(`Row ${r} (tail):`, parts.join(' | '));
        break;
      }
    }
  }
}

for (const f of files) await analyze(f);
