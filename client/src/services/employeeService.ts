// Using Supabase REST API for dynamic data

import { api, adminApi } from './api';
import { createClient } from '@supabase/supabase-js';

// Create service role client for storage operations to bypass RLS
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
const supabaseStorage = SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY)
  : null;

// Supabase table structure
interface SupabaseEmployee {
  id: string; // UUID
  employee_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  arabic_first_name?: string;
  arabic_middle_name?: string;
  arabic_last_name?: string;
  email: string;
  phone?: string;
  alternate_phone?: string;
  date_of_birth?: string;
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
  department_id?: string;
  role_id?: string;
  job_id?: string;
  department?: string;
  designation?: string;
  join_date?: string;
  status?: string;
  employment_type?: string;
  salary?: string;
  base_salary?: number;
  housing_allowance?: number;
  transport_allowance?: number;
  meal_allowance?: number;
  medical_allowance?: number;
  other_allowances?: number;
  work_location?: string;
  reporting_manager_id?: string;
  notes?: string;
  avatar_url?: string;
  working_hours_monday?: number;
  working_hours_tuesday?: number;
  working_hours_wednesday?: number;
  working_hours_thursday?: number;
  working_hours_friday?: number;
  working_hours_saturday?: number;
  working_hours_sunday?: number;
  flexible_hours?: boolean;
  start_time?: string;
  end_time?: string;
  break_duration_minutes?: number;
  company_id?: string;
  manager_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: string; // UUID from Supabase
  employeeId: string;
  external_id?: string; // Machine code from fingerprint device
  firstName: string;
  middleName?: string;
  lastName: string;
  arabicFirstName?: string;
  arabicMiddleName?: string;
  arabicLastName?: string;
  email: string;
  phone?: string;
  alternate_phone?: string;
  date_of_birth?: string;
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
  department_id?: string;
  role_id?: string;
  job_id?: string;
  department?: string;
  position?: string;
  hireDate?: string;
  salary?: string;
  base_salary?: number;
  housing_allowance?: number;
  transport_allowance?: number;
  meal_allowance?: number;
  medical_allowance?: number;
  other_allowances?: number;
  work_location?: string;
  reporting_manager_id?: string;
  notes?: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  employmentType: 'Full Time' | 'Part Time' | 'Consultant';
  working_hours_monday?: number;
  working_hours_tuesday?: number;
  working_hours_wednesday?: number;
  working_hours_thursday?: number;
  working_hours_friday?: number;
  working_hours_saturday?: number;
  working_hours_sunday?: number;
  flexible_hours?: boolean;
  start_time?: string;
  end_time?: string;
  break_duration_minutes?: number;
  company_id?: string;
  createdAt?: string;
  updatedAt?: string;
  
  // Legacy field names for compatibility (API snake_case and display helpers)
  employee_id?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  arabic_first_name?: string;
  arabic_middle_name?: string;
  arabic_last_name?: string;
  designation?: string;
  join_date?: string;
  employment_type?: 'Full Time' | 'Part Time' | 'Consultant';
  avatar_url?: string;
}

