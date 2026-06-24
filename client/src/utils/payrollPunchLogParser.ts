import type { Employee } from '@/services/employeeService';
import { mapMachineIdsToEmployeeUuids } from './machineEmployeeMapping';

export interface AttendancePunchEvent {
  machineId: number;
  name: string;
  dateIso: string;
  state: 'in' | 'out';
  invalid?: boolean;
}

export interface PunchLogParseResult {
  actualDaysByEmployeeId: Record<string, number>;
  matchedEmployees: number;
  unmappedMachineIds: { id: number; name: string; punchCount: number }[];
  skippedInvalid: number;
  skippedOutOfMonth: number;
  totalLinesParsed: number;
}

/** Device export: 902 Mishal 2026-06-03 15:00:22 1 5 */
const LEGACY_LINE_RE =
  /^(?:\d+\s+)?(\d+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)$/;

const LEGACY_GLOBAL_RE =
  /(?:^|[\s\t])(?:\d+\s+)?(\d{2,})\s+(\S+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)/g;

/**
 * ZKTeco / Hawally PDF: AC-No Name DD/MM/YYYY H:MM AM State
 * e.g. 803 M Badani 02/06/2026 8:38 AM C/In
 */
const AC_LINE_RE =
  /^(\d{2,})\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s+(C\s*\/?\s*In|C\s*\/?\s*Out)$/i;

const AC_GLOBAL_RE =
  /(\d{2,})\s+([A-Za-z][A-Za-z0-9.\s'-]*?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s+(C\s*\/?\s*In|C\s*\/?\s*Out)/gi;

const ATTENDANCE_HEADER_RE = /^(?:AC[\s-]*No|Name|Time|State)\b/i;

function eventKey(e: AttendancePunchEvent): string {
  return `${e.machineId}|${e.dateIso}|${e.state}`;
}

function parseDdMmYyyyToIso(dateStr: string): string | null {
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Normalize PDF/paste text before parsing (collapse spaces, drop table headers). */
export function normalizeAttendanceImportText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line && !ATTENDANCE_HEADER_RE.test(line))
    .join('\n');
}

function normalizeState(raw: string): 'in' | 'out' | null {
  const s = raw.replace(/\s+/g, '').toLowerCase();
  if (s === 'c/in' || s === 'cin') return 'in';
  if (s === 'c/out' || s === 'cout') return 'out';
  return null;
}

function parseAcFormatLine(line: string): AttendancePunchEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const m = trimmed.match(AC_LINE_RE);
  if (!m) return null;

  const machineId = parseInt(m[1], 10);
  const name = m[2].trim();
  const dateIso = parseDdMmYyyyToIso(m[3]);
  const state = normalizeState(m[5]);
  if (!dateIso || !state || isNaN(machineId)) return null;

  return { machineId, name, dateIso, state };
}

function parseLegacyLine(line: string): AttendancePunchEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tabParts = trimmed.split('\t');
  if (tabParts.length >= 5) {
    const offset = tabParts.length >= 6 ? 1 : 0;
    const machineId = parseInt(tabParts[offset], 10);
    const name = tabParts[offset + 1].trim();
    const ts = tabParts[offset + 2].trim();
    const status5 = parseInt(tabParts[offset + 4], 10);
    if (isNaN(machineId) || !ts) return null;
    const dateIso = ts.slice(0, 10);
    return {
      machineId,
      name,
      dateIso,
      state: 'in',
      invalid: status5 === 0
    };
  }

  const m = trimmed.match(LEGACY_LINE_RE);
  if (!m) return null;
  const machineId = parseInt(m[1], 10);
  const status5 = parseInt(m[5], 10);
  return {
    machineId,
    name: m[2],
    dateIso: m[3].slice(0, 10),
    state: 'in',
    invalid: status5 === 0
  };
}

/**
 * Extract attendance punch events from pasted text or PDF extraction.
 * Supports Hawally AC-No/Name/Time/State PDFs and legacy numeric exports.
 */
