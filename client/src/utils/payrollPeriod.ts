/** Payroll cycle starts on this day of the previous calendar month (e.g. June = 21 May – 20 Jun). */
export const PAYROLL_PERIOD_START_DAY = 21;
export const PAYROLL_PERIOD_END_DAY = 20;

export interface PayrollPeriodBounds {
  payrollYear: number;
  payrollMonth: number;
  periodStart: string;
  periodEnd: string;
}

/** June payroll → 21 May through 20 June. */
export function getPayrollPeriodBounds(year: number, month: number): PayrollPeriodBounds {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const periodStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(PAYROLL_PERIOD_START_DAY).padStart(2, '0')}`;
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(PAYROLL_PERIOD_END_DAY).padStart(2, '0')}`;
  return { payrollYear: year, payrollMonth: month, periodStart, periodEnd };
}

export function isDateInPayrollPeriod(dateIso: string, period: PayrollPeriodBounds): boolean {
  const d = dateIso.slice(0, 10);
  return d >= period.periodStart && d <= period.periodEnd;
}

/** Iterate each calendar date (YYYY-MM-DD) in a payroll period, inclusive. */
export function eachDateInPayrollPeriod(
  period: PayrollPeriodBounds,
  fn: (dateIso: string, date: Date) => void
): void {
  const start = new Date(`${period.periodStart}T12:00:00`);
  const end = new Date(`${period.periodEnd}T12:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dateIso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fn(dateIso, new Date(d));
  }
}

export function formatPayrollPeriodRange(period: PayrollPeriodBounds): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[m - 1]} ${y}`;
  };
  return `${fmt(period.periodStart)} – ${fmt(period.periodEnd)}`;
}
