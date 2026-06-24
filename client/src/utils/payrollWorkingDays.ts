import { eachDateInPayrollPeriod, type PayrollPeriodBounds } from './payrollPeriod';

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
