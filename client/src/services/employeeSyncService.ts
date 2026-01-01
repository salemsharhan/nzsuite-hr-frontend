import { adminApi } from './api';
import { employeeService } from './employeeService';

/**
 * Example JSON format for employee data from external systems
 */
export interface ExternalEmployeeData {
  external_id: string; // Unique ID from external system
  employee_id?: string; // Employee ID (optional, will be generated if not provided)
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  alternate_phone?: string;
  date_of_birth?: string; // YYYY-MM-DD
  gender?: string;
  marital_status?: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  department?: string; // Department name (will be matched to department_id)
  role?: string; // Role name (will be matched to role_id)
  job?: string; // Job name (will be matched to job_id)
  employment_type?: string; // Full Time, Part Time, Consultant, Intern
  join_date?: string; // YYYY-MM-DD
  salary?: number;
  work_location?: string; // Office, Remote, Hybrid
  status?: string; // Active, Inactive, On Leave
  notes?: string;
}

export interface EmployeeSyncResponse {
  success: boolean;
  message: string;
  created: number;
  updated: number;
  errors: Array<{
    external_id: string;
    error: string;
  }>;
}

class EmployeeSyncService {
  /**
   * Sync employees from external API
   * This endpoint should be called by the external system to push employee data
   */
  async syncFromExternal(
    companyId: string,
    apiKey: string,
    employees: ExternalEmployeeData[]
  ): Promise<EmployeeSyncResponse> {
    const response = await adminApi.post('/employees/sync-external', {
      company_id: companyId,
      api_key: apiKey,
      employees
    });
    return response.data;
  }

  /**
   * Manual sync - fetch employees from external API endpoint
   */
  async manualSync(companyId: string): Promise<EmployeeSyncResponse> {
    const response = await adminApi.post(`/companies/${companyId}/sync`, {});
    return response.data;
  }

  /**
   * Transform external employee data to internal format
   */
  transformExternalEmployee(
    externalData: ExternalEmployeeData,
    companyId: string,
    departmentId?: string,
    roleId?: string,
    jobId?: string
  ) {
    return {
      external_id: externalData.external_id,
      company_id: companyId,
      employee_id: externalData.employee_id || `EMP-${externalData.external_id}`,
      first_name: externalData.first_name,
      last_name: externalData.last_name,
      email: externalData.email,
      phone: externalData.phone || null,
      alternate_phone: externalData.alternate_phone || null,
      date_of_birth: externalData.date_of_birth || null,
      gender: externalData.gender || null,
      marital_status: externalData.marital_status || null,
      nationality: externalData.nationality || null,
      address: externalData.address || null,
      city: externalData.city || null,
      state: externalData.state || null,
      country: externalData.country || null,
      postal_code: externalData.postal_code || null,
      emergency_contact_name: externalData.emergency_contact_name || null,
      emergency_contact_phone: externalData.emergency_contact_phone || null,
      emergency_contact_relationship: externalData.emergency_contact_relationship || null,
      department_id: departmentId || null,
      role_id: roleId || null,
      job_id: jobId || null,
      employment_type: externalData.employment_type || 'Full Time',
      join_date: externalData.join_date || null,
      salary: externalData.salary || null,
      work_location: externalData.work_location || 'Office',
      status: externalData.status || 'Active',
      notes: externalData.notes || null,
      synced_from_external: true,
      last_synced_at: new Date().toISOString()
    };
  }
}

export const employeeSyncService = new EmployeeSyncService();


