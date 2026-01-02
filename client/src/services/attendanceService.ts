import { api, adminApi } from './api';
import { employeeService, Employee } from './employeeService';
import { companySettingsService, EmployeeWorkingHours, EmployeeShift } from './companySettingsService';

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
  
  if (raw.status1 === true || (raw.status1 === null && isMorning)) {
    checkIn = timeStr;
  } else if (raw.status2 === true || (raw.status2 === null && !isMorning)) {
    checkOut = timeStr;
  } else {
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
        if (status === 'Present') status = 'Late';
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
      if (checkInTime.getHours() > 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() > 0)) {
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
  
  if (raw.status1 === true || (raw.status1 === null && isMorning)) {
    // Likely a check-in (status1 or morning time)
    checkIn = timeStr;
  } else if (raw.status2 === true || (raw.status2 === null && !isMorning)) {
    // Likely a check-out (status2 or afternoon time)
    checkOut = timeStr;
  } else {
    // Default: use timestamp for both, will be aggregated later
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
        if (status === 'Present') status = 'Late';
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
      if (checkInTime.getHours() > 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() > 0)) {
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
 */
function aggregateAttendanceRecords(records: AttendanceLog[]): AttendanceLog[] {
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
    if (group.length === 1) {
      aggregated.push(group[0]);
    } else {
      // Collect all check-in and check-out times
      const checkIns: string[] = [];
      const checkOuts: string[] = [];
      let totalLateMinutes = 0;
      let totalOvertimeMinutes = 0;
      let hasValidRecord = false;
      
      group.forEach(record => {
        if (record.check_in) {
          checkIns.push(record.check_in);
          hasValidRecord = true;
        }
        if (record.check_out) {
          checkOuts.push(record.check_out);
          hasValidRecord = true;
        }
        if (record.late_minutes > 0) {
          totalLateMinutes = Math.max(totalLateMinutes, record.late_minutes);
        }
        if (record.overtime_minutes > 0) {
          totalOvertimeMinutes = Math.max(totalOvertimeMinutes, record.overtime_minutes);
        }
      });
      
      if (!hasValidRecord) {
        // No valid records, skip
        return;
      }
      
      // Sort times
      checkIns.sort();
      checkOuts.sort();
      
      // Use earliest check-in and latest check-out
      const firstRecord = group[0];
      const aggregatedRecord: AttendanceLog = {
        ...firstRecord,
        check_in: checkIns.length > 0 ? checkIns[0] : '',
        check_out: checkOuts.length > 0 ? checkOuts[checkOuts.length - 1] : '',
        status: checkIns.length > 0 ? (totalLateMinutes > 0 ? 'Late' : 'Present') : 'Absent',
        late_minutes: totalLateMinutes,
        overtime_minutes: totalOvertimeMinutes
      };
      
      aggregated.push(aggregatedRecord);
    }
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
      
      // Apply date range filter on timestamp field
      // PostgREST requires separate parameters for gte and lte
      if (filters?.dateFrom) {
        // Convert date to start of day timestamp
        const dateFromTimestamp = new Date(`${filters.dateFrom}T00:00:00.000Z`).toISOString();
        params.timestamp = `gte.${dateFromTimestamp}`;
      }
      
      if (filters?.dateTo) {
        // Convert date to end of day timestamp
        const dateToTimestamp = new Date(`${filters.dateTo}T23:59:59.999Z`).toISOString();
        // If dateFrom is also set, we need to use both filters
        // PostgREST will AND them automatically when both are present
        if (filters?.dateFrom) {
          // We need to make two separate requests or use a different approach
          // For now, we'll filter on the client side for dateTo if dateFrom is also set
          // Or we can use a range query
          params['timestamp'] = `gte.${new Date(`${filters.dateFrom}T00:00:00.000Z`).toISOString()}`;
          // Store dateTo for client-side filtering
        } else {
          params.timestamp = `lte.${dateToTimestamp}`;
        }
      }
      
      // Filter by employee IDs (integer IDs from attendances table)
      if (filters?.employeeIds && filters.employeeIds.length > 0) {
        if (filters.employeeIds.length === 1) {
          params.employee_id = `eq.${filters.employeeIds[0]}`;
        } else {
          params.employee_id = `in.(${filters.employeeIds.join(',')})`;
        }
      }
      
      // Apply pagination
      if (filters?.limit) {
        params.limit = filters.limit;
        if (filters.page) {
          const offset = (filters.page - 1) * filters.limit;
          params.offset = offset;
        }
      } else {
        // Default limit if no pagination specified
        params.limit = 1000;
      }
      
      // Fetch attendance records with filters
      // Request total count in headers for pagination
      const response = await adminApi.get<RawAttendance[]>('/attendances', { 
        params,
        headers: {
          'Prefer': 'count=exact'
        }
      });
      const rawRecords = response.data || [];
      
      // Get total count from Content-Range header for pagination
      const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
      let totalCount = rawRecords.length;
      if (contentRange) {
        // Format: "0-9/100" means items 0-9 of 100 total
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          totalCount = parseInt(match[1], 10);
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
      const employees = await employeeService.getAll();
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
      const shiftsMap = new Map<string, Map<number, EmployeeShift[]>>(); // employee_id -> dayOfWeek -> shifts[]
      if (uniqueUuids.length > 0) {
        try {
          // Fetch all shifts for all employees in one call
          const shiftsResponse = await adminApi.get<EmployeeShift[]>(
            `/employee_shifts?employee_id=in.(${uniqueUuids.join(',')})&is_active=eq.true&select=*&order=employee_id.asc,day_of_week.asc,start_time.asc`
          );
          const allShifts = Array.isArray(shiftsResponse.data) ? shiftsResponse.data : [];
          
          // Organize shifts by employee_id and day_of_week
          allShifts.forEach(shift => {
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
      const workingHoursMap = new Map<string, EmployeeWorkingHours>();
      if (uniqueUuids.length > 0) {
        try {
          const workingHoursResponse = await adminApi.get<EmployeeWorkingHours[]>(
            `/employee_working_hours?employee_id=in.(${uniqueUuids.join(',')})&is_active=eq.true&select=*&order=effective_from.desc`
          );
          const allWorkingHours = Array.isArray(workingHoursResponse.data) ? workingHoursResponse.data : [];
          
          // Get the most recent working hours for each employee
          allWorkingHours.forEach(wh => {
            if (!workingHoursMap.has(wh.employee_id)) {
              workingHoursMap.set(wh.employee_id, wh);
            }
          });
        } catch (error) {
          console.warn('Error batch fetching working hours, will fallback to individual calls:', error);
        }
      }
      
      // Transform records using cached shift/working hours data
      const transformedRecords: AttendanceLog[] = [];
      
      for (const raw of recordsToProcess) {
        const employeeUuid = employeeUuidMap.get(raw.employee_id) || `unknown-${raw.employee_id}`;
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
      
      // Aggregate records by employee and date
      const aggregated = aggregateAttendanceRecords(transformedRecords);
      
      // Sort by date descending
      aggregated.sort((a, b) => b.date.localeCompare(a.date));
      
      // Return with total count for pagination
      return {
        data: aggregated,
        totalCount: totalCount
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
   */
  async getByEmployee(employeeId: string) {
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
      
      // Fetch attendance records for this integer employee_id
      const response = await adminApi.get<RawAttendance[]>(`/attendances?employee_id=eq.${integerEmployeeId}&select=*&order=timestamp.desc`);
      const rawRecords = response.data || [];
      
      // Transform records
      const transformedRecords = await Promise.all(
        rawRecords.map(raw => transformRawAttendance(raw, employeeId, employee))
      );
      
      // Aggregate by date
      return aggregateAttendanceRecords(transformedRecords);
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      return [];
    }
  },

  /**
   * Create a manual punch (still uses attendance_logs table for manual entries)
   * Now supports geo-location and face verification
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
  }) {
    try {
      const response = await adminApi.post('/attendance_logs', log);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
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