export function extractAttendanceEventsFromText(rawText: string): AttendancePunchEvent[] {
  const seen = new Set<string>();
  const results: AttendancePunchEvent[] = [];

  const add = (event: AttendancePunchEvent | null) => {
    if (!event) return;
    const key = eventKey(event);
    if (seen.has(key)) return;
    seen.add(key);
    results.push(event);
  };

  for (const line of rawText.split(/\r?\n/)) {
    add(parseAcFormatLine(line));
    add(parseLegacyLine(line));
  }

  AC_GLOBAL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AC_GLOBAL_RE.exec(rawText)) !== null) {
    const machineId = parseInt(match[1], 10);
    const name = match[2].trim();
    const dateIso = parseDdMmYyyyToIso(match[3]);
    const state = normalizeState(match[5]);
    if (!dateIso || !state || isNaN(machineId)) continue;
    add({ machineId, name, dateIso, state });
  }

  LEGACY_GLOBAL_RE.lastIndex = 0;
  while ((match = LEGACY_GLOBAL_RE.exec(rawText)) !== null) {
    const status5 = parseInt(match[5], 10);
    add({
      machineId: parseInt(match[1], 10),
      name: match[2],
      dateIso: match[3].slice(0, 10),
      state: 'in',
      invalid: status5 === 0
    });
  }

  return results;
}

/** @deprecated use extractAttendanceEventsFromText */
export function extractPunchLinesFromText(rawText: string) {
  return extractAttendanceEventsFromText(rawText);
}

/**
 * Parse attendance text and count distinct present days per employee for a month.
 * Employees appearing anywhere in the import are included; those with no punches in
 * the selected month get 0 present days (fully absent for that month).
 * A day counts as present when there is any valid C/In or C/Out punch on that date.
 */
export function parsePunchLog(
  rawText: string,
  year: number,
  month: number,
  employees: Employee[]
): PunchLogParseResult {
  const events = extractAttendanceEventsFromText(normalizeAttendanceImportText(rawText));
  let skippedInvalid = 0;
  let skippedOutOfMonth = 0;
  const totalLinesParsed = events.length;

  const daysByMachineIdInMonth = new Map<number, Set<string>>();
  const nameByMachineId = new Map<number, string>();
  const punchCountByMachineId = new Map<number, number>();
  const allMachineIds = new Set<number>();

  for (const event of events) {
    if (event.invalid) {
      skippedInvalid++;
      continue;
    }

    allMachineIds.add(event.machineId);
    nameByMachineId.set(event.machineId, event.name);
    punchCountByMachineId.set(
      event.machineId,
      (punchCountByMachineId.get(event.machineId) ?? 0) + 1
    );

    const [y, m] = event.dateIso.split('-').map(Number);
    if (y !== year || m !== month) {
      skippedOutOfMonth++;
      continue;
    }

    if (!daysByMachineIdInMonth.has(event.machineId)) {
      daysByMachineIdInMonth.set(event.machineId, new Set());
    }
    daysByMachineIdInMonth.get(event.machineId)!.add(event.dateIso);
  }

  const machineIds = [...allMachineIds];
  const uuidMap = mapMachineIdsToEmployeeUuids(machineIds, employees, nameByMachineId);

  const actualDaysByEmployeeId: Record<string, number> = {};
  const unmappedMachineIds: PunchLogParseResult['unmappedMachineIds'] = [];

  for (const machineId of machineIds) {
    const uuid = uuidMap.get(machineId);
    const days = daysByMachineIdInMonth.get(machineId)?.size ?? 0;
    if (uuid) {
      actualDaysByEmployeeId[uuid] = days;
    } else {
      unmappedMachineIds.push({
        id: machineId,
        name: nameByMachineId.get(machineId) ?? String(machineId),
        punchCount: punchCountByMachineId.get(machineId) ?? 0
      });
    }
  }

  return {
    actualDaysByEmployeeId,
    matchedEmployees: Object.keys(actualDaysByEmployeeId).length,
    unmappedMachineIds,
    skippedInvalid,
    skippedOutOfMonth,
    totalLinesParsed
  };
}