// Helper function to map Supabase employee to Employee interface
function mapSupabaseToEmployee(supabaseEmp: any): Employee {
  return {
    id: supabaseEmp.id,
    employeeId: supabaseEmp.employee_id,
    external_id: supabaseEmp.external_id,
    firstName: supabaseEmp.first_name,
    middleName: supabaseEmp.middle_name,
    lastName: supabaseEmp.last_name,
    arabicFirstName: supabaseEmp.arabic_first_name,
    arabicMiddleName: supabaseEmp.arabic_middle_name,
    arabicLastName: supabaseEmp.arabic_last_name,
    email: supabaseEmp.email,
    phone: supabaseEmp.phone,
    alternate_phone: supabaseEmp.alternate_phone,
    date_of_birth: supabaseEmp.date_of_birth,
    gender: supabaseEmp.gender,
    marital_status: supabaseEmp.marital_status,
    nationality: supabaseEmp.nationality,
    address: supabaseEmp.address,
    city: supabaseEmp.city,
    state: supabaseEmp.state,
    country: supabaseEmp.country,
    postal_code: supabaseEmp.postal_code,
    emergency_contact_name: supabaseEmp.emergency_contact_name,
    emergency_contact_phone: supabaseEmp.emergency_contact_phone,
    emergency_contact_relationship: supabaseEmp.emergency_contact_relationship,
    department_id: supabaseEmp.department_id,
    role_id: supabaseEmp.role_id,
    job_id: supabaseEmp.job_id,
    department: supabaseEmp.departments?.name || supabaseEmp.department,
    position: supabaseEmp.jobs?.name || supabaseEmp.designation,
    hireDate: supabaseEmp.join_date,
    salary: supabaseEmp.salary,
    base_salary: supabaseEmp.base_salary,
    housing_allowance: supabaseEmp.housing_allowance,
    transport_allowance: supabaseEmp.transport_allowance,
    meal_allowance: supabaseEmp.meal_allowance,
    medical_allowance: supabaseEmp.medical_allowance,
    other_allowances: supabaseEmp.other_allowances,
    work_location: supabaseEmp.work_location,
    reporting_manager_id: supabaseEmp.reporting_manager_id,
    notes: supabaseEmp.notes,
    status: (supabaseEmp.status as 'Active' | 'Inactive' | 'On Leave') || 'Active',
    employmentType: (supabaseEmp.employment_type as 'Full Time' | 'Part Time' | 'Consultant') || 'Full Time',
    working_hours_monday: supabaseEmp.working_hours_monday,
    working_hours_tuesday: supabaseEmp.working_hours_tuesday,
    working_hours_wednesday: supabaseEmp.working_hours_wednesday,
    working_hours_thursday: supabaseEmp.working_hours_thursday,
    working_hours_friday: supabaseEmp.working_hours_friday,
    working_hours_saturday: supabaseEmp.working_hours_saturday,
    working_hours_sunday: supabaseEmp.working_hours_sunday,
    flexible_hours: supabaseEmp.flexible_hours,
    start_time: supabaseEmp.start_time,
    end_time: supabaseEmp.end_time,
    break_duration_minutes: supabaseEmp.break_duration_minutes,
    company_id: supabaseEmp.company_id,
    createdAt: supabaseEmp.created_at,
    updatedAt: supabaseEmp.updated_at,
    // Legacy fields
    employee_id: supabaseEmp.employee_id,
    first_name: supabaseEmp.first_name,
    middle_name: supabaseEmp.middle_name,
    last_name: supabaseEmp.last_name,
    arabic_first_name: supabaseEmp.arabic_first_name,
    arabic_middle_name: supabaseEmp.arabic_middle_name,
    arabic_last_name: supabaseEmp.arabic_last_name,
    designation: supabaseEmp.designation,
    join_date: supabaseEmp.join_date,
    employment_type: supabaseEmp.employment_type as 'Full Time' | 'Part Time' | 'Consultant',
    avatar_url: supabaseEmp.avatar_url
  };
}

