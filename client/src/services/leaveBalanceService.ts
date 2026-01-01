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
    expired?: number; // Leave that expired (not taken within 2 years) - Kuwait labor law
    expiringSoon?: number; // Leave expiring within 3 months
    eligible: boolean; // Can take annual leave (after 9 months)
    maxAccumulation?: number; // Maximum allowed (2 years worth)
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

/**
 * Calculate the number of months between two dates
 */
function getMonthsBetween(startDate: Date, endDate: Date): number {
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                (endDate.getMonth() - startDate.getMonth());
  return Math.max(0, months);
}

/**
 * Calculate the number of days between two dates (inclusive)
 */
function getDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Inclusive
}

/**
 * Calculate accrued leave days based on monthly accrual with 2-year expiry rule
 * According to Kuwait labor law, unused annual leave expires after 2 years
 */
function calculateAccruedLeave(
  annualDays: number,
  joinDate: Date,
  currentDate: Date = new Date(),
  leaveType: 'annual' | 'sick' | 'emergency' = 'annual'
): { accrued: number; expired: number; expiringSoon: number } {
  const monthsWorked = getMonthsBetween(joinDate, currentDate);
  const monthlyAccrual = annualDays / 12;
  const totalAccrued = monthsWorked * monthlyAccrual;
  
  // Kuwait labor law: Annual leave expires after 2 years if not taken
  // Maximum accumulation is 2 years worth of leave
  const maxAccumulation = annualDays * 2; // 2 years worth
  
  // Calculate expired leave (leave accrued more than 2 years ago)
  const twoYearsAgo = new Date(currentDate);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  let expired = 0;
  let expiringSoon = 0;
  
  if (leaveType === 'annual' && monthsWorked > 24) {
    // Calculate months worked 2 years ago
    const monthsWorkedTwoYearsAgo = getMonthsBetween(joinDate, twoYearsAgo);
    const accruedTwoYearsAgo = monthsWorkedTwoYearsAgo * monthlyAccrual;
    
    // Leave that should have expired (accrued more than 2 years ago)
    // But we need to track which leaves were actually used
    // For now, we'll cap at 2 years and mark anything over as expired
    if (totalAccrued > maxAccumulation) {
      expired = totalAccrued - maxAccumulation;
    }
    
    // Calculate expiring soon (within 3 months of 2-year mark)
    const threeMonthsFromExpiry = new Date(currentDate);
    threeMonthsFromExpiry.setMonth(threeMonthsFromExpiry.getMonth() + 3);
    const monthsUntilExpiry = getMonthsBetween(twoYearsAgo, threeMonthsFromExpiry);
    
    if (monthsWorked >= 21 && monthsWorked < 24) {
      // Leave accrued 21-24 months ago will expire soon
      const monthsInExpiryWindow = Math.max(0, monthsWorked - 21);
      expiringSoon = monthsInExpiryWindow * monthlyAccrual;
    }
  }
  
  // Cap accrued at 2 years for annual leave
  const cappedAccrued = leaveType === 'annual' 
    ? Math.min(totalAccrued, maxAccumulation)
    : totalAccrued;
  
  return {
    accrued: Math.floor(cappedAccrued * 100) / 100,
    expired: Math.floor(expired * 100) / 100,
    expiringSoon: Math.floor(expiringSoon * 100) / 100
  };
}

/**
 * Check if employee is eligible for annual leave (after 9 months)
 */
function isEligibleForAnnualLeave(joinDate: Date, currentDate: Date = new Date()): boolean {
  const monthsWorked = getMonthsBetween(joinDate, currentDate);
  return monthsWorked >= 9;
}

/**
 * Calculate used and pending leaves from leave requests
 * For annual reset leaves (sick, emergency), only count leaves from current year
 */
function calculateUsedLeaves(
  leaveRequests: LeaveRequest[],
  leaveType: string,
  currentDate: Date = new Date(),
  resetAnnually: boolean = false
): { used: number; pending: number } {
  let used = 0;
  let pending = 0;

  // For annual reset leaves, only count leaves from the current calendar year
  const yearStart = resetAnnually 
    ? new Date(currentDate.getFullYear(), 0, 1) // January 1st of current year
    : null;

  leaveRequests
    .filter(req => {
      if (req.leave_type !== leaveType) return false;
      
      // If annual reset, only count leaves from current year
      if (resetAnnually && yearStart) {
        const reqDate = new Date(req.start_date);
        return reqDate >= yearStart;
      }
      
      return true;
    })
    .forEach(req => {
      const startDate = new Date(req.start_date);
      const endDate = new Date(req.end_date);
      
      // For annual reset, only count days within the current year
      let days = getDaysBetween(startDate, endDate);
      
      if (resetAnnually && yearStart) {
        // If leave spans across year boundary, only count days in current year
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
      } else if (req.status === 'Pending') {
        pending += days;
      }
    });

  return { used, pending };
}

/**
 * Calculate annual reset leave (sick leave, emergency leave)
 * These leaves reset every calendar year on January 1st
 * Employees get their full annual entitlement on January 1st and it remains available throughout the year
 */
