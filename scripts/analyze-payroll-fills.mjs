import ExcelJS from 'exceljs';
import path from 'path';

function describeFill(cell) {
  const fill = cell.fill;
  if (!fill || fill.type === 'pattern' && !fill.fgColor && !fill.bgColor) return null;
  return fill;
}

async function deepStyle(file, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));
  const ws = wb.getWorksheet(sheetName);
  console.log(`\n=== ${sheetName} ===`);

  for (let r = 4; r <= 5; r++) {
    for (let c = 1; c <= 22; c++) {
      const cell = ws.getRow(r).getCell(c);
      const fill = describeFill(cell);
      const val = String(cell.value || '').slice(0, 30);
      if (fill && (fill.fgColor?.argb || fill.bgColor?.argb || fill.pattern)) {
        console.log(`R${r}C${c} "${val}"`, JSON.stringify(fill));
      }
    }
  }

  // check row 12 green highlight from older sheet
  for (let r = 6; r <= 10; r++) {
    const fills = [];
    for (let c = 1; c <= 22; c++) {
      const fill = describeFill(ws.getRow(r).getCell(c));
      if (fill?.fgColor?.argb || fill?.bgColor?.argb) {
        fills.push({ c, fill });
      }
    }
    if (fills.length) console.log(`R${r} data fills:`, JSON.stringify(fills));
  }

  // all unique fills in sheet
  const unique = new Map();
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      const fill = describeFill(cell);
      if (fill?.fgColor?.argb || fill?.bgColor?.argb) {
        const key = JSON.stringify(fill);
        unique.set(key, (unique.get(key) || 0) + 1);
      }
    });
  });
  console.log('Unique fills:', [...unique.entries()].map(([k, n]) => ({ n, fill: JSON.parse(k) })));
}

await deepStyle('docs/Payroll-BEC -June  2026.xlsx', 'BEC (1-2026)');
await deepStyle('docs/Payroll-DYLX - June 2026.xlsx', 'DYLX (6-2025)');
