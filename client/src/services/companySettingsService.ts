import { api, adminApi } from './api';

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

class CompanySettingsService {
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
    const response = await adminApi.patch('/company_settings', settings, {
      params: {
        company_id: `eq.${companyId}`
      }
    });
    if (Array.isArray(response.data)) {
      return response.data[0];
    }
    return response.data;
  }

  // Employee Working Hours
  async getEmployeeWorkingHours(employeeId: string): Promise<EmployeeWorkingHours | null> {
    try {
      const response = await api.get('/employee_working_hours', {
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

