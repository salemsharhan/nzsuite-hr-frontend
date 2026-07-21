import { employeeService, Employee } from './employeeService';
import { companySettingsService, CompanySettings } from './companySettingsService';
import { leaveService, LeaveRequest } from './leaveService';

export interface LeaveBalance {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  join_date: string;
  annual_leave: {
    accrued: number;
    used: number;
    pending: number;
    available: number;
    expired?: number;
    expiringSoon?: number;
    eligible: boolean;
    maxAccumulation?: number;
  };
  sick_leave: {
    accrued: number;
    used: number;
    pending: number;
    available: number;
  };
  emergency_leave: {
    accrued: number;
    used: number;
    pending: number;
    available: number;
  };
}

type LeaveBucket = 'annual' | 'sick' | 'emergency' | 'other';

/** Normalize stored leave_type values (annual / Annual Leave / sick / مرضية …). */
export function normalizeLeaveBucket(leaveType: string): LeaveBucket {
  const t = String(leaveType || '')
    .trim()
    .toLowerCase();
  if (!t) return 'other';
  if (/sick|مرض/.test(t)) return 'sick';
  if (/emergency|طارئ/.test(t)) return 'emergency';
  if (/annual|vacation|personal|سنو|مدفوعة|paid\s*leave/.test(t) || t === 'annual') return 'annual';
  if (t === 'unpaid' || /unpaid|بدون|without\s*pay/.test(t)) return 'other';
  return 'other';
}

function getMonthsBetween(startDate: Date, endDate: Date): number {
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(0, months);
}

function getDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function calculateAccruedLeave(
  annualDays: number,
  joinDate: Date,
  currentDate: Date = new Date(),
  leaveType: 'annual' | 'sick' | 'emergency' = 'annual',
): { accrued: number; expired: number; expiringSoon: number } {
  const monthsWorked = getMonthsBetween(joinDate, currentDate);
  const monthlyAccrual = annualDays / 12;
  const totalAccrued = monthsWorked * monthlyAccrual;
  const maxAccumulation = annualDays * 2;

  const twoYearsAgo = new Date(currentDate);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  let expired = 0;
  let expiringSoon = 0;

  if (leaveType === 'annual' && monthsWorked > 24) {
    if (totalAccrued > maxAccumulation) {
      expired = totalAccrued - maxAccumulation;
    }

    const threeMonthsFromExpiry = new Date(currentDate);
    threeMonthsFromExpiry.setMonth(threeMonthsFromExpiry.getMonth() + 3);

    if (monthsWorked >= 21 && monthsWorked < 24) {
      const monthsInExpiryWindow = Math.max(0, monthsWorked - 21);
      expiringSoon = monthsInExpiryWindow * monthlyAccrual;
    }
  }

  const cappedAccrued =
    leaveType === 'annual' ? Math.min(totalAccrued, maxAccumulation) : totalAccrued;

  return {
    accrued: Math.floor(cappedAccrued * 100) / 100,
    expired: Math.floor(expired * 100) / 100,
    expiringSoon: Math.floor(expiringSoon * 100) / 100,
  };
}

function isEligibleForAnnualLeave(joinDate: Date, currentDate: Date = new Date()): boolean {
  return getMonthsBetween(joinDate, currentDate) >= 9;
}

function isPendingStatus(status: string): boolean {
  return status === 'Pending' || status === 'Pending_GM' || status === 'On_Hold';
}

/**
 * Calculate used and pending leaves from leave requests.
 * For annual-reset types (sick, emergency), only count leaves from the current calendar year.
 */
function calculateUsedLeaves(
  leaveRequests: LeaveRequest[],
  bucket: LeaveBucket,
  currentDate: Date = new Date(),
  resetAnnually: boolean = false,
): { used: number; pending: number } {
  let used = 0;
  let pending = 0;

  const yearStart = resetAnnually ? new Date(currentDate.getFullYear(), 0, 1) : null;

  leaveRequests
    .filter((req) => normalizeLeaveBucket(req.leave_type) === bucket)
    .forEach((req) => {
      if (resetAnnually && yearStart) {
        const reqDate = new Date(req.start_date);
        if (reqDate < yearStart && new Date(req.end_date) < yearStart) return;
      }

      const startDate = new Date(req.start_date);
      const endDate = new Date(req.end_date);
      let days = getDaysBetween(startDate, endDate);

      if (resetAnnually && yearStart) {
        const effectiveStartDate = startDate < yearStart ? yearStart : startDate;
        const effectiveEndDate = endDate > currentDate ? currentDate : endDate;
        if (effectiveStartDate <= effectiveEndDate) {
          days = getDaysBetween(effectiveStartDate, effectiveEndDate);
        } else {
          days = 0;
        }
      }

      if (req.status === 'Approved') {
        used += days;
      } else if (isPendingStatus(req.status)) {
        pending += days;
      }
    });

  return { used, pending };
}