function calculateAnnualResetLeave(
  annualDays: number,
  joinDate: Date,
  currentDate: Date = new Date()
): number {
  const currentYear = currentDate.getFullYear();
  const yearStart = new Date(currentYear, 0, 1); // January 1st of current year
  
  // Check if employee joined this year
  if (joinDate > yearStart) {
    // Employee joined mid-year, calculate pro-rated entitlement
    // Calculate months from join date to end of year (December 31st)
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    const monthsFromJoinToYearEnd = getMonthsBetween(joinDate, yearEnd);
    const monthsInYear = 12;
    // Pro-rate based on remaining months in the year
    const proRatedDays = (annualDays / monthsInYear) * (monthsFromJoinToYearEnd + 1); // +1 to include current month
    return Math.min(proRatedDays, annualDays);
  } else {
    // Employee was with company before this year started
    // They get full annual entitlement on January 1st and it remains available throughout the year
    return annualDays;
  }
}

/**
 * Get leave balance for all employees
 */
export async function getLeaveBalances(companyId: string): Promise<LeaveBalance[]> {
  try {
    // Fetch all required data
    const [employees, companySettings, allLeaveRequests] = await Promise.all([
      employeeService.getAll(companyId),
      companySettingsService.getCompanySettings(companyId),
      leaveService.getAll()
    ]);

    if (!companySettings) {
      throw new Error('Company settings not found');
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();

    // Calculate balances for each employee
    const balances: LeaveBalance[] = employees.map(employee => {
      const joinDate = new Date(employee.join_date);
      
      // Get employee's leave requests first (needed for expiry calculation)
      const employeeLeaves = allLeaveRequests.filter(
        req => req.employee_id === employee.id
      );

      // Calculate used and pending leaves
      // Annual leave: accumulates from join date (with 2-year expiry)
      const annualUsage = calculateUsedLeaves(employeeLeaves, 'Annual Leave', currentDate, false);
      
      // Sick leave and Emergency leave: reset annually (only count current year)
      const sickUsage = calculateUsedLeaves(employeeLeaves, 'Sick Leave', currentDate, true);
      const emergencyUsage = calculateUsedLeaves(employeeLeaves, 'Emergency Leave', currentDate, true);

      // Calculate accrued leaves with 2-year expiry rule (Kuwait labor law)
      // Pass used days to properly calculate expired leave
      const annualLeaveCalc = calculateAccruedLeave(
        companySettings.annual_leave_days_per_year,
        joinDate,
        currentDate,
        'annual',
        annualUsage.used
      );
      
      // Sick leave and Emergency leave reset every year
      // Calculate based on current calendar year only
      const sickAccrued = calculateAnnualResetLeave(
        companySettings.sick_leave_days_per_year,
        joinDate,
        currentDate
      );

      // Emergency leave - typically 3-5 days per year, let's use 3 as default
      const emergencyAccrued = calculateAnnualResetLeave(3, joinDate, currentDate);

      // Calculate available leaves (accrued - expired - used - pending)
      const annualAvailable = Math.max(0, annualLeaveCalc.accrued - annualLeaveCalc.expired - annualUsage.used - annualUsage.pending);
      const sickAvailable = Math.max(0, sickAccrued - sickUsage.used - sickUsage.pending);
      const emergencyAvailable = Math.max(0, emergencyAccrued - emergencyUsage.used - emergencyUsage.pending);

      // Maximum accumulation for annual leave (2 years worth)
      const maxAnnualAccumulation = companySettings.annual_leave_days_per_year * 2;

      return {
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        employee_code: employee.employee_id || '',
        department: employee.department?.name || 'N/A',
        join_date: employee.join_date,
        annual_leave: {
          accrued: annualLeaveCalc.accrued,
          used: annualUsage.used,
          pending: annualUsage.pending,
          available: Math.floor(annualAvailable * 100) / 100,
          expired: annualLeaveCalc.expired,
          expiringSoon: annualLeaveCalc.expiringSoon,
          eligible: isEligibleForAnnualLeave(joinDate, currentDate),
          maxAccumulation: maxAnnualAccumulation
        },
        sick_leave: {
          accrued: Math.floor(sickAccrued * 100) / 100,
          used: sickUsage.used,
          pending: sickUsage.pending,
          available: Math.floor(sickAvailable * 100) / 100
        },
        emergency_leave: {
          accrued: Math.floor(emergencyAccrued * 100) / 100,
          used: emergencyUsage.used,
          pending: emergencyUsage.pending,
          available: Math.floor(emergencyAvailable * 100) / 100
        }
      };
    });

    return balances;
  } catch (error) {
    console.error('Error calculating leave balances:', error);
    throw error;
  }
}

/**
 * Get leave balance for a single employee
 */
export async function getEmployeeLeaveBalance(
  employeeId: string,
  companyId: string
): Promise<LeaveBalance | null> {
  try {
    const balances = await getLeaveBalances(companyId);
    return balances.find(b => b.employee_id === employeeId) || null;
  } catch (error) {
    console.error('Error fetching employee leave balance:', error);
    return null;
  }
}

