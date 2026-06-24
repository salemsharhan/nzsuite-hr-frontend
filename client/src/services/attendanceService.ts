import { api, adminApi } from './api';
import { employeeService, Employee } from './employeeService';
import { companySettingsService, EmployeeWorkingHours, EmployeeShift } from './companySettingsService';
import { PAYROLL_LATE_TOLERANCE_MINUTES } from '@/utils/payrollWorkingDays';

const LATE_TOLERANCE_MINUTES = PAYROLL_LATE_TOLERANCE_MINUTES;

// Raw attendance record from the attendances table
interface RawAttendance {
  id: number;
  sn: string;
  table: string;
  stamp: string;
  employee_id: number; // Integer from machine
  timestamp: string;
  status1: boolean | null;
  status2: boolean | null;
  status3: boolean | null;
  status4: boolean | null;
  status5: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AttendanceLog {
  id: string;
  employee_id: string; // UUID from employees table
  date: string;
  check_in: string;
  check_out: string;
  status: string;
  late_minutes: number;
  overtime_minutes: number;
  is_regularized: boolean;
  employees?: {
    first_name: string;
    last_name: string;
    employee_id: string;
  };
  // Additional fields from raw attendance
  raw_attendance_id?: number;
  sn?: string;
  stamp?: string;
}

// Cache for employee mapping to avoid repeated lookups
let employeeMappingCache: Map<number, { uuid: string; employee: Employee }> | null = null;

/**
 * Batch maps multiple integer employee_ids to UUIDs at once
 * This is much more efficient than calling mapEmployeeIdToUuid individually
 */
async function batchMapIntegerIdsToUuids(
  integerIds: number[],
  employees: Employee[]
): Promise<Map<number, string>> {
  const mapping = new Map<number, string>();
  
  // Build lookup maps from employees
  const externalIdMap = new Map<number, string>(); // external_id -> uuid
  const employeeIdTextMap = new Map<number, string>(); // extracted number -> uuid
  
  employees.forEach(emp => {
    // Try external_id first
    const externalId = (emp as any).external_id;
    if (externalId && !isNaN(Number(externalId))) {
      externalIdMap.set(Number(externalId), emp.id);
    }
    
    // Try to extract number from employee_id text
    const employeeIdText = emp.employee_id || (emp as any).employeeId || '';
    const match = employeeIdText.match(/\d+/);
    if (match) {
      const extractedNumber = parseInt(match[0], 10);
      if (!employeeIdTextMap.has(extractedNumber)) {
        employeeIdTextMap.set(extractedNumber, emp.id);
      }
    } else if (!isNaN(Number(employeeIdText))) {
      const numId = Number(employeeIdText);
      if (!employeeIdTextMap.has(numId)) {
        employeeIdTextMap.set(numId, emp.id);
      }
    }
  });
  
  // Map each integer ID to UUID
  for (const integerId of integerIds) {
    // Try external_id first
    if (externalIdMap.has(integerId)) {
      mapping.set(integerId, externalIdMap.get(integerId)!);
      continue;
    }
    
    // Try employee_id text extraction
    if (employeeIdTextMap.has(integerId)) {
      mapping.set(integerId, employeeIdTextMap.get(integerId)!);
      continue;
    }
    
    // If not found, mark as unknown
    mapping.set(integerId, `unknown-${integerId}`);
  }
  
  return mapping;
}

/**
 * Maps integer employee_id from attendances table to UUID from employees table
 * Strategy:
 * 1. Try to match with external_id field in employees
 * 2. Try to extract number from employee_id text (e.g., "EMP-1234" -> 1234)
 * 3. Use a direct mapping if available
 */
async function mapEmployeeIdToUuid(integerEmployeeId: number, employees?: Employee[]): Promise<string | null> {
  try {
    // Use provided employees or initialize cache if needed
    let employeesToUse = employees;
    if (!employeesToUse && !employeeMappingCache) {
      employeeMappingCache = new Map();
      employeesToUse = await employeeService.getAll();
    } else if (!employeesToUse) {
      // Use cached employees if available
      employeesToUse = [];
    }
    
    // Build mapping cache if not already built
    if (employeesToUse && employeesToUse.length > 0 && (!employeeMappingCache || employeeMappingCache.size === 0)) {
      if (!employeeMappingCache) {
        employeeMappingCache = new Map();
      }
      
      // Build mapping cache from provided employees
      employeesToUse.forEach(emp => {
        // Try external_id first
        const externalId = (emp as any).external_id;
        if (externalId && !isNaN(Number(externalId))) {
          const numId = Number(externalId);
          if (!employeeMappingCache!.has(numId)) {
            employeeMappingCache!.set(numId, { uuid: emp.id, employee: emp });
          }
        }
        
        // Try to extract number from employee_id text
        const employeeIdText = emp.employee_id || emp.employeeId || '';
        const match = employeeIdText.match(/\d+/);
        if (match) {
          const extractedNumber = parseInt(match[0], 10);
          if (!employeeMappingCache!.has(extractedNumber)) {
            employeeMappingCache!.set(extractedNumber, { uuid: emp.id, employee: emp });
          }
        } else if (!isNaN(Number(employeeIdText))) {
          const numId = Number(employeeIdText);
          if (!employeeMappingCache!.has(numId)) {
            employeeMappingCache!.set(numId, { uuid: emp.id, employee: emp });
          }
        }
      });
    }
    
    // Return cached mapping
    const cached = employeeMappingCache?.get(integerEmployeeId);
    if (cached) {
      return cached.uuid;
    }
    
    // Don't make individual queries - the batch function should handle all mappings
    // If we get here, the employee wasn't found in the initial employee list
    return null;
  } catch (error) {
    console.error('Error mapping employee ID:', error);
    return null;
  }
}

/**
 * Gets the expected start and end times for an employee on a specific day
 * Uses the working hours from employee_working_hours table
 */
async function getEmployeeShiftTimes(employeeId: string | number, date: Date): Promise<{ startTime: string | null; endTime: string | null }> {
  try {
    let uuid: string;
    
    // If employeeId is a number (integer from attendances table), map it to UUID
    if (typeof employeeId === 'number') {
      const mappedUuid = await mapEmployeeIdToUuid(employeeId);
      if (!mappedUuid) {
        console.warn(`Could not find UUID for integer employee_id: ${employeeId}`);
        return { startTime: null, endTime: null };
      }
      uuid = mappedUuid;
    } else {
      uuid = employeeId;
    }
    
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = date.getDay();
    
    // Fetch employee shifts for this day from the new employee_shifts table
    const shifts = await companySettingsService.getEmployeeShifts(uuid, dayOfWeek);
    
    // If shifts found, use them (supports multiple shifts per day)
    if (shifts && shifts.length > 0) {
      // Sort shifts by start time
      const sortedShifts = shifts.sort((a, b) => {
        const aStart = a.start_time.split(':').map(Number);
        const bStart = b.start_time.split(':').map(Number);
        return (aStart[0] * 60 + aStart[1]) - (bStart[0] * 60 + bStart[1]);
      });
      
      // Use the earliest start time and latest end time
      const firstShift = sortedShifts[0];
      const lastShift = sortedShifts[sortedShifts.length - 1];
      
      return {
        startTime: firstShift.start_time,
        endTime: lastShift.end_time
      };
    }
    
    // Fallback to old working hours system if no shifts found
    const workingHours = await companySettingsService.getEmployeeWorkingHours(uuid);
    if (!workingHours || !workingHours.is_active) {
      return { startTime: null, endTime: null };
    }
    
    // Map to our weekday fields
    let dayHours = 0;
    switch (dayOfWeek) {
      case 0: dayHours = workingHours.sunday_hours || 0; break;
      case 1: dayHours = workingHours.monday_hours || 0; break;
      case 2: dayHours = workingHours.tuesday_hours || 0; break;
      case 3: dayHours = workingHours.wednesday_hours || 0; break;
      case 4: dayHours = workingHours.thursday_hours || 0; break;
      case 5: dayHours = workingHours.friday_hours || 0; break;
      case 6: dayHours = workingHours.saturday_hours || 0; break;
    }
    
    // If no hours for this day, return null
    if (dayHours === 0) {
      return { startTime: null, endTime: null };
    }
    
    // Use start_time and end_time from working hours
    if (workingHours.start_time && workingHours.end_time) {
      return {
        startTime: workingHours.start_time,
        endTime: workingHours.end_time
      };
    }
    
    // Fallback: calculate from hours if start_time not set
    const startTime = '09:00:00';
    const [startHour, startMin] = startTime.split(':').map(Number);
    const breakMinutes = workingHours.break_duration_minutes || 60;
    const totalMinutes = (dayHours * 60) + breakMinutes;
    const endHour = Math.floor((startHour * 60 + startMin + totalMinutes) / 60);
    const endMin = (startHour * 60 + startMin + totalMinutes) % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
    
    return { startTime, endTime };
  } catch (error) {
    console.error('Error getting employee shift times:', error);
    return { startTime: null, endTime: null };
  }
}

/**
 * Gets shift times from cached data instead of making API calls
 */
function getShiftTimesFromCache(
  employeeUuid: string,
  date: Date,
  shiftsMap: Map<string, Map<number, EmployeeShift[]>>,
  workingHoursMap: Map<string, EmployeeWorkingHours>
): { startTime: string | null; endTime: string | null } {
  const dayOfWeek = date.getDay();
  
  // Try to get from cached shifts first
  const employeeShifts = shiftsMap.get(employeeUuid);
  if (employeeShifts) {
    const dayShifts = employeeShifts.get(dayOfWeek);
    if (dayShifts && dayShifts.length > 0) {
      // Sort shifts by start time
      const sortedShifts = [...dayShifts].sort((a, b) => {
        const aStart = a.start_time.split(':').map(Number);
        const bStart = b.start_time.split(':').map(Number);
        return (aStart[0] * 60 + aStart[1]) - (bStart[0] * 60 + bStart[1]);
      });
      
      const firstShift = sortedShifts[0];
      const lastShift = sortedShifts[sortedShifts.length - 1];
      
      return {
        startTime: firstShift.start_time,
        endTime: lastShift.end_time
      };
    }
  }
  
  // Fallback to cached working hours
  const workingHours = workingHoursMap.get(employeeUuid);
  if (workingHours && workingHours.is_active) {
    let dayHours = 0;
    switch (dayOfWeek) {
      case 0: dayHours = workingHours.sunday_hours || 0; break;
      case 1: dayHours = workingHours.monday_hours || 0; break;
      case 2: dayHours = workingHours.tuesday_hours || 0; break;
      case 3: dayHours = workingHours.wednesday_hours || 0; break;
      case 4: dayHours = workingHours.thursday_hours || 0; break;
      case 5: dayHours = workingHours.friday_hours || 0; break;
      case 6: dayHours = workingHours.saturday_hours || 0; break;
    }
    
    if (dayHours === 0) {
      return { startTime: null, endTime: null };
    }
    
    if (workingHours.start_time && workingHours.end_time) {
      return {
        startTime: workingHours.start_time,
        endTime: workingHours.end_time
      };
    }
    
    // Calculate from hours
    const startTime = '09:00:00';
    const [startHour, startMin] = startTime.split(':').map(Number);
    const breakMinutes = workingHours.break_duration_minutes || 60;
    const totalMinutes = (dayHours * 60) + breakMinutes;
    const endHour = Math.floor((startHour * 60 + startMin + totalMinutes) / 60);
    const endMin = (startHour * 60 + startMin + totalMinutes) % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
    
    return { startTime, endTime };
  }
  
  return { startTime: null, endTime: null };
}

/**
 * Transforms raw attendance data into AttendanceLog format (with cached shifts/working hours)
 */
function transformRawAttendanceWithCache(
  raw: RawAttendance,
  employeeUuid: string | null,
  employee: Employee | undefined,
  shiftsMap: Map<string, Map<number, EmployeeShift[]>>,
  workingHoursMap: Map<string, EmployeeWorkingHours>
): AttendanceLog {
  const date = new Date(raw.timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = raw.timestamp;
  
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  
  const hour = date.getHours();
  const isMorning = hour < 12;
  
  // Determine check-in or check-out based on status flags
  // status1 = true means check-in, status2 = true means check-out
  // If both are true, determine based on time of day and context
  if (raw.status1 === true && raw.status2 === true) {
    // Both flags set - this is ambiguous, use time of day to determine
    // Morning/early day (< 14:00 / 2 PM) = likely check-in
    // Afternoon/evening (>= 14:00 / 2 PM) = likely check-out
    if (hour < 14) {
      checkIn = timeStr;
    } else {
      checkOut = timeStr;
    }
  } else if (raw.status1 === true) {
    // Explicit check-in flag
    checkIn = timeStr;
  } else if (raw.status2 === true) {
    // Explicit check-out flag
    checkOut = timeStr;
  } else {
    // Fallback: use time of day as heuristic
    // Morning (< 12:00) = likely check-in, Afternoon (>= 12:00) = likely check-out
    if (isMorning) {
      checkIn = timeStr;
    } else {
      checkOut = timeStr;
    }
  }
  
  let status = 'Present';
  if (!checkIn && !checkOut) {
    status = 'Absent';
  }
  
  let lateMinutes = 0;
  let overtimeMinutes = 0;
  
  if (employeeUuid && !employeeUuid.startsWith('unknown-')) {
    const shiftTimes = getShiftTimesFromCache(employeeUuid, date, shiftsMap, workingHoursMap);
    
    if (checkIn && shiftTimes.startTime) {
      const checkInTime = new Date(checkIn);
      const [expectedHour, expectedMin] = shiftTimes.startTime.split(':').map(Number);
      const expectedTime = new Date(date);
      expectedTime.setHours(expectedHour, expectedMin, 0, 0);
      
      if (checkInTime > expectedTime) {
        lateMinutes = Math.floor((checkInTime.getTime() - expectedTime.getTime()) / (1000 * 60));
        if (lateMinutes > LATE_TOLERANCE_MINUTES && status === 'Present') status = 'Late';
      }
    }
    
    if (checkOut && shiftTimes.endTime) {
      const checkOutTime = new Date(checkOut);
      const [expectedHour, expectedMin] = shiftTimes.endTime.split(':').map(Number);
      const expectedTime = new Date(date);
      expectedTime.setHours(expectedHour, expectedMin, 0, 0);
      
      if (checkOutTime > expectedTime) {
        overtimeMinutes = Math.floor((checkOutTime.getTime() - expectedTime.getTime()) / (1000 * 60));
      }
    }
  } else {
    // Fallback to old logic
    if (checkIn) {
      const checkInTime = new Date(checkIn);
      if (checkInTime.getHours() > 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() > LATE_TOLERANCE_MINUTES)) {
        lateMinutes = (checkInTime.getHours() - 9) * 60 + checkInTime.getMinutes();
        if (status === 'Present') status = 'Late';
      }
    }
    
    if (checkOut) {
      const checkOutTime = new Date(checkOut);
      if (checkOutTime.getHours() > 17 || (checkOutTime.getHours() === 17 && checkOutTime.getMinutes() > 0)) {
        overtimeMinutes = (checkOutTime.getHours() - 17) * 60 + checkOutTime.getMinutes();
      }
    }
  }
  
  return {
    id: `attendance-${raw.id}`,
    employee_id: employeeUuid || `unknown-${raw.employee_id}`,
    date: dateStr,
    check_in: checkIn || '',
    check_out: checkOut || '',
    status,
    late_minutes: lateMinutes,
    overtime_minutes: overtimeMinutes,
    is_regularized: false,
    employees: employee ? {
      first_name: employee.first_name || employee.firstName || '',
      last_name: employee.last_name || employee.lastName || '',
      employee_id: employee.employee_id || employee.employeeId || ''
    } : undefined,
    raw_attendance_id: raw.id,
    sn: raw.sn,
    stamp: raw.stamp
  };
}

/**
 * Transforms raw attendance data into AttendanceLog format
 * The attendances table has status1-5 which might represent different punch types
 * Each record represents a single punch event. We'll create individual records
 * and aggregate them later by date.
 * Legacy version that makes individual API calls (kept for backward compatibility)
 */
async function transformRawAttendance(raw: RawAttendance, employeeUuid: string | null, employee?: Employee): Promise<AttendanceLog> {
  const date = new Date(raw.timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = raw.timestamp;
  
  // Determine if this is a check-in or check-out based on status flags and time
  // Common patterns:
  // - status1 = true usually means check-in
  // - status2 = true usually means check-out
  // - If unclear, use time: morning (< 12:00) = check-in, afternoon (>= 12:00) = check-out
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  
  const hour = date.getHours();
  const isMorning = hour < 12;
  
  // Determine check-in or check-out based on status flags
  // status1 = true means check-in, status2 = true means check-out
  // If both are true, determine based on time of day and context
  if (raw.status1 === true && raw.status2 === true) {
    // Both flags set - this is ambiguous, use time of day to determine
    // Morning/early day (< 14:00 / 2 PM) = likely check-in
    // Afternoon/evening (>= 14:00 / 2 PM) = likely check-out
    if (hour < 14) {
      checkIn = timeStr;
    } else {
      checkOut = timeStr;
    }
  } else if (raw.status1 === true) {
    // Explicit check-in flag
    checkIn = timeStr;
  } else if (raw.status2 === true) {
    // Explicit check-out flag
    checkOut = timeStr;
  } else {
    // Fallback: use time of day as heuristic
    // Morning (< 12:00) = likely check-in, Afternoon (>= 12:00) = likely check-out
    if (isMorning) {
      checkIn = timeStr;
    } else {
      checkOut = timeStr;
    }
  }
  
  // Calculate status (will be refined during aggregation)
  let status = 'Present';
  if (!checkIn && !checkOut) {
    status = 'Absent';
  }
  
  // Calculate late and overtime based on employee working hours
  let lateMinutes = 0;
  let overtimeMinutes = 0;
  
  if (employeeUuid && !employeeUuid.startsWith('unknown-')) {
    // Use the integer employee_id from raw attendance to get shift times
    // This ensures we're using the correct employee mapping
    const shiftTimes = await getEmployeeShiftTimes(raw.employee_id, date);
    
    if (checkIn && shiftTimes.startTime) {
      const checkInTime = new Date(checkIn);
      const [expectedHour, expectedMin] = shiftTimes.startTime.split(':').map(Number);
      const expectedTime = new Date(date);
      expectedTime.setHours(expectedHour, expectedMin, 0, 0);
      
      if (checkInTime > expectedTime) {
        lateMinutes = Math.floor((checkInTime.getTime() - expectedTime.getTime()) / (1000 * 60));
        if (lateMinutes > LATE_TOLERANCE_MINUTES && status === 'Present') status = 'Late';
      }
    }
    
    if (checkOut && shiftTimes.endTime) {
      const checkOutTime = new Date(checkOut);
      const [expectedHour, expectedMin] = shiftTimes.endTime.split(':').map(Number);
      const expectedTime = new Date(date);
      expectedTime.setHours(expectedHour, expectedMin, 0, 0);
      
      if (checkOutTime > expectedTime) {
        overtimeMinutes = Math.floor((checkOutTime.getTime() - expectedTime.getTime()) / (1000 * 60));
      }
    }
  } else {
    // Fallback to old logic if no working hours available
    if (checkIn) {
      const checkInTime = new Date(checkIn);
      if (checkInTime.getHours() > 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() > LATE_TOLERANCE_MINUTES)) {
        lateMinutes = (checkInTime.getHours() - 9) * 60 + checkInTime.getMinutes();
        if (status === 'Present') status = 'Late';
      }
    }
    
    if (checkOut) {
      const checkOutTime = new Date(checkOut);
      if (checkOutTime.getHours() > 17 || (checkOutTime.getHours() === 17 && checkOutTime.getMinutes() > 0)) {
        overtimeMinutes = (checkOutTime.getHours() - 17) * 60 + checkOutTime.getMinutes();
      }
    }
  }
  
  return {
    id: `attendance-${raw.id}`,
    employee_id: employeeUuid || `unknown-${raw.employee_id}`,
    date: dateStr,
    check_in: checkIn || '',
    check_out: checkOut || '',
    status,
    late_minutes: lateMinutes,
    overtime_minutes: overtimeMinutes,
    is_regularized: false,
    employees: employee ? {
      first_name: employee.first_name || employee.firstName || '',
      last_name: employee.last_name || employee.lastName || '',
      employee_id: employee.employee_id || employee.employeeId || ''
    } : undefined,
    raw_attendance_id: raw.id,
    sn: raw.sn,
    stamp: raw.stamp
  };
}

/**
 * Aggregates multiple attendance records for the same employee and date
 * into a single record with check-in (earliest) and check-out (latest)
 * Handles multiple shifts: if 4 entries (2 check-ins + 2 check-outs), creates 2 records
 * Uses shift information to group check-outs that belong to the same shift
 */
function aggregateAttendanceRecords(
  records: AttendanceLog[],
  shiftsMap?: Map<string, Map<number, EmployeeShift[]>>,
  workingHoursMap?: Map<string, EmployeeWorkingHours>
): AttendanceLog[] {
  const grouped = new Map<string, AttendanceLog[]>();
  
  // Group by employee_id and date
  records.forEach(record => {
    const key = `${record.employee_id}-${record.date}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(record);
  });
  
  // Aggregate each group
  const aggregated: AttendanceLog[] = [];
  grouped.forEach((group, key) => {
    // Collect all timestamps and classify them as check-ins or check-outs
    const allTimestamps: Array<{ time: string; type: 'check_in' | 'check_out'; record: AttendanceLog }> = [];
    
    group.forEach(record => {
      if (record.check_in && record.check_in.trim() !== '') {
        allTimestamps.push({ time: record.check_in, type: 'check_in', record });
      }
      if (record.check_out && record.check_out.trim() !== '' && record.check_out !== record.check_in) {
        allTimestamps.push({ time: record.check_out, type: 'check_out', record });
      }
    });
    
    // Sort all timestamps chronologically
    allTimestamps.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    
    // If only one record, handle it specially
    // Rule: Single entry should always be treated as check-in (not check-out)
    if (group.length === 1) {
      const record = group[0];
      // If both check-in and check-out are set to the same value, it's likely a bug
      if (record.check_in && record.check_out && record.check_in === record.check_out) {
        // Both are the same - treat as check-in
        const fixedRecord: AttendanceLog = {
          ...record,
          check_in: record.check_in,
          check_out: ''
        };
        aggregated.push(fixedRecord);
        return;
      }
      // Single record: if it has check-out but no check-in, treat the check-out as check-in
      // If it has check-in, use it as-is
      if (record.check_out && !record.check_in) {
        // Only check-out exists - treat it as check-in
        const fixedRecord: AttendanceLog = {
          ...record,
          check_in: record.check_out,
          check_out: ''
        };
        aggregated.push(fixedRecord);
        return;
      }
      // Normal single record with check-in - use as-is
      aggregated.push(record);
      return;
    }
    
    if (allTimestamps.length === 0) {
      // No valid timestamps, skip
      return;
    }
    
    // Separate check-ins and check-outs, removing duplicates
    const checkIns: string[] = [];
    const checkOuts: string[] = [];
    const seenTimes = new Set<string>();
    
    allTimestamps.forEach(({ time, type }) => {
      if (!seenTimes.has(time)) {
        seenTimes.add(time);
        if (type === 'check_in') {
          checkIns.push(time);
        } else {
          checkOuts.push(time);
        }
      }
    });
    
    // Get metadata from first record
    const firstRecord = group[0];
    const employeeInfo = firstRecord.employees;
    const rawAttendanceId = firstRecord.raw_attendance_id;
    const sn = firstRecord.sn;
    const stamp = firstRecord.stamp;
    
    // Calculate late and overtime from records
    let totalLateMinutes = 0;
    let totalOvertimeMinutes = 0;
    group.forEach(record => {
      if (record.late_minutes > 0) {
        totalLateMinutes = Math.max(totalLateMinutes, record.late_minutes);
      }
      if (record.overtime_minutes > 0) {
        totalOvertimeMinutes = Math.max(totalOvertimeMinutes, record.overtime_minutes);
      }
    });
      
    // Smart pairing algorithm for multiple shifts
    // Pair check-ins with check-outs based on time proximity and logical order
    const shifts: Array<{ check_in: string; check_out: string }> = [];
    const usedCheckIns = new Set<number>();
    const usedCheckOuts = new Set<number>();
    
    // First pass: pair check-ins with check-outs that come after them
    checkIns.forEach((checkIn, ciIndex) => {
      let bestCheckOut: { index: number; time: string; gap: number } | null = null;
      
      // Find the closest check-out after this check-in (within reasonable time, e.g., 12 hours)
      checkOuts.forEach((checkOut, coIndex) => {
        if (usedCheckOuts.has(coIndex)) return;
        
        const checkInTime = new Date(checkIn).getTime();
        const checkOutTime = new Date(checkOut).getTime();
        const gap = checkOutTime - checkInTime;
        
        // Check-out must be after check-in, and within 12 hours
        if (gap > 0 && gap < 12 * 60 * 60 * 1000) {
          if (!bestCheckOut || gap < bestCheckOut.gap) {
            bestCheckOut = { index: coIndex, time: checkOut, gap };
          }
        }
      });
      
      if (bestCheckOut) {
        shifts.push({ check_in: checkIn, check_out: bestCheckOut.time });
        usedCheckIns.add(ciIndex);
        usedCheckOuts.add(bestCheckOut.index);
      }
    });
    
    // Second pass: handle remaining check-outs (orphan check-outs)
    // But first, try to group orphan check-outs by shift windows before pairing individually
    const orphanCheckOuts: Array<{ index: number; time: string }> = [];
    checkOuts.forEach((checkOut, coIndex) => {
      if (!usedCheckOuts.has(coIndex)) {
        orphanCheckOuts.push({ index: coIndex, time: checkOut });
      }
    });
    
    // If we have orphan check-outs and shift information, try to group them by shift first
    if (orphanCheckOuts.length > 0 && firstRecord.employee_id && !firstRecord.employee_id.startsWith('unknown-')) {
      const employeeUuid = firstRecord.employee_id;
      const recordDate = new Date(firstRecord.date);
      const dayOfWeek = recordDate.getDay();
      
      let employeeShifts: EmployeeShift[] = [];
      if (shiftsMap) {
        const empShifts = shiftsMap.get(employeeUuid);
        if (empShifts) {
          employeeShifts = empShifts.get(dayOfWeek) || [];
        }
      }
      
      // Group orphan check-outs by shift windows
      if (employeeShifts.length > 0) {
        const sortedShifts = [...employeeShifts].sort((a, b) => {
          const aStart = a.start_time.split(':').map(Number);
          const bStart = b.start_time.split(':').map(Number);
          return (aStart[0] * 60 + aStart[1]) - (bStart[0] * 60 + bStart[1]);
        });
        
        sortedShifts.forEach((shift) => {
          const [shiftStartHour, shiftStartMin] = shift.start_time.split(':').map(Number);
          const [shiftEndHour, shiftEndMin] = shift.end_time.split(':').map(Number);
          
          const shiftStart = new Date(recordDate);
          shiftStart.setHours(shiftStartHour, shiftStartMin, 0, 0);
          
          const shiftEnd = new Date(recordDate);
          shiftEnd.setHours(shiftEndHour, shiftEndMin, 0, 0);
          if (shiftEnd <= shiftStart) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
          }
          
          // Allow check-outs within shift window + 3 hours tolerance on each side
          // This handles cases where check-ins happen before shift start (e.g., 7 AM for a 10 AM shift)
          const shiftStartWithTolerance = new Date(shiftStart);
          shiftStartWithTolerance.setHours(shiftStartWithTolerance.getHours() - 3);
          const shiftEndWithTolerance = new Date(shiftEnd);
          shiftEndWithTolerance.setHours(shiftEndWithTolerance.getHours() + 3);
          
          // Find check-outs in this shift window
          const checkOutsInShift = orphanCheckOuts.filter(({ time }) => {
            const checkOutTime = new Date(time);
            return checkOutTime >= shiftStartWithTolerance && checkOutTime <= shiftEndWithTolerance;
          });
          
          // If multiple check-outs in same shift, combine them into one shift entry
          if (checkOutsInShift.length >= 2) {
            checkOutsInShift.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
            // Use earliest as check-in, latest as check-out
            // This handles the case where check-in record is missing but we have multiple check-outs
            shifts.push({ 
              check_in: checkOutsInShift[0].time, 
              check_out: checkOutsInShift[checkOutsInShift.length - 1].time 
            });
            // Mark as used
            checkOutsInShift.forEach(({ index }) => usedCheckOuts.add(index));
          } else if (checkOutsInShift.length === 1) {
            // Single check-out in shift - determine if it's check-in or check-out
            const checkOutTime = new Date(checkOutsInShift[0].time);
            const timeInMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes();
            const shiftStartMinutes = shiftStartHour * 60 + shiftStartMin;
            const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;
            
            // Check if there's already a completed shift before this time
            const hasCompletedShiftBefore = shifts.some(s => {
              if (s.check_in && s.check_out) {
                const shiftEnd = new Date(s.check_out);
                return shiftEnd.getTime() < checkOutTime.getTime();
              }
              return false;
            });
            
            // If there's a completed shift before and this time is near shift start, treat as check-in
            // Otherwise, if it's near shift end, treat as check-out
            if (hasCompletedShiftBefore && timeInMinutes <= shiftStartMinutes + 60) {
              // Near shift start and there's a previous shift - treat as check-in for new shift
              shifts.push({ check_in: checkOutsInShift[0].time, check_out: '' });
              usedCheckOuts.add(checkOutsInShift[0].index);
            } else if (timeInMinutes >= shiftEndMinutes - 60) {
              // Near shift end, treat as check-out only
              shifts.push({ check_in: '', check_out: checkOutsInShift[0].time });
              usedCheckOuts.add(checkOutsInShift[0].index);
            } else {
              // Ambiguous - if there's a completed shift before, treat as check-in; otherwise check-out
              if (hasCompletedShiftBefore) {
                shifts.push({ check_in: checkOutsInShift[0].time, check_out: '' });
              } else {
                shifts.push({ check_in: '', check_out: checkOutsInShift[0].time });
              }
              usedCheckOuts.add(checkOutsInShift[0].index);
            }
          }
        });
      }
    }
    
    // Now handle remaining orphan check-outs that weren't grouped by shift
    // If we have multiple orphan check-outs, combine them into a single shift
    // Rule: If there are only check-outs (no check-ins), treat first as check-in, last as check-out
    const remainingOrphanCheckOuts = orphanCheckOuts.filter(({ index }) => !usedCheckOuts.has(index));
    if (remainingOrphanCheckOuts.length >= 2) {
      // Sort by time
      remainingOrphanCheckOuts.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      // If we have NO check-ins at all, always combine check-outs into one shift
      // Otherwise, check if they're within 12 hours of each other (likely same shift)
      const firstTime = new Date(remainingOrphanCheckOuts[0].time).getTime();
      const lastTime = new Date(remainingOrphanCheckOuts[remainingOrphanCheckOuts.length - 1].time).getTime();
      const timeSpan = lastTime - firstTime;
      
      // If no check-ins exist, or if within 12 hours, combine them into one shift
      if (checkIns.length === 0 || timeSpan <= 12 * 60 * 60 * 1000) {
        shifts.push({ 
          check_in: remainingOrphanCheckOuts[0].time, 
          check_out: remainingOrphanCheckOuts[remainingOrphanCheckOuts.length - 1].time 
        });
        remainingOrphanCheckOuts.forEach(({ index }) => usedCheckOuts.add(index));
      }
    }
    
    // Handle individual remaining orphan check-outs
    remainingOrphanCheckOuts.forEach(({ index: coIndex, time: checkOut }) => {
      if (!usedCheckOuts.has(coIndex)) {
        // Try to find a check-in before this check-out that wasn't used
        let bestCheckIn: { index: number; time: string; gap: number } | null = null;
        
        checkIns.forEach((checkIn, ciIndex) => {
          if (usedCheckIns.has(ciIndex)) return;
          
          const checkInTime = new Date(checkIn).getTime();
          const checkOutTime = new Date(checkOut).getTime();
          const gap = checkOutTime - checkInTime;
          
          // Check-in must be before check-out, and within 12 hours
          if (gap > 0 && gap < 12 * 60 * 60 * 1000) {
            if (!bestCheckIn || gap < bestCheckIn.gap) {
              bestCheckIn = { index: ciIndex, time: checkIn, gap };
            }
          }
        });
        
        if (bestCheckIn) {
          shifts.push({ check_in: bestCheckIn.time, check_out: checkOut });
          usedCheckIns.add(bestCheckIn.index);
          usedCheckOuts.add(coIndex);
        } else {
          // Orphan check-out - check if there's a completed shift before this time
          // If yes, treat this as check-in for a new shift; otherwise treat as check-out
          const checkOutTime = new Date(checkOut).getTime();
          const hasCompletedShiftBefore = shifts.some(s => {
            if (s.check_in && s.check_out) {
              const shiftEnd = new Date(s.check_out);
              // If there's a gap of more than 2 hours, this is likely a new shift
              return (checkOutTime - shiftEnd.getTime()) > 2 * 60 * 60 * 1000;
            }
            return false;
          });
          
          if (hasCompletedShiftBefore) {
            // There's a completed shift before with significant gap - treat as check-in for new shift
            shifts.push({ check_in: checkOut, check_out: '' });
          } else {
            // No completed shift before - treat as check-out only
            shifts.push({ check_in: '', check_out: checkOut });
          }
        }
      }
    });
    
    // Third pass: handle remaining check-ins (orphan check-ins)
    checkIns.forEach((checkIn, ciIndex) => {
      if (!usedCheckIns.has(ciIndex)) {
        shifts.push({ check_in: checkIn, check_out: '' });
      }
    });
    
    
    // Sort shifts by check-in time (or check-out time if no check-in)
    shifts.sort((a, b) => {
      const timeA = a.check_in ? new Date(a.check_in).getTime() : new Date(a.check_out).getTime();
      const timeB = b.check_in ? new Date(b.check_in).getTime() : new Date(b.check_out).getTime();
      return timeA - timeB;
    });
    
    // Create attendance records for each shift
    shifts.forEach((shift, index) => {
      const shiftRecord: AttendanceLog = {
        ...firstRecord,
        id: `aggregated-${firstRecord.employee_id}-${firstRecord.date}-shift${index + 1}`,
        check_in: shift.check_in,
        check_out: shift.check_out,
        status: shift.check_in ? (index === 0 && totalLateMinutes > 0 ? 'Late' : 'Present') : 'Present',
        late_minutes: index === 0 ? totalLateMinutes : 0,
        overtime_minutes: index === shifts.length - 1 ? totalOvertimeMinutes : 0,
        employees: employeeInfo || firstRecord.employees,
        raw_attendance_id: rawAttendanceId || firstRecord.raw_attendance_id,
        sn: sn || firstRecord.sn,
        stamp: stamp || firstRecord.stamp
      };
      aggregated.push(shiftRecord);
    });
  });
  
  return aggregated;
}

export interface AttendanceFilters {
  employeeName?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  hasLate?: 'all' | 'yes' | 'no';
  hasOvertime?: 'all' | 'yes' | 'no';
  minLateMinutes?: number;
  minOvertimeMinutes?: number;
  employeeIds?: number[]; // Integer employee IDs from attendances table
  companyId?: string; // Filter by company ID (for admin users)
  page?: number;
  limit?: number;
}

export interface AttendanceResponse {
  data: AttendanceLog[];
  totalCount: number;
}

export const attendanceService = {
  /**
   * Get all attendance records from the attendances table
   * Maps integer employee_id to UUID and aggregates records by date
   * Optimized to fetch all shifts and working hours in batch
   * Supports filtering and pagination
   */
  async getAll(filters?: AttendanceFilters): Promise<AttendanceResponse> {
    try {
      // Build query parameters for Supabase REST API
      const params: any = {
        select: '*',
        order: 'timestamp.desc'
      };
      
      // Apply date range filter on timestamp field.
      // PostgREST accepts multiple filters on the same column: send both gte and lte so the server returns only records in range.
      const dateFromISO = filters?.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`).toISOString() : null;
      const dateToISO = filters?.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`).toISOString() : null;
      if (dateFromISO && dateToISO) {
        params.timestamp = [`gte.${dateFromISO}`, `lte.${dateToISO}`];
      } else if (dateFromISO) {
        params.timestamp = `gte.${dateFromISO}`;
      } else if (dateToISO) {
        params.timestamp = `lte.${dateToISO}`;
      }
      
      // Filter by employee IDs (integer IDs from attendances table)
      if (filters?.employeeIds && filters.employeeIds.length > 0) {
        if (filters.employeeIds.length === 1) {
          params.employee_id = `eq.${filters.employeeIds[0]}`;
        } else {
          params.employee_id = `in.(${filters.employeeIds.join(',')})`;
        }
      }
      
      // IMPORTANT: Fetch ALL records first (without pagination) to ensure proper aggregation
      // We need all records for the date range to aggregate check-ins and check-outs correctly
      // Set a high limit to get all records, then paginate after aggregation
      params.limit = 10000; // Fetch up to 10,000 records for aggregation
      params.offset = 0; // Start from beginning
      
      // Serialize params so multiple values for the same key (e.g. timestamp=gte & timestamp=lte) are sent as repeated keys, not as timestamp[]=...
      const paramsSerializer = (p: Record<string, unknown>) =>
        Object.entries(p).flatMap(([k, v]) =>
          Array.isArray(v)
            ? v.map((val) => `${encodeURIComponent(k)}=${encodeURIComponent(String(val))}`)
            : [`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`]
        ).join('&');

      // Fetch attendance records with filters (all records, no pagination yet)
      // Request total count in headers
      const response = await adminApi.get<RawAttendance[]>('/attendances', { 
        params,
        paramsSerializer,
        headers: {
          'Prefer': 'count=exact'
        }
      });
      const rawRecords = response.data || [];
      
      // Get total count from Content-Range header
      const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
      let totalRawCount = rawRecords.length;
      if (contentRange) {
        // Format: "0-9/100" means items 0-9 of 100 total
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          totalRawCount = parseInt(match[1], 10);
        }
      }
      
      // Apply dateTo filter on client side if dateFrom is also set
      let recordsToProcess = rawRecords;
      if (filters?.dateFrom && filters?.dateTo) {
        const dateToTimestamp = new Date(`${filters.dateTo}T23:59:59.999Z`).getTime();
        recordsToProcess = rawRecords.filter(raw => {
          const recordTimestamp = new Date(raw.timestamp).getTime();
          return recordTimestamp <= dateToTimestamp;
        });
        // Note: Total count might be slightly off after client-side filtering
        // For accurate count with date range, we'd need a separate count query
      }
      
      // Fetch all employees for mapping (only once)
      // Filter by company_id if provided (for admin users to see only their company's employees)
      const employees = await employeeService.getAll(filters?.companyId);
      const employeeMap = new Map<string, Employee>();
      employees.forEach(emp => {
        employeeMap.set(emp.id, emp);
      });
      
      // Initialize the employee mapping cache to avoid individual API calls
      if (!employeeMappingCache || employeeMappingCache.size === 0) {
        employeeMappingCache = new Map();
        // Pre-populate cache from employees list
        employees.forEach(emp => {
          const externalId = (emp as any).external_id;
          if (externalId && !isNaN(Number(externalId))) {
            const numId = Number(externalId);
            if (!employeeMappingCache!.has(numId)) {
              employeeMappingCache!.set(numId, { uuid: emp.id, employee: emp });
            }
          }
          
          const employeeIdText = emp.employee_id || (emp as any).employeeId || '';
          const match = employeeIdText.match(/\d+/);
          if (match) {
            const extractedNumber = parseInt(match[0], 10);
            if (!employeeMappingCache!.has(extractedNumber)) {
              employeeMappingCache!.set(extractedNumber, { uuid: emp.id, employee: emp });
            }
          } else if (!isNaN(Number(employeeIdText))) {
            const numId = Number(employeeIdText);
            if (!employeeMappingCache!.has(numId)) {
              employeeMappingCache!.set(numId, { uuid: emp.id, employee: emp });
            }
          }
        });
      }
      
      // Build employee UUID mapping for all unique integer employee_ids
      // Batch map all integer IDs to UUIDs at once
      const uniqueIntegerIds = [...new Set(rawRecords.map(r => r.employee_id))];
      const employeeUuidMap = await batchMapIntegerIdsToUuids(uniqueIntegerIds, employees);
      
      // Get all unique employee UUIDs (excluding unknown ones)
      const uniqueUuids = [...new Set([...employeeUuidMap.values()].filter(u => !u.startsWith('unknown-')))];
      
      // Batch fetch all employee shifts at once using Supabase's `in` filter
      // Filter by company_id if provided to ensure we only get shifts for the current company
      const shiftsMap = new Map<string, Map<number, EmployeeShift[]>>(); // employee_id -> dayOfWeek -> shifts[]
      if (uniqueUuids.length > 0) {
        try {
          // Build query with company_id filter if provided
          let shiftsQuery = `/employee_shifts?employee_id=in.(${uniqueUuids.join(',')})&is_active=eq.true&select=*&order=employee_id.asc,day_of_week.asc,start_time.asc`;
          if (filters?.companyId) {
            shiftsQuery += `&company_id=eq.${filters.companyId}`;
          }
          
          // Fetch all shifts for all employees in one call
          const shiftsResponse = await adminApi.get<EmployeeShift[]>(shiftsQuery);
          const allShifts = Array.isArray(shiftsResponse.data) ? shiftsResponse.data : [];
          
          // Organize shifts by employee_id and day_of_week
          // Additional safety: filter by company_id if provided (in case some shifts slipped through)
          allShifts.forEach(shift => {
            // Skip shifts that don't match the company_id filter (if set)
            if (filters?.companyId && shift.company_id !== filters.companyId) {
              return;
            }
            
            if (!shiftsMap.has(shift.employee_id)) {
              shiftsMap.set(shift.employee_id, new Map());
            }
            const dayMap = shiftsMap.get(shift.employee_id)!;
            if (!dayMap.has(shift.day_of_week)) {
              dayMap.set(shift.day_of_week, []);
            }
            dayMap.get(shift.day_of_week)!.push(shift);
          });
        } catch (error) {
          console.warn('Error batch fetching shifts, will fallback to individual calls:', error);
        }
      }
      
      // Batch fetch all employee working hours at once
      // Filter by company_id if provided to ensure we only get working hours for the current company
      const workingHoursMap = new Map<string, EmployeeWorkingHours>();
      if (uniqueUuids.length > 0) {
        try {
          // Build query with company_id filter if provided
          let workingHoursQuery = `/employee_working_hours?employee_id=in.(${uniqueUuids.join(',')})&is_active=eq.true&select=*&order=effective_from.desc`;
          if (filters?.companyId) {
            workingHoursQuery += `&company_id=eq.${filters.companyId}`;
          }
          
          const workingHoursResponse = await adminApi.get<EmployeeWorkingHours[]>(workingHoursQuery);
          const allWorkingHours = Array.isArray(workingHoursResponse.data) ? workingHoursResponse.data : [];
          
          // Get the most recent working hours for each employee
          // Additional safety: filter by company_id if provided (in case some records slipped through)
          allWorkingHours.forEach(wh => {
            // Skip working hours that don't match the company_id filter (if set)
            if (filters?.companyId && wh.company_id !== filters.companyId) {
              return;
            }
            
            if (!workingHoursMap.has(wh.employee_id)) {
              workingHoursMap.set(wh.employee_id, wh);
            }
          });
        } catch (error) {
          console.warn('Error batch fetching working hours, will fallback to individual calls:', error);
        }
      }
      
      // Transform records using cached shift/working hours data
      // Only process records for employees that belong to the current company (if companyId filter is set)
      const transformedRecords: AttendanceLog[] = [];
      
      for (const raw of recordsToProcess) {
        const employeeUuid = employeeUuidMap.get(raw.employee_id) || `unknown-${raw.employee_id}`;
        
        // If companyId filter is set, skip records for employees not in the company
        if (filters?.companyId && employeeUuid.startsWith('unknown-')) {
          // This employee is not in the company's employee list, skip it
          continue;
        }
        
        const employee = employeeUuid.startsWith('unknown-') ? undefined : employeeMap.get(employeeUuid);
        
        // Use cached shifts/working hours instead of making individual API calls
        const transformed = transformRawAttendanceWithCache(
          raw, 
          employeeUuid, 
          employee,
          shiftsMap,
          workingHoursMap
        );
        transformedRecords.push(transformed);
      }
      
      // Aggregate records by employee and date, passing shift information
      const aggregated = aggregateAttendanceRecords(transformedRecords, shiftsMap, workingHoursMap);
      
      // Sort by date descending, then by employee name
      aggregated.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        // If same date, sort by employee name
        const aName = `${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`.toLowerCase();
        const bName = `${b.employees?.first_name || ''} ${b.employees?.last_name || ''}`.toLowerCase();
        return aName.localeCompare(bName);
      });
      
      // Apply pagination to aggregated results (not raw records)
      let paginatedData = aggregated;
      let finalTotalCount = aggregated.length;
      
      if (filters?.limit && filters?.page) {
        const startIndex = (filters.page - 1) * filters.limit;
        const endIndex = startIndex + filters.limit;
        paginatedData = aggregated.slice(startIndex, endIndex);
        finalTotalCount = aggregated.length; // Total count is based on aggregated records
      }
      
      // Return paginated aggregated data
      return {
        data: paginatedData,
        totalCount: finalTotalCount
      };
    } catch (err: any) {
      console.error('API error fetching attendance:', err.message);
      return {
        data: [],
        totalCount: 0
      };
    }
  },

  /**
   * Get attendance records for a specific employee (by UUID)
   * Optionally filter by date (today only if dateFilter is 'today')
   */
  async getByEmployee(employeeId: string, dateFilter?: 'today' | 'all') {
    try {
      // First, we need to find the integer employee_id for this UUID
      const employees = await employeeService.getAll();
      const employee = employees.find(e => e.id === employeeId);
      
      if (!employee) {
        return [];
      }
      
      // Try to find the integer ID
      // Check external_id first
      let integerEmployeeId: number | null = null;
      const externalId = (employee as any).external_id;
      if (externalId && !isNaN(Number(externalId))) {
        integerEmployeeId = Number(externalId);
      } else {
        // Try to extract from employee_id text
        const employeeIdText = employee.employee_id || employee.employeeId || '';
        const match = employeeIdText.match(/\d+/);
        if (match) {
          integerEmployeeId = parseInt(match[0], 10);
        } else if (!isNaN(Number(employeeIdText))) {
          integerEmployeeId = Number(employeeIdText);
        }
      }
      
      if (!integerEmployeeId) {
        console.warn(`Could not find integer employee_id for UUID: ${employeeId}`);
        return [];
      }
      
      // Build query with optional date filter
      let queryUrl = `/attendances?employee_id=eq.${integerEmployeeId}&select=*&order=timestamp.desc`;
      
      if (dateFilter === 'today') {
        // Get today's date range
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        
        // Format as ISO strings
        const startISO = todayStart.toISOString();
        const endISO = todayEnd.toISOString();
        
        // PostgREST doesn't support multiple operators on same column in URL params
        // So we'll filter on the client side after fetching
        // But we can at least filter from start of day
        queryUrl += `&timestamp=gte.${startISO}`;
      }
      
      // Fetch attendance records for this integer employee_id
      const response = await adminApi.get<RawAttendance[]>(queryUrl);
      let rawRecords = response.data || [];
      
      // If filtering for today, apply end date filter on client side
      if (dateFilter === 'today') {
        const today = new Date();
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        const endISO = todayEnd.toISOString();
        
        rawRecords = rawRecords.filter(raw => {
          const recordDate = new Date(raw.timestamp);
          return recordDate <= new Date(endISO);
        });
      }
      
      // Transform records
      const transformedRecords = await Promise.all(
        rawRecords.map(raw => transformRawAttendance(raw, employeeId, employee))
      );
      
      // Aggregate by date (no shift map available in this context, but that's okay)
      return aggregateAttendanceRecords(transformedRecords);
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      return [];
    }
  },

  /**
   * Create a manual punch (posts to attendances table)
   * Now supports geo-location and WebAuthn verification
   */
  async createPunch(log: Partial<AttendanceLog> & {
    latitude?: number;
    longitude?: number;
    location_verified?: boolean;
    distance_from_location_meters?: number;
    face_verified?: boolean;
    face_image_url?: string;
    face_match_confidence?: number;
    verification_method?: string;
    device_info?: string;
    ip_address?: string;
    webauthn_verified?: boolean;
    webauthn_credential_id?: string;
    webauthn_device_name?: string;
  }) {
    try {
      // Get employee to map UUID to integer ID
      const employee = await employeeService.getById(log.employee_id!);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Map employee UUID to integer ID (for attendances table)
      let integerEmployeeId: number | null = null;
      const externalId = (employee as any).external_id;
      if (externalId && !isNaN(Number(externalId))) {
        integerEmployeeId = Number(externalId);
      } else {
        // Try to extract from employee_id text
        const employeeIdText = employee.employee_id || employee.employeeId || '';
        const match = employeeIdText.match(/\d+/);
        if (match) {
          integerEmployeeId = parseInt(match[0], 10);
        } else if (!isNaN(Number(employeeIdText))) {
          integerEmployeeId = Number(employeeIdText);
        }
      }

      if (!integerEmployeeId) {
        throw new Error('Could not map employee ID to integer format');
      }

      // Determine timestamp and status flags based on check_in or check_out
      // Check which field is provided (check_in or check_out)
      const hasCheckIn = !!log.check_in;
      const hasCheckOut = !!log.check_out;
      
      // Timestamp from caller is already adjusted for Kuwait timezone
      // (caller adds 3 hours before passing toISOString())
      // So we use it directly
      const timestamp = hasCheckIn ? log.check_in! : log.check_out!;
      const date = new Date(timestamp);
      const hour = date.getHours();
      const isMorning = hour < 12;

      // Transform to attendances table format
      // status1 = true means check-in, status2 = true means check-out
      // Set flags explicitly: if check_in is provided, set status1=true, status2=null
      // If check_out is provided, set status1=null, status2=true
      const attendanceData: any = {
        employee_id: integerEmployeeId,
        timestamp: timestamp,
        status1: hasCheckIn ? true : null, // Check-in flag: true only if check_in is provided
        status2: hasCheckOut ? true : null, // Check-out flag: true only if check_out is provided
        status3: null,
        status4: null,
        status5: null,
        sn: `WEB-${Date.now()}`, // Generate a serial number
        table: 'web_portal', // Indicate this came from web portal
        stamp: new Date().toISOString(), // Current timestamp as stamp
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add optional fields if they exist (these might need to be stored elsewhere or in a separate table)
      // Note: attendances table might not have these fields, so we'll only include basic fields
      // If you need to store geo/webauthn data, consider storing in attendance_logs or a separate table

      const response = await adminApi.post('/attendances', attendanceData);
      const result = response.data && response.data.length > 0 ? response.data[0] : response.data;
      
      // Send message notification if enabled (fire and forget - don't block attendance recording)
      if (log.employee_id && (log.check_in || log.check_out)) {
        try {
          // Get employee to find company_id
          const { employeeService } = await import('./employeeService');
          const employees = await employeeService.getAll();
          const employee = employees.find(emp => emp.id === log.employee_id);
          
          if (employee && employee.company_id) {
            const { messageService } = await import('./messageService');
            const messageType = log.check_in ? 'check_in' : 'check_out';
            const timestamp = log.check_in || log.check_out || new Date().toISOString();
            
            // Send message asynchronously (don't await - fire and forget)
            messageService.sendAttendanceMessage(
              employee.company_id,
              log.employee_id,
              messageType,
              timestamp
            ).catch(error => {
              console.error('Failed to send attendance message:', error);
              // Don't throw - message failure shouldn't block attendance recording
            });
          }
        } catch (error) {
          console.error('Error sending attendance message:', error);
          // Don't throw - message failure shouldn't block attendance recording
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error creating punch:', error);
      throw error;
    }
  },

  /**
   * Update a punch (for attendance_logs table)
   */
  async updatePunch(id: string, updates: Partial<AttendanceLog>) {
    try {
      const response = await adminApi.patch(`/attendance_logs?id=eq.${id}`, updates);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating punch:', error);
      throw error;
    }
  },

  /**
   * Delete a punch (for attendance_logs table)
   */
  async deletePunch(id: string) {
    try {
      await adminApi.delete(`/attendance_logs?id=eq.${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting punch:', error);
      throw error;
    }
  }
};
