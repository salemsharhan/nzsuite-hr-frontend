import type { Employee } from '@/services/employeeService';
import type { EmployeeShift } from '@/services/companySettingsService';
import { mapMachineIdsToEmployeeUuids } from './machineEmployeeMapping';
import { PAYROLL_LATE_TOLERANCE_MINUTES } from './payrollWorkingDays';
import { isDateInPayrollPeriod, type PayrollPeriodBounds } from './payrollPeriod';

export interface AttendancePunchEvent {
  machineId: number;
  name: string;
  dateIso: string;
  /** Minutes from midnight (local punch time) */
  timeMinutes: number;
  state: 'in' | 'out';
  invalid?: boolean;
}

export interface PunchLogParseOptions {
  /** ISO dates (YYYY-MM-DD) excluded from present-day count */
  holidayDates?: Set<string>;
  /** Grace after shift start; check-ins beyond this do not count as present */
  lateToleranceMinutes?: number;
  shiftsByEmployeeId?: Record<string, EmployeeShift[]>;
}

export interface PunchLogParseResult {
  actualDaysByEmployeeId: Record<string, number>;
  /** Device AC-No(s) from the PDF linked to each employee UUID */
  machineIdsByEmployeeId: Record<string, number[]>;
  matchedEmployees: number;
  unmappedMachineIds: { id: number; name: string; punchCount: number }[];
  skippedInvalid: number;
  skippedOutOfPeriod: number;
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
const AC_STATE_RE =
  '(?:C\\s*/?\\s*In|C\\s*/?\\s*Out|Over\\s*Time\\s*/?\\s*In|Over\\s*Time\\s*/?\\s*Out)';

const AC_LINE_RE = new RegExp(
  `^(\\d{2,})\\s+(.+?)\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s+(\\d{1,2}:\\d{2}\\s*(?:AM|PM))\\s+(${AC_STATE_RE})$`,
  'i'
);

const AC_GLOBAL_RE = new RegExp(
  `(\\d{2,})\\s+([A-Za-z][A-Za-z0-9.\\s'-]*?)\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s+(\\d{1,2}:\\d{2}\\s*(?:AM|PM))\\s+(${AC_STATE_RE})`,
  'gi'
);

const ATTENDANCE_HEADER_RE = /^(?:AC[\s-]*No|Name|Time|State)\b/i;

function eventKey(e: AttendancePunchEvent): string {
  return `${e.machineId}|${e.dateIso}|${e.timeMinutes}|${e.state}`;
}

function parseAmPmTimeToMinutes(timeStr: string): number | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  if (period === 'AM') {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  return hours * 60 + minutes;
}

function parse24hTimestampToMinutes(ts: string): number | null {
  const m = ts.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseShiftStartMinutes(startTime: string): number | null {
  const parts = startTime.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
}

function parseShiftEndMinutes(endTime: string): number | null {
  const parts = endTime.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
}

function uniqueShiftTimes(dayShifts: EmployeeShift[]): {
  starts: number[];
  ends: number[];
} {
  const starts = new Set<number>();
  const ends = new Set<number>();
  for (const s of dayShifts) {
    const start = parseShiftStartMinutes(s.start_time);
    const end = parseShiftEndMinutes(s.end_time);
    if (start !== null) starts.add(start);
    if (end !== null) ends.add(end);
  }
  return {
    starts: Array.from(starts),
    ends: Array.from(ends)
  };
}

/**
 * A day counts as present when the employee worked a scheduled day.
 * - Two punches (e.g. 4 PM + 8 PM) = full day even if first punch is slightly late
 * - Single punch: must be within grace of shift start (C/In or mislabeled C/Out)
 */
function isPresentDay(
  dayEvents: AttendancePunchEvent[],
  shifts: EmployeeShift[],
  dateIso: string,
  lateToleranceMinutes: number
): boolean {
  const valid = dayEvents.filter((e) => !e.invalid);
  if (valid.length === 0) return false;

  const dayOfWeek = new Date(`${dateIso}T12:00:00`).getDay();
  const dayShifts = shifts.filter((s) => s.day_of_week === dayOfWeek && s.start_time);

  // Rest day for this employee (e.g. Saturday off) — punches do not count as present
  if (dayShifts.length === 0) {
    if (shifts.length > 0) return false;
    return valid.length > 0;
  }

  const { starts: shiftStarts, ends: shiftEnds } = uniqueShiftTimes(dayShifts);
  if (shiftStarts.length === 0) return valid.length > 0;

  const punchTimes = valid.map((e) => e.timeMinutes);

  // Split-shift pattern: opening punch + closing punch on same day = present
  if (valid.length >= 2 && shiftEnds.length > 0) {
    const minStart = Math.min(...shiftStarts) - 60;
    const maxEnd = Math.max(...shiftEnds) + 60;
    const hasOpening = punchTimes.some(
      (t) => t >= minStart && t <= Math.min(...shiftStarts) + 120
    );
    const hasClosing = punchTimes.some(
      (t) => t >= Math.max(...shiftEnds) - 60 && t <= maxEnd
    );
    if (hasOpening && hasClosing) return true;
  }

  if (valid.length >= 2) {
    const minStart = Math.min(...shiftStarts) - 60;
    const maxEnd =
      shiftEnds.length > 0 ? Math.max(...shiftEnds) + 60 : Math.min(...shiftStarts) + 600;
    if (punchTimes.every((t) => t >= minStart && t <= maxEnd)) return true;
  }

  const arrivals = getEffectiveArrivalMinutes(valid, dayShifts);
  if (arrivals.length === 0) return false;

  return arrivals.some((arrival) =>
    shiftStarts.some((shiftStart) => arrival <= shiftStart + lateToleranceMinutes)
  );
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
  if (s === 'c/in' || s === 'cin' || s === 'overtime/in' || s === 'overtimein') return 'in';
  if (s === 'c/out' || s === 'cout' || s === 'overtime/out' || s === 'overtimeout') return 'out';
  return null;
}

/**
 * Hawally devices sometimes log arrivals as C/Out or OverTime Out.
 * Collect check-in times from C/In punches and infer arrivals from out punches near shift starts.
 */
function getEffectiveArrivalMinutes(
  valid: AttendancePunchEvent[],
  dayShifts: EmployeeShift[]
): number[] {
  const arrivals = valid.filter((e) => e.state === 'in').map((e) => e.timeMinutes);
  const outs = valid.filter((e) => e.state === 'out').map((e) => e.timeMinutes);
  const shiftStarts = dayShifts
    .map((s) => parseShiftStartMinutes(s.start_time))
    .filter((n): n is number => n !== null);

  for (const t of outs) {
    if (shiftStarts.length === 0) {
      arrivals.push(t);
      continue;
    }
    const nearShiftStart = shiftStarts.some(
      (s) => t >= s - 60 && t <= s + 120
    );
    const morningOutForMorningShift = t < 14 * 60 && shiftStarts.some((s) => s < 12 * 60);
    if (nearShiftStart || morningOutForMorningShift) {
      arrivals.push(t);
    }
  }

  return Array.from(new Set(arrivals));
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
  const timeMinutes = parseAmPmTimeToMinutes(m[4]) ?? 0;
  if (!dateIso || !state || isNaN(machineId)) return null;

  return { machineId, name, dateIso, timeMinutes, state };
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
    const timeMinutes = parse24hTimestampToMinutes(ts) ?? 0;
    return {
      machineId,
      name,
      dateIso,
      timeMinutes,
      state: 'in',
      invalid: status5 === 0
    };
  }

  const m = trimmed.match(LEGACY_LINE_RE);
  if (!m) return null;
  const machineId = parseInt(m[1], 10);
  const status5 = parseInt(m[5], 10);
  const timeMinutes = parse24hTimestampToMinutes(m[3]) ?? 0;
  return {
    machineId,
    name: m[2],
    dateIso: m[3].slice(0, 10),
    timeMinutes,
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
    const timeMinutes = parseAmPmTimeToMinutes(match[4]) ?? 0;
    add({ machineId, name, dateIso, timeMinutes, state });
  }

  LEGACY_GLOBAL_RE.lastIndex = 0;
  while ((match = LEGACY_GLOBAL_RE.exec(rawText)) !== null) {
    const status5 = parseInt(match[5], 10);
    const timeMinutes = parse24hTimestampToMinutes(match[3]) ?? 0;
    add({
      machineId: parseInt(match[1], 10),
      name: match[2],
      dateIso: match[3].slice(0, 10),
      timeMinutes,
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
 * Parse attendance text and count distinct present days per employee for a payroll period
 * (21st of previous month through 20th of payroll month).
 */
export function parsePunchLog(
  rawText: string,
  period: PayrollPeriodBounds,
  employees: Employee[],
  options: PunchLogParseOptions = {}
): PunchLogParseResult {
  const holidayDates = options.holidayDates ?? new Set<string>();
  const lateToleranceMinutes = options.lateToleranceMinutes ?? PAYROLL_LATE_TOLERANCE_MINUTES;
  const shiftsByEmployeeId = options.shiftsByEmployeeId ?? {};

  const events = extractAttendanceEventsFromText(normalizeAttendanceImportText(rawText));
  let skippedInvalid = 0;
  let skippedOutOfPeriod = 0;
  const totalLinesParsed = events.length;

  const eventsByMachineIdInPeriod = new Map<number, Map<string, AttendancePunchEvent[]>>();
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

    if (!isDateInPayrollPeriod(event.dateIso, period)) {
      skippedOutOfPeriod++;
      continue;
    }

    if (holidayDates.has(event.dateIso)) continue;

    if (!eventsByMachineIdInPeriod.has(event.machineId)) {
      eventsByMachineIdInPeriod.set(event.machineId, new Map());
    }
    const byDate = eventsByMachineIdInPeriod.get(event.machineId)!;
    if (!byDate.has(event.dateIso)) byDate.set(event.dateIso, []);
    byDate.get(event.dateIso)!.push(event);
  }

  const machineIds = Array.from(allMachineIds);
  const uuidMap = mapMachineIdsToEmployeeUuids(machineIds, employees, nameByMachineId);

  const actualDaysByEmployeeId: Record<string, number> = {};
  const machineIdsByEmployeeId: Record<string, number[]> = {};
  const unmappedMachineIds: PunchLogParseResult['unmappedMachineIds'] = [];

  for (const machineId of machineIds) {
    const uuid = uuidMap.get(machineId);
    const byDate = eventsByMachineIdInPeriod.get(machineId);
    let days = 0;
    if (byDate) {
      const shifts = uuid ? shiftsByEmployeeId[uuid] ?? [] : [];
      for (const [dateIso, dayEvents] of Array.from(byDate.entries())) {
        if (shifts.length > 0) {
          const dayOfWeek = new Date(`${dateIso}T12:00:00`).getDay();
          const onScheduledDay = shifts.some((s) => s.day_of_week === dayOfWeek);
          if (!onScheduledDay) continue;
        }
        if (isPresentDay(dayEvents, shifts, dateIso, lateToleranceMinutes)) days++;
      }
    }
    if (uuid) {
      actualDaysByEmployeeId[uuid] = (actualDaysByEmployeeId[uuid] ?? 0) + days;
      if (!machineIdsByEmployeeId[uuid]) machineIdsByEmployeeId[uuid] = [];
      machineIdsByEmployeeId[uuid].push(machineId);
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
    machineIdsByEmployeeId,
    matchedEmployees: Object.keys(actualDaysByEmployeeId).length,
    unmappedMachineIds,
    skippedInvalid,
    skippedOutOfPeriod,
    totalLinesParsed
  };
}