// Helper function to map Employee to Supabase format
function mapEmployeeToSupabase(employee: any): Partial<SupabaseEmployee & { company_id?: string }> {
  const mapped: any = {
    employee_id: employee.employee_id || employee.employeeId,
    first_name: employee.first_name || employee.firstName,
    middle_name: employee.middle_name || employee.middleName,
    last_name: employee.last_name || employee.lastName,
    arabic_first_name: employee.arabic_first_name || employee.arabicFirstName,
    arabic_middle_name: employee.arabic_middle_name || employee.arabicMiddleName,
    arabic_last_name: employee.arabic_last_name || employee.arabicLastName,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation || employee.position,
    join_date: employee.join_date || employee.hireDate,
    status: employee.status || 'Active',
    employment_type: employee.employment_type || employee.employmentType || 'Full Time',
    avatar_url: employee.avatar_url
  };
  
  // Include additional fields that might be in the employee object
  if (employee.company_id !== undefined) mapped.company_id = employee.company_id;
  if (employee.department_id !== undefined) mapped.department_id = employee.department_id;
  if (employee.role_id !== undefined) mapped.role_id = employee.role_id;
  if (employee.job_id !== undefined) mapped.job_id = employee.job_id;
  if (employee.salary !== undefined) mapped.salary = employee.salary;
  if (employee.base_salary !== undefined) mapped.base_salary = employee.base_salary;
  if (employee.housing_allowance !== undefined) mapped.housing_allowance = employee.housing_allowance;
  if (employee.transport_allowance !== undefined) mapped.transport_allowance = employee.transport_allowance;
  if (employee.meal_allowance !== undefined) mapped.meal_allowance = employee.meal_allowance;
  if (employee.medical_allowance !== undefined) mapped.medical_allowance = employee.medical_allowance;
  if (employee.other_allowances !== undefined) mapped.other_allowances = employee.other_allowances;
  if (employee.work_location !== undefined) mapped.work_location = employee.work_location;
  if (employee.reporting_manager_id !== undefined) mapped.reporting_manager_id = employee.reporting_manager_id;
  if (employee.notes !== undefined) mapped.notes = employee.notes;
  if (employee.phone !== undefined) mapped.phone = employee.phone;
  if (employee.alternate_phone !== undefined) mapped.alternate_phone = employee.alternate_phone;
  if (employee.date_of_birth !== undefined) mapped.date_of_birth = employee.date_of_birth;
  if (employee.gender !== undefined) mapped.gender = employee.gender;
  if (employee.marital_status !== undefined) mapped.marital_status = employee.marital_status;
  if (employee.nationality !== undefined) mapped.nationality = employee.nationality;
  if (employee.address !== undefined) mapped.address = employee.address;
  if (employee.city !== undefined) mapped.city = employee.city;
  if (employee.state !== undefined) mapped.state = employee.state;
  if (employee.country !== undefined) mapped.country = employee.country;
  if (employee.postal_code !== undefined) mapped.postal_code = employee.postal_code;
  if (employee.emergency_contact_name !== undefined) mapped.emergency_contact_name = employee.emergency_contact_name;
  if (employee.emergency_contact_phone !== undefined) mapped.emergency_contact_phone = employee.emergency_contact_phone;
  if (employee.emergency_contact_relationship !== undefined) mapped.emergency_contact_relationship = employee.emergency_contact_relationship;
  if (employee.external_id !== undefined) mapped.external_id = employee.external_id;
  
  return mapped;
}

