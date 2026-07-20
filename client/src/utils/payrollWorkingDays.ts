import { eachDateInPayrollPeriod, type PayrollPeriodBounds } from './payrollPeriod';
import {
  PAYROLL_MONTH_DIVISOR,
  PAYROLL_SATURDAY_OFF_DIVISOR,
} from './payrollTemplate';

/** Saturday = 6 (Date.getDay). True when shift exists and has no Saturday work day. */
export function employeeHasSaturdayOff(shifts: { day_of_week: number }[]): boolean {
  if (shifts.length === 0) return false;
  return !shifts.some((s) => s.day_of_week === 6);
}

/**
 * Salary daily-rate divisor: 21 for Saturday-off shifts, else 26.
 * Falls back to inferring from scheduled days on legacy rows without stored divisor.
 */
export function resolvePayrollMonthDivisor(
  workingDaysInMonth: number,
  options: { saturdayOff?: boolean; storedDivisor?: number } = {}
): number {
  if (options.storedDivisor != null && options.storedDivisor > 0) {
    return options.storedDivisor;
  }
  if (options.saturdayOff) {
    return PAYROLL_SATURDAY_OFF_DIVISOR;
  }
  if (
    workingDaysInMonth > 0 &&
    workingDaysInMonth < PAYROLL_MONTH_DIVISOR &&
    workingDaysInMonth <= PAYROLL_SATURDAY_OFF_DIVISOR + 1
  ) {
    return PAYROLL_SATURDAY_OFF_DIVISOR;
  }
  return PAYROLL_MONTH_DIVISOR;
}

/** Grace period before a check-in is treated as late in payroll (minutes after shift start). */
export const PAYROLL_LATE_TOLERANCE_MINUTES = 15;

/**
 * Count scheduled working days in a payroll period (holidays are not subtracted — they are paid separately).
 */
export function countScheduledDaysInPeriod(
  period: PayrollPeriodBounds,
  workingWeekdays: Set<number>,
  _holidayDates?: Set<string>
): number {
  let count = 0;
  eachDateInPayrollPeriod(period, (dateIso, date) => {
    if (workingWeekdays.has(date.getDay())) count++;
  });
  return count;
}

/** Count company holidays in the period that fall on an employee's working weekdays. */
export function countCompanyHolidayDaysInPeriod(
  period: PayrollPeriodBounds,
  workingWeekdays: Set<number>,
  holidayDates: Set<string>
): number {
  let count = 0;
  eachDateInPayrollPeriod(period, (dateIso, date) => {
    if (!holidayDates.has(dateIso)) return;
    if (workingWeekdays.has(date.getDay())) count++;
  });
  return count;
}

/** @deprecated use countScheduledDaysInPeriod */
export function countScheduledDaysInMonth(
  year: number,
  month: number,
  workingWeekdays: Set<number>,
  holidayDates: Set<string>
): number {
  const monthEnd = new Date(year, month, 0);
  const totalDays = monthEnd.getDate();
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month - 1, d);
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (holidayDates.has(dateIso)) continue;
    if (workingWeekdays.has(date.getDay())) count++;
  }
  return count;
}

/** Build a Set of ISO dates for holidays inside a payroll period. */
export function holidayDatesInPeriod(
  holidays: { holiday_date: string }[],
  periodStart: string,
  periodEnd: string
): Set<string> {
  return new Set(
    holidays
      .map((h) => h.holiday_date.slice(0, 10))
      .filter((d) => d >= periodStart && d <= periodEnd)
  );
}

/** @deprecated use holidayDatesInPeriod */
export function holidayDatesInMonth(
  holidays: { holiday_date: string }[],
  year: number,
  month: number
): Set<string> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return new Set(
    holidays
      .map((h) => h.holiday_date.slice(0, 10))
      .filter((d) => d.startsWith(prefix))
  );
}
