import type { EmployeeShift } from '@/services/companySettingsService';
import { PAYROLL_MONTH_DIVISOR } from './payrollTemplate';
import {
  extractAttendanceEventsFromText,
  normalizeAttendanceImportText,
  type AttendancePunchEvent,
} from './payrollPunchLogParser';
import { isDateInPayrollPeriod, type PayrollPeriodBounds } from './payrollPeriod';

export interface LatePenaltyDay {
  date: string;
  minutes_late: number;
  tier_minutes: number;
  penalty_kwd: number;
}

export interface LatePenaltyResult {
  total_kwd: number;
  days: LatePenaltyDay[];
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

/** Penalty tier minutes (deducted pay), not actual lateness. */
export function latePenaltyTierMinutes(minutesLate: number): number {
  if (minutesLate < 16) return 0;
  if (minutesLate <= 30) return 30;
  return 60;
}

export function calcLatePenaltyKwd(
  basicSalaryKwd: number,
  tierPenaltyMinutes: number,
  hoursPerDay: number,
): number {
  if (tierPenaltyMinutes <= 0 || hoursPerDay <= 0 || basicSalaryKwd <= 0) return 0;
  const monthlyHours = PAYROLL_MONTH_DIVISOR * hoursPerDay;
  return Math.round((basicSalaryKwd * (tierPenaltyMinutes / 60) / monthlyHours) * 1000) / 1000;
}

/** Hours per day from shift length; falls back to company default (often 7 or 8). */
export function resolveHoursPerDay(
  shifts: EmployeeShift[],
  defaultHoursPerDay = 8,
): number {
  for (const s of shifts) {
    const start = parseShiftStartMinutes(s.start_time);
    const end = parseShiftEndMinutes(s.end_time);
    if (start !== null && end !== null && end > start) {
      const hours = (end - start) / 60;
      if (hours > 0 && hours <= 12) return hours;
    }
  }
  return defaultHoursPerDay > 0 ? defaultHoursPerDay : 8;
}

function getEffectiveArrivalMinutes(
  valid: AttendancePunchEvent[],
  dayShifts: EmployeeShift[],
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
    const nearShiftStart = shiftStarts.some((s) => t >= s - 60 && t <= s + 120);
    const morningOutForMorningShift = t < 14 * 60 && shiftStarts.some((s) => s < 12 * 60);
    if (nearShiftStart || morningOutForMorningShift) {
      arrivals.push(t);
    }
  }

  return Array.from(new Set(arrivals));
}

function earliestMorningShiftStart(dayShifts: EmployeeShift[]): number | null {
  const starts = dayShifts
    .map((s) => parseShiftStartMinutes(s.start_time))
    .filter((n): n is number => n !== null && n < 12 * 60);
  if (starts.length === 0) {
    const all = dayShifts
      .map((s) => parseShiftStartMinutes(s.start_time))
      .filter((n): n is number => n !== null);
    return all.length > 0 ? Math.min(...all) : 7 * 60;
  }
  return Math.min(...starts);
}

export interface ComputeLatePenaltiesOptions {
  period: PayrollPeriodBounds;
  machineIds: Set<string>;
  shifts: EmployeeShift[];
  basicSalaryKwd: number;
  hoursPerDay: number;
  holidayDates?: Set<string>;
  /** Dates with approved permitted late — no penalty that day */
  excludedDates?: Set<string>;
  /** Only count lateness on/after this date (YYYY-MM-DD), e.g. return from overseas */
  countFromDate?: string;
}

export function computeLatePenaltiesFromEvents(
  events: AttendancePunchEvent[],
  options: ComputeLatePenaltiesOptions,
): LatePenaltyResult {
  const {
    period,
    machineIds,
    shifts,
    basicSalaryKwd,
    hoursPerDay,
    holidayDates = new Set(),
    excludedDates = new Set(),
    countFromDate,
  } = options;

  const byDate = new Map<string, AttendancePunchEvent[]>();
  for (const event of events) {
    if (event.invalid) continue;
    if (!machineIds.has(String(event.machineId))) continue;
    if (!isDateInPayrollPeriod(event.dateIso, period)) continue;
    if (holidayDates.has(event.dateIso)) continue;
    if (countFromDate && event.dateIso < countFromDate) continue;
    if (excludedDates.has(event.dateIso)) continue;

    if (!byDate.has(event.dateIso)) byDate.set(event.dateIso, []);
    byDate.get(event.dateIso)!.push(event);
  }

  const days: LatePenaltyDay[] = [];
  let totalTierMinutes = 0;

  for (const [dateIso, dayEvents] of byDate) {
    const dayOfWeek = new Date(`${dateIso}T12:00:00`).getDay();
    const dayShifts = shifts.filter((s) => s.day_of_week === dayOfWeek && s.start_time);
    const shiftStart = earliestMorningShiftStart(dayShifts);
    if (shiftStart === null) continue;

    const arrivals = getEffectiveArrivalMinutes(dayEvents.filter((e) => !e.invalid), dayShifts);
    if (arrivals.length === 0) continue;

    const earliest = Math.min(...arrivals);
    const minutesLate = Math.max(0, earliest - shiftStart);
    const tierMinutes = latePenaltyTierMinutes(minutesLate);
    if (tierMinutes <= 0) continue;

    const penalty_kwd = calcLatePenaltyKwd(basicSalaryKwd, tierMinutes, hoursPerDay);
    totalTierMinutes += tierMinutes;
    days.push({ date: dateIso, minutes_late: minutesLate, tier_minutes: tierMinutes, penalty_kwd });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  const total_kwd = calcLatePenaltyKwd(basicSalaryKwd, totalTierMinutes, hoursPerDay);
  return { total_kwd, days };
}

export function computeLatePenaltiesFromPunchText(
  punchText: string,
  options: ComputeLatePenaltiesOptions,
): LatePenaltyResult {
  const events = extractAttendanceEventsFromText(normalizeAttendanceImportText(punchText));
  return computeLatePenaltiesFromEvents(events, options);
}

/** Collect dates covered by permitted-late monthly HR entries (date_range mode). */
export function datesFromPermittedLateEntries(
  entries: { type: string; date_from?: string; date_to?: string; days: number }[],
  period: PayrollPeriodBounds,
): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    if (e.type !== 'permitted_late') continue;
    if (!e.date_from || !e.date_to) continue;
    const from = e.date_from.slice(0, 10);
    const to = e.date_to.slice(0, 10);
    const cur = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      if (isDateInPayrollPeriod(iso, period)) out.add(iso);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return out;
}