function calculateAnnualResetLeave(
  annualDays: number,
  joinDate: Date,
  currentDate: Date = new Date(),
): number {
  const currentYear = currentDate.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);

  if (joinDate > yearStart) {
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    const monthsFromJoinToYearEnd = getMonthsBetween(joinDate, yearEnd);
    const proRatedDays = (annualDays / 12) * (monthsFromJoinToYearEnd + 1);
    return Math.min(proRatedDays, annualDays);
  }
  return annualDays;
}

function buildBalanceForEmployee(
  employee: Employee,
  companySettings: CompanySettings,
  employeeLeaves: LeaveRequest[],
  currentDate: Date = new Date(),
): LeaveBalance {
  const joinDate = new Date(employee.join_date);

  const annualUsage = calculateUsedLeaves(employeeLeaves, 'annual', currentDate, false);
  const sickUsage = calculateUsedLeaves(employeeLeaves, 'sick', currentDate, true);
  const emergencyUsage = calculateUsedLeaves(employeeLeaves, 'emergency', currentDate, true);

  const annualLeaveCalc = calculateAccruedLeave(
    companySettings.annual_leave_days_per_year,
    joinDate,
    currentDate,
    'annual',
  );

  const sickAccrued = calculateAnnualResetLeave(
    companySettings.sick_leave_days_per_year,
    joinDate,
    currentDate,
  );
  const emergencyAccrued = calculateAnnualResetLeave(3, joinDate, currentDate);

  const annualAvailable = Math.max(
    0,
    annualLeaveCalc.accrued - annualLeaveCalc.expired - annualUsage.used - annualUsage.pending,
  );
  const sickAvailable = Math.max(0, sickAccrued - sickUsage.used - sickUsage.pending);
  const emergencyAvailable = Math.max(
    0,
    emergencyAccrued - emergencyUsage.used - emergencyUsage.pending,
  );

  const maxAnnualAccumulation = companySettings.annual_leave_days_per_year * 2;
  const departmentName =
    typeof employee.department === 'string'
      ? employee.department
      : (employee.department as { name?: string } | undefined)?.name || 'N/A';

  return {
    employee_id: employee.id,
    employee_name: `${employee.first_name} ${employee.last_name}`,
    employee_code: employee.employee_id || '',
    department: departmentName,
    join_date: employee.join_date,
    annual_leave: {
      accrued: annualLeaveCalc.accrued,
      used: annualUsage.used,
      pending: annualUsage.pending,
      available: Math.floor(annualAvailable * 100) / 100,
      expired: annualLeaveCalc.expired,
      expiringSoon: annualLeaveCalc.expiringSoon,
      eligible: isEligibleForAnnualLeave(joinDate, currentDate),
      maxAccumulation: maxAnnualAccumulation,
    },
    sick_leave: {
      accrued: Math.floor(sickAccrued * 100) / 100,
      used: sickUsage.used,
      pending: sickUsage.pending,
      available: Math.floor(sickAvailable * 100) / 100,
    },
    emergency_leave: {
      accrued: Math.floor(emergencyAccrued * 100) / 100,
      used: emergencyUsage.used,
      pending: emergencyUsage.pending,
      available: Math.floor(emergencyAvailable * 100) / 100,
    },
  };
}

/**
 * Get leave balance for all employees
 */
export async function getLeaveBalances(companyId: string): Promise<LeaveBalance[]> {
  try {
    const [employees, companySettings, allLeaveRequests] = await Promise.all([
      employeeService.getAll(companyId),
      companySettingsService.getCompanySettings(companyId),
      leaveService.getAll({ companyId, limit: 10000 }),
    ]);

    if (!companySettings) {
      throw new Error('Company settings not found');
    }

    const currentDate = new Date();
    return employees.map((employee) => {
      const employeeLeaves = allLeaveRequests.filter((req) => req.employee_id === employee.id);
      return buildBalanceForEmployee(employee, companySettings, employeeLeaves, currentDate);
    });
  } catch (error) {
    console.error('Error calculating leave balances:', error);
    throw error;
  }
}

/**
 * Get leave balance for a single employee (loads that employee's leave requests only).
 */
export async function getEmployeeLeaveBalance(
  employeeId: string,
  companyId: string,
): Promise<LeaveBalance | null> {
  try {
    const [employee, companySettings, employeeLeaves] = await Promise.all([
      employeeService.getById(employeeId),
      companySettingsService.getCompanySettings(companyId),
      leaveService.getByEmployee(employeeId),
    ]);

    if (!employee || !companySettings) return null;
    return buildBalanceForEmployee(employee, companySettings, employeeLeaves, new Date());
  } catch (error) {
    console.error('Error fetching employee leave balance:', error);
    return null;
  }
}
