import type ExcelJS from 'exceljs';

function isRichTextValue(v: unknown): boolean {
  return (
    v != null &&
    typeof v === 'object' &&
    'richText' in v &&
    Array.isArray((v as { richText?: unknown }).richText)
  );
}

function isFormulaValue(v: unknown): boolean {
  return (
    v != null &&
    typeof v === 'object' &&
    !(v instanceof Date) &&
    !isRichTextValue(v) &&
    ('formula' in v || 'sharedFormula' in v)
  );
}

function formulaResultAsPlain(v: object, fallback: ExcelJS.CellValue): ExcelJS.CellValue {
  const result = (v as { result?: unknown }).result;
  if (typeof result === 'number') return result;
  if (typeof result === 'string') return result;
  if (result instanceof Date) return result;
  if (result != null && result !== '') return result as ExcelJS.CellValue;
  return fallback;
}

function clearCellFormulaModel(cell: ExcelJS.Cell): void {
  const model = (cell as { model?: Record<string, unknown> }).model;
  if (!model) return;
  delete model.formula;
  delete model.sharedFormula;
  delete model.shareType;
  delete model.ref;
  delete model.si;
  delete model.result;
}

/** Set a literal cell value and remove any formula metadata from the cell model. */
export function setPlainCellValue(cell: ExcelJS.Cell, value: ExcelJS.CellValue): void {
  if (isFormulaValue(cell.value)) {
    cell.value = null;
    clearCellFormulaModel(cell);
  }
  cell.value = value;
}

function purgeCellFormula(cell: ExcelJS.Cell, fallback: ExcelJS.CellValue = ''): void {
  const v = cell.value;
  if (!isFormulaValue(v)) return;
  const plain = formulaResultAsPlain(v as object, fallback);
  cell.value = null;
  clearCellFormulaModel(cell);
  cell.value = plain;
}

/**
 * Remove every formula / shared-formula cell on the sheet (required before writeBuffer).
 * spliceRows and template edits often leave orphan sharedFormula clones (e.g. I48).
 */
export function purgeWorksheetFormulas(
  ws: ExcelJS.Worksheet,
  options?: { minRow?: number; maxRow?: number; maxCol?: number }
): void {
  const minRow = options?.minRow ?? 1;
  const maxRow = options?.maxRow ?? Math.max(ws.rowCount, minRow);
  const maxCol = options?.maxCol ?? 30;

  for (let r = minRow; r <= maxRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= maxCol; c++) {
      purgeCellFormula(row.getCell(c));
    }
  }
}

/** @deprecated use purgeWorksheetFormulas */
export function materializeWorksheetFormulas(
  ws: ExcelJS.Worksheet,
  options?: { minRow?: number; maxRow?: number; maxCol?: number }
): void {
  purgeWorksheetFormulas(ws, options);
}
