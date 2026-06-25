import { api, adminApi } from './api';
import { employeeService, Employee } from './employeeService';

export interface CompanySettings {
  id: string;
  company_id: string;
  default_working_hours_per_day: number;
  default_working_days_per_week: number;
  work_week_start_day: number;
  work_week_end_day: number;
  annual_leave_days_per_year: number;
  sick_leave_days_per_year: number;
  carry_forward_annual_leave: boolean;
  max_carry_forward_days: number;
  payroll_cycle: 'monthly' | 'bi-weekly' | 'weekly';
  payroll_day: number;
  late_tolerance_minutes: number;
  overtime_threshold_hours: number;
  overtime_multiplier: number;
  timezone: string;
  currency: string;
  payroll_approver_wa_jid?: string | null;
  payroll_approver_phone_e164?: string | null;
  payroll_approver_name?: string | null;
  payroll_ceo_approver_wa_jid?: string | null;
  payroll_ceo_approver_phone_e164?: string | null;
  payroll_ceo_approver_name?: string | null;
  payroll_hr_wa_jid?: string | null;
  payroll_hr_phone_e164?: string | null;
  payroll_hr_name?: string | null;
  payroll_accountant_wa_jid?: string | null;
  payroll_accountant_phone_e164?: string | null;
  payroll_accountant_name?: string | null;
  taskhub_workspace_user_id?: string | null;
  /** Google Gemini API key for AI payroll generation */
  gemini_api_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWorkingHours {
  id: string;
  employee_id: string;
  company_id: string;
  monday_hours: number;
  tuesday_hours: number;
  wednesday_hours: number;
  thursday_hours: number;
  friday_hours: number;
  saturday_hours: number;
  sunday_hours: number;
  flexible_hours: boolean;
  start_time?: string;
  end_time?: string;
  break_duration_minutes: number;
  break_start_time?: string;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeShift {
  id: string;
  employee_id: string;
  company_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  shift_name?: string;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveQuota {
  id: string;
  employee_id: string;
  company_id: string;
  leave_year: number;
  leave_type: string;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
  carried_forward_days: number;
  effective_from: string;
  effective_to: string;
  created_at: string;
  updated_at: string;
}

export interface RoleSalaryConfig {
  id: string;
  company_id: string;
  role_id?: string;
  job_id?: string;
  base_salary: number;
  currency: string;
  housing_allowance: number;
  transport_allowance: number;
  meal_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  tax_percentage: number;
  insurance_deduction: number;
  other_deductions: number;
  benefits: Record<string, any>;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyHoliday {
  id: string;
  company_id: string;
  holiday_date: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionsConfig {
  id: string;
  company_id: string;
  role_id: string;
  permissions: Record<string, any>;
  can_approve_leave: boolean;
  can_approve_overtime: boolean;
  can_view_salary: boolean;
  can_edit_employee: boolean;
  can_delete_employee: boolean;
  can_manage_documents: boolean;
  can_manage_recruitment: boolean;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function buildDefaultCompanySettings(companyId: string): CompanySettings {
  return {
    id: '',
    company_id: companyId,
    default_working_hours_per_day: 8,
    default_working_days_per_week: 5,
    work_week_start_day: 1,
    work_week_end_day: 5,
    annual_leave_days_per_year: 20,
    sick_leave_days_per_year: 10,
    carry_forward_annual_leave: true,
    max_carry_forward_days: 5,
    payroll_cycle: 'monthly',
    payroll_day: 1,
    late_tolerance_minutes: 15,
    overtime_threshold_hours: 8,
    overtime_multiplier: 1.5,
    timezone: 'UTC',
    currency: 'USD',
    created_at: '',
    updated_at: '',
  };
}

class CompanySettingsService {
  private defaultCompanySettings(companyId: string) {
    const { id, created_at, updated_at, ...defaults } = buildDefaultCompanySettings(companyId);
    return defaults;
  }

  private stripReadOnlyFields(settings: Partial<CompanySettings>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...settings };
    delete out.id;
    delete out.created_at;
    delete out.updated_at;
    return out;
  }

  // Company Settings
  async getCompanySettings(companyId: string): Promise<CompanySettings | null> {
    try {
      const response = await adminApi.get('/company_settings', {
        params: {
          company_id: `eq.${companyId}`,
          select: '*'
        }
      });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching company settings:', error);
      return null;
    }
  }

  async updateCompanySettings(companyId: string, settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings(companyId);
    const payload = {
      ...this.defaultCompanySettings(companyId),
      ...this.stripReadOnlyFields(settings),
      company_id: companyId,
    };

    if (existing?.id) {
      const payload = {
        ...this.stripReadOnlyFields(existing),
        ...this.stripReadOnlyFields(settings),
        company_id: companyId,
      };
      const response = await adminApi.patch('/company_settings', payload, {
        params: {
          company_id: `eq.${companyId}`
        }
      });
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      if (!row) {
        throw new Error('Company settings update matched no rows');
      }
      return row as CompanySettings;
    }

    const response = await adminApi.post('/company_settings', payload);
    const row = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!row) {
      throw new Error('Company settings were not created');
    }
    return row as CompanySettings;
  }

  async getCompanyHolidays(
    companyId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<CompanyHoliday[]> {
    try {
      const response = await adminApi.get('/company_holidays', {
        params: {
          company_id: `eq.${companyId}`,
          select: '*',
          order: 'holiday_date.asc'
        }
      });
      let list: CompanyHoliday[] = Array.isArray(response.data) ? response.data : [];
      if (dateFrom) {
        list = list.filter((h) => h.holiday_date.slice(0, 10) >= dateFrom);
      }
      if (dateTo) {
        list = list.filter((h) => h.holiday_date.slice(0, 10) <= dateTo);
      }
      return list;
    } catch (error) {
      console.error('Error fetching company holidays:', error);
      return [];
    }
  }

  async createCompanyHoliday(
    holiday: Omit<CompanyHoliday, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CompanyHoliday> {
    try {
      const response = await adminApi.post('/company_holidays', holiday);
      if (Array.isArray(response.data)) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating company holiday:', error);
      throw error;
    }
  }

  async deleteCompanyHoliday(id: string): Promise<boolean> {
    try {
      await adminApi.delete('/company_holidays', {
        params: { id: `eq.${id}` }
      });
      return true;
    } catch (error) {
      console.error('Error deleting company holiday:', error);
      return false;
    }
  }

  // Employee Working Hours
  async getEmployeeWorkingHours(employeeId: string): Promise<EmployeeWorkingHours | null> {
    try {
      const response = await adminApi.get('/employee_working_hours', {
        params: {
          employee_id: `eq.${employeeId}`,
          is_active: 'eq.true',
          select: '*',
          order: 'effective_from.desc',
          limit: 1
        }
      });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching employee working hours:', error);
      return null;
    }
  }

  async createEmployeeWorkingHours(hours: Omit<EmployeeWorkingHours, 'id' | 'created_at' | 'updated_at'>): Promise<EmployeeWorkingHours> {
    const response = await adminApi.post('/employee_working_hours', hours);
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  async updateEmployeeWorkingHours(id: string, hours: Partial<EmployeeWorkingHours>): Promise<EmployeeWorkingHours> {
    const response = await adminApi.patch('/employee_working_hours', hours, {
      params: {
        id: `eq.${id}`
      }
    });
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  /**
   * Maps integer employee_id from attendances table to UUID from employees table
   * This is needed because attendance records use integer IDs from the machine
   */
  private async mapIntegerEmployeeIdToUuid(integerEmployeeId: number): Promise<string | null> {
    try {
      // Try to find employee by external_id or employee_id text
      const employees = await employeeService.getAll();
      
      for (const emp of employees) {
        // Try external_id first
        const externalId = (emp as any).external_id;
        if (externalId && !isNaN(Number(externalId)) && Number(externalId) === integerEmployeeId) {
          return emp.id;
        }
        
        // Try to extract number from employee_id text (e.g., "EMP-1234" -> 1234)
        const employeeIdText = emp.employee_id || (emp as any).employeeId || '';
        const match = employeeIdText.match(/\d+/);
        if (match) {
          const extractedNumber = parseInt(match[0], 10);
          if (extractedNumber === integerEmployeeId) {
            return emp.id;
          }
        }
        
        // If employee_id is just a number string, try direct match
        if (!isNaN(Number(employeeIdText)) && Number(employeeIdText) === integerEmployeeId) {
          return emp.id;
        }
      }
      
      // If not found, try a direct query
      try {
        const response = await adminApi.get(`/employees?select=id,employee_id,external_id&or=(external_id.eq.${integerEmployeeId},employee_id.eq.${integerEmployeeId})&limit=1`);
        if (response.data && response.data.length > 0) {
          return response.data[0].id;
        }
      } catch (err) {
        console.warn('Direct query for employee mapping failed:', err);
      }
      
      return null;
    } catch (error) {
      console.error('Error mapping employee ID:', error);
      return null;
    }
  }

  // Employee Shifts (Multiple shifts per day)
  /**
   * Fetch shifts for many employees in one request (avoids N+1 on payroll rebuild).
   */
  async getEmployeeShiftsForEmployees(
    employeeIds: string[],
    companyId?: string
  ): Promise<Record<string, EmployeeShift[]>> {
    const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
    const empty = Object.fromEntries(uniqueIds.map((id) => [id, [] as EmployeeShift[]]));
    if (uniqueIds.length === 0) return {};

    try {
      let query = `/employee_shifts?employee_id=in.(${uniqueIds.join(',')})&is_active=eq.true&select=*&order=employee_id.asc,day_of_week.asc,start_time.asc`;
      if (companyId) {
        query += `&company_id=eq.${companyId}`;
      }
      const response = await adminApi.get<EmployeeShift[]>(query);
      const shifts = Array.isArray(response.data) ? response.data : [];
      const byEmployee: Record<string, EmployeeShift[]> = { ...empty };
      for (const shift of shifts) {
        if (companyId && shift.company_id !== companyId) continue;
        const empId = shift.employee_id;
        if (!byEmployee[empId]) byEmployee[empId] = [];
        byEmployee[empId].push(shift);
      }
      return byEmployee;
    } catch (error) {
      console.error('Error bulk fetching employee shifts:', error);
      return empty;
    }
  }

  /**
   * Get employee shifts by UUID employee_id
   */
  async getEmployeeShifts(employeeId: string, dayOfWeek?: number): Promise<EmployeeShift[]> {
    try {
      const params: any = {
        employee_id: `eq.${employeeId}`,
        is_active: 'eq.true',
        select: '*',
        order: 'day_of_week.asc,start_time.asc'
      };
      
      if (dayOfWeek !== undefined) {
        params.day_of_week = `eq.${dayOfWeek}`;
      }
      
      const response = await adminApi.get('/employee_shifts', { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching employee shifts:', error);
      return [];
    }
  }

  /**
   * Get employee shifts by integer employee_id (from attendances table)
   * This maps the integer ID to UUID first, then fetches shifts
   */
  async getEmployeeShiftsByIntegerId(integerEmployeeId: number, dayOfWeek?: number): Promise<EmployeeShift[]> {
    try {
      // Map integer employee_id to UUID
      const uuid = await this.mapIntegerEmployeeIdToUuid(integerEmployeeId);
      
      if (!uuid) {
        console.warn(`Could not find UUID for integer employee_id: ${integerEmployeeId}`);
        return [];
      }
      
      // Fetch shifts using UUID
      return await this.getEmployeeShifts(uuid, dayOfWeek);
    } catch (error) {
      console.error('Error fetching employee shifts by integer ID:', error);
      return [];
    }
  }

  async createEmployeeShift(shift: Omit<EmployeeShift, 'id' | 'created_at' | 'updated_at'>): Promise<EmployeeShift> {
    const response = await adminApi.post('/employee_shifts', shift);
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  async updateEmployeeShift(id: string, shift: Partial<EmployeeShift>): Promise<EmployeeShift> {
    const response = await adminApi.patch('/employee_shifts', shift, {
      params: {
        id: `eq.${id}`
      }
    });
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  async deleteEmployeeShift(id: string): Promise<boolean> {
    try {
      await adminApi.delete('/employee_shifts', {
        params: {
          id: `eq.${id}`
        }
      });
      return true;
    } catch (error) {
      console.error('Error deleting employee shift:', error);
      return false;
    }
  }

  // Leave Quotas
  async getEmployeeLeaveQuotas(employeeId: string, year?: number): Promise<LeaveQuota[]> {
    try {
      const params: any = {
        employee_id: `eq.${employeeId}`,
        select: '*',
        order: 'leave_year.desc,leave_type.asc'
      };
      if (year) {
        params.leave_year = `eq.${year}`;
      }
      const response = await api.get('/leave_quotas', { params });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching leave quotas:', error);
      return [];
    }
  }

  async createLeaveQuota(quota: Omit<LeaveQuota, 'id' | 'created_at' | 'updated_at'>): Promise<LeaveQuota> {
    const response = await adminApi.post('/leave_quotas', quota);
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  async updateLeaveQuota(id: string, quota: Partial<LeaveQuota>): Promise<LeaveQuota> {
    const response = await adminApi.patch('/leave_quotas', quota, {
      params: {
        id: `eq.${id}`
      }
    });
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  // Role Salary Config
  async getRoleSalaryConfigs(companyId: string, roleId?: string, jobId?: string): Promise<RoleSalaryConfig[]> {
    try {
      const params: any = {
        company_id: `eq.${companyId}`,
        is_active: 'eq.true',
        select: '*',
        order: 'created_at.desc'
      };
      if (roleId) {
        params.role_id = `eq.${roleId}`;
      }
      if (jobId) {
        params.job_id = `eq.${jobId}`;
      }
      const response = await adminApi.get('/role_salary_config', { params });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching role salary configs:', error);
      return [];
    }
  }

  async createRoleSalaryConfig(config: Omit<RoleSalaryConfig, 'id' | 'created_at' | 'updated_at'>): Promise<RoleSalaryConfig> {
    // Clean up the config: convert empty strings to null for UUID fields
    const cleanedConfig: any = { ...config };
    
    // Convert empty strings to null for UUID fields (PostgreSQL doesn't accept empty strings for UUID)
    if (cleanedConfig.role_id === '' || cleanedConfig.role_id === undefined) {
      cleanedConfig.role_id = null;
    }
    if (cleanedConfig.job_id === '' || cleanedConfig.job_id === undefined) {
      cleanedConfig.job_id = null;
    }
    
    // Remove undefined values for non-UUID optional fields (but keep null for UUIDs)
    Object.keys(cleanedConfig).forEach(key => {
      if (cleanedConfig[key] === undefined && key !== 'role_id' && key !== 'job_id') {
        delete cleanedConfig[key];
      }
    });
    
    const response = await adminApi.post('/role_salary_config', cleanedConfig);
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  async updateRoleSalaryConfig(id: string, config: Partial<RoleSalaryConfig>): Promise<RoleSalaryConfig> {
    const response = await adminApi.patch('/role_salary_config', config, {
      params: {
        id: `eq.${id}`
      }
    });
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  // Role Permissions Config
  async getRolePermissionsConfigs(companyId: string, roleId?: string): Promise<RolePermissionsConfig[]> {
    try {
      const params: any = {
        company_id: `eq.${companyId}`,
        is_active: 'eq.true',
        select: '*',
        order: 'created_at.desc'
      };
      if (roleId) {
        params.role_id = `eq.${roleId}`;
      }
      const response = await adminApi.get('/role_permissions_config', { params });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching role permissions configs:', error);
      return [];
    }
  }

  async createRolePermissionsConfig(config: Omit<RolePermissionsConfig, 'id' | 'created_at' | 'updated_at'>): Promise<RolePermissionsConfig> {
    const response = await adminApi.post('/role_permissions_config', config);
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  async updateRolePermissionsConfig(id: string, config: Partial<RolePermissionsConfig>): Promise<RolePermissionsConfig> {
    const response = await adminApi.patch('/role_permissions_config', config, {
      params: {
        id: `eq.${id}`
      }
    });
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }
}

export const companySettingsService = new CompanySettingsService();

