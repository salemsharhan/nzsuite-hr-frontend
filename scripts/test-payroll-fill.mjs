import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

async function testFill() {
  const file = 'docs/Payroll-BEC -June  2026.xlsx';
  const sheetName = 'BEC (1-2026)';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));
  const ws = wb.getWorksheet(sheetName);

  console.log('rowCount', ws.rowCount);
  for (let r = 1; r <= ws.rowCount; r++) {
    const c1 = ws.getRow(r).getCell(1).value;
    const c3 = ws.getRow(r).getCell(3).value;
    if (c1 || c3) console.log(`R${r}:`, c1, '|', c3);
  }

  // try fill
  ws.getRow(1).getCell(1).value = 'Test Company';
  ws.getRow(2).getCell(1).value = 'June 2026 Payroll Report';
  ws.getRow(3).getCell(1).value = 'Department / HR';

  const styleRow = ws.getRow(6);
  const dataStart = 6;
  const employees = [
    { sn: 1, code: 'BEC-001', name: 'Test Employee', join: '1.1.2020', basic: 500, days: 26, leave: 0 },
    { sn: 2, code: 'BEC-002', name: 'Another', join: '2.2.2021', basic: 600, days: 24, leave: 2 },
  ];

  // clear old data rows 6..32 (before footer)
  for (let r = dataStart + employees.length; r <= 32; r++) {
    ws.getRow(r).values = [];
  }

  employees.forEach((emp, i) => {
    const rowNum = dataStart + i;
    const row = ws.getRow(rowNum);
    if (i > 0) {
      // copy style from row 6
      for (let c = 1; c <= 22; c++) {
        const src = styleRow.getCell(c);
        const dst = row.getCell(c);
        dst.style = JSON.parse(JSON.stringify(src.style));
      }
    }
    row.getCell(1).value = emp.sn;
    row.getCell(2).value = emp.code;
    row.getCell(3).value = emp.name;
    row.getCell(4).value = emp.join;
    row.getCell(5).value = emp.basic;
    row.getCell(6).value = emp.days;
    row.getCell(7).value = emp.leave;
    const salary = (emp.basic / 26) * emp.days;
    const paidLeave = (emp.basic / 26) * emp.leave;
    row.getCell(8).value = salary;
    row.getCell(9).value = paidLeave;
    row.getCell(10).value = 0;
    row.getCell(11).value = 0;
    row.getCell(12).value = 0;
    row.getCell(13).value = salary + paidLeave;
    row.getCell(14).value = 0;
    row.getCell(15).value = 0;
    row.getCell(16).value = 0;
    row.getCell(17).value = 0;
    row.getCell(18).value = salary + paidLeave;
    row.getCell(19).value = salary + paidLeave;
    row.getCell(20).value = 'Bank transfer';
    row.getCell(21).value = 0;
    row.getCell(22).value = '';
  });

  const footerRow = dataStart + employees.length + 2;
  ws.getRow(footerRow).getCell(3).value = 'Prepared by:';
  ws.getRow(footerRow).getCell(8).value = 'Checked by:';
  ws.getRow(footerRow).getCell(19).value = 'Approved by:';

  // remove other sheets
  wb.worksheets.slice().forEach((s) => {
    if (s.name !== sheetName) wb.removeWorksheet(s.id);
  });

  const out = path.resolve('docs/test-export.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('Wrote', out);
}

testFill();