export const employeeService = {
  /**
   * Check if a fingerprint machine code (external_id or employee_id) already exists
   * @param machineCode The fingerprint machine code to check
   * @param excludeEmployeeId Optional employee ID to exclude from check (when editing)
   * @returns true if code exists, false otherwise
   */
  async checkFingerprintCodeExists(machineCode: string, excludeEmployeeId?: string): Promise<boolean> {
    try {
      if (!machineCode || machineCode.trim() === '') {
        return false;
      }

      const code = machineCode.trim();
      
      // Check both external_id and employee_id fields using PostgREST OR syntax
      // Format: or=(field1.eq.value1,field2.eq.value2)
      const orFilter = `(external_id.eq.${code},employee_id.eq.${code})`;
      
      const response = await adminApi.get('/employees', {
        params: {
          select: 'id,external_id,employee_id',
          or: orFilter,
          limit: 1
        }
      });
      
      let foundEmployee = null;
      if (response.data && response.data.length > 0) {
        foundEmployee = response.data[0];
      }

      if (foundEmployee) {
        // If editing, exclude the current employee from the check
        if (excludeEmployeeId && foundEmployee.id === excludeEmployeeId) {
          return false;
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking fingerprint code:', error);
      // On error, return false to allow submission (fail open)
      return false;
    }
  },

  async getAll(companyId?: string): Promise<Employee[]> {
    try {
      const params: any = {
        select: '*,departments(name),jobs(name),roles(name)',
        order: 'created_at.desc'
      };
      
      // Filter by company_id if provided (for admin users)
      // Ensure companyId is a string, not an object
      if (companyId && typeof companyId === 'string') {
        params.company_id = `eq.${companyId}`;
      }
      
      const response = await api.get<SupabaseEmployee[]>('/employees', { params });
      
      return response.data.map(mapSupabaseToEmployee);
    } catch (error) {
      console.error('Error fetching employees:', error);
      return [];
    }
  },

  async getById(id: string | number): Promise<Employee | null> {
    try {
      const uuid = typeof id === 'number' ? id.toString() : id;
      const response = await api.get<SupabaseEmployee[]>(`/employees`, {
        params: {
          id: `eq.${uuid}`,
          select: '*'
        }
      });
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        return mapSupabaseToEmployee(response.data[0]);
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching employee ${id}:`, error);
      return null;
    }
  },

  async create(employee: any): Promise<Employee> {
    try {
      const supabaseData = mapEmployeeToSupabase(employee);
      
      const response = await adminApi.post<SupabaseEmployee[]>('/employees', supabaseData);
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        return mapSupabaseToEmployee(response.data[0]);
      }
      
      throw new Error('Failed to create employee');
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  },

  async update(id: string | number, updates: any): Promise<{ success: boolean }> {
    try {
      const uuid = typeof id === 'number' ? id.toString() : id;
      const supabaseData = mapEmployeeToSupabase(updates);
      
      await adminApi.patch(`/employees`, supabaseData, {
        params: {
          id: `eq.${uuid}`
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  },

  async delete(id: string | number): Promise<boolean> {
    try {
      const uuid = typeof id === 'number' ? id.toString() : id;
      
      // Delete related records first to avoid foreign key constraint violations
      // Order matters: delete child records before parent
      
      // 1. Delete attendance logs
      try {
        await adminApi.delete(`/attendance_logs`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting attendance logs (may not exist):', err);
      }
      
      // 2. Delete leave requests
      try {
        await adminApi.delete(`/leave_requests`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting leave requests (may not exist):', err);
      }
      
      // 3. Delete timesheet entries
      try {
        await adminApi.delete(`/timesheet_entries`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting timesheet entries (may not exist):', err);
      }
      
      // 4. Delete employee education records
      try {
        await adminApi.delete(`/employee_education`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting education records (may not exist):', err);
      }
      
      // 5. Delete employee bank details
      try {
        await adminApi.delete(`/employee_bank_details`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting bank details (may not exist):', err);
      }
      
      // 6. Delete employee immigration records
      try {
        await adminApi.delete(`/employee_immigration`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting immigration records (may not exist):', err);
      }
      
      // 7. Delete employee attendance locations
      try {
        await adminApi.delete(`/employee_attendance_locations`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting attendance locations (may not exist):', err);
      }
      
      // 8. Delete employee shifts
      try {
        await adminApi.delete(`/employee_shifts`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting employee shifts (may not exist):', err);
      }
      
      // 9. Delete employee working hours
      try {
        await adminApi.delete(`/employee_working_hours`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting working hours (may not exist):', err);
      }
      
      // 10. Delete employee requests
      try {
        await adminApi.delete(`/employee_requests`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting employee requests (may not exist):', err);
      }
      
      // 11. Delete document requests
      try {
        await adminApi.delete(`/document_requests`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting document requests (may not exist):', err);
      }
      
      // 12. Delete documents
      try {
        await adminApi.delete(`/documents`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting documents (may not exist):', err);
      }
      
      // 13. Delete WebAuthn credentials
      try {
        await adminApi.delete(`/webauthn_credentials`, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error deleting WebAuthn credentials (may not exist):', err);
      }
      
      // 14. Delete attendances (raw attendance records - uses integer employee_id)
      // First, get the employee to find their integer ID
      try {
        const employee = await this.getById(uuid);
        if (employee) {
          // Try to get integer employee_id from external_id or extract from employee_id text
          let integerEmployeeId: number | null = null;
          const externalId = (employee as any).external_id;
          if (externalId && !isNaN(Number(externalId))) {
            integerEmployeeId = Number(externalId);
          } else {
            const employeeIdText = employee.employee_id || employee.employeeId || '';
            const match = employeeIdText.match(/\d+/);
            if (match) {
              integerEmployeeId = parseInt(match[0], 10);
            } else if (!isNaN(Number(employeeIdText))) {
              integerEmployeeId = Number(employeeIdText);
            }
          }
          
          if (integerEmployeeId) {
            await adminApi.delete(`/attendances`, {
              params: {
                employee_id: `eq.${integerEmployeeId}`
              }
            });
          }
        }
      } catch (err) {
        console.warn('Error deleting attendances (may not exist):', err);
      }
      
      // 15. Update user_roles to set employee_id to NULL (if exists)
      try {
        await adminApi.patch(`/user_roles`, {
          employee_id: null
        }, {
          params: {
            employee_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error updating user_roles (may not exist):', err);
      }
      
      // 16. Update leave_requests approved_by to NULL (if employee was an approver)
      try {
        await adminApi.patch(`/leave_requests`, {
          approved_by: null
        }, {
          params: {
            approved_by: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error updating leave_requests approved_by (may not exist):', err);
      }
      
      // 17. Update employee_requests reviewed_by to NULL (if employee was a reviewer)
      try {
        await adminApi.patch(`/employee_requests`, {
          reviewed_by: null
        }, {
          params: {
            reviewed_by: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error updating employee_requests reviewed_by (may not exist):', err);
      }
      
      // 18. Update document_requests completed_by to NULL (if employee completed requests)
      try {
        await adminApi.patch(`/document_requests`, {
          completed_by: null
        }, {
          params: {
            completed_by: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error updating document_requests completed_by (may not exist):', err);
      }
      
      // 19. Update employees reporting_manager_id to NULL (if employee was a manager)
      try {
        await adminApi.patch(`/employees`, {
          reporting_manager_id: null
        }, {
          params: {
            reporting_manager_id: `eq.${uuid}`
          }
        });
      } catch (err) {
        console.warn('Error updating employees reporting_manager_id (may not exist):', err);
      }
      
      // 20. Finally, delete the employee
      await adminApi.delete(`/employees`, {
        params: {
          id: `eq.${uuid}`
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  },

  /**
   * Get reporting manager chain (hierarchy) for an employee
   * Recursively fetches all managers up the chain
   */
  async getReportingManagerChain(employeeId: string, maxDepth: number = 10): Promise<Employee[]> {
    const chain: Employee[] = [];
    const visited = new Set<string>(); // Prevent circular references
    let currentEmployeeId: string | null = employeeId;
    let depth = 0;

    while (currentEmployeeId && depth < maxDepth && !visited.has(currentEmployeeId)) {
      visited.add(currentEmployeeId);
      
      try {
        const employee = await this.getById(currentEmployeeId);
        if (!employee) break;

        // Add to chain if it's not the starting employee
        if (currentEmployeeId !== employeeId) {
          chain.push(employee);
        }

        // Move to next manager
        currentEmployeeId = employee.reporting_manager_id || null;
        depth++;
      } catch (error) {
        console.error('Error fetching reporting manager chain:', error);
        break;
      }
    }

    return chain;
  },

  /**
   * Upload profile image/avatar for an employee
   */
  async uploadAvatar(employeeId: string, file: File): Promise<string> {
    try {
      // Upload file to Supabase Storage using documents bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `employees/${employeeId}/avatars/${fileName}`;
      
      let publicUrl = '';
      
      if (supabaseStorage) {
        try {
          // Delete old avatar if exists
          try {
            const { data: listData } = await supabaseStorage.storage
              .from('documents')
              .list(`employees/${employeeId}/avatars/`);
            
            if (listData && listData.length > 0) {
              // Delete old files
              const filesToDelete = listData.map(f => `employees/${employeeId}/avatars/${f.name}`);
              await supabaseStorage.storage
                .from('documents')
                .remove(filesToDelete);
            }
          } catch (deleteError) {
            // Ignore delete errors (file might not exist)
            console.warn('Could not delete old avatar:', deleteError);
          }
          
          // Upload new avatar
          const { data: uploadData, error: uploadError } = await supabaseStorage.storage
            .from('documents')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            });
          
          if (uploadError) {
            throw new Error(`Failed to upload avatar: ${uploadError.message}`);
          }
          
          // Get public URL
          const { data: urlData } = supabaseStorage.storage
            .from('documents')
            .getPublicUrl(filePath);
          
          if (urlData?.publicUrl) {
            publicUrl = urlData.publicUrl;
          } else {
            throw new Error('Failed to get public URL for avatar');
          }
        } catch (storageError: any) {
          console.error('Storage upload error:', storageError);
          throw new Error(`Failed to upload avatar: ${storageError.message || 'Storage error'}`);
        }
      } else {
        // Fallback: convert to base64 data URL
        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              resolve(result);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        // Update employee record with base64 data URL
        await this.update(employeeId, { avatar_url: base64Url });
        return base64Url;
      }
      
      // Update employee record with new avatar URL
      await this.update(employeeId, { avatar_url: publicUrl });
      
      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  },

  /**
   * Get full reporting hierarchy including the employee and all managers
   */
  async getFullReportingHierarchy(employeeId: string): Promise<Employee[]> {
    try {
      const employee = await this.getById(employeeId);
      if (!employee) return [];

      const chain = await this.getReportingManagerChain(employeeId);
      return [employee, ...chain];
    } catch (error) {
      console.error('Error fetching full reporting hierarchy:', error);
      return [];
    }
  }
};
