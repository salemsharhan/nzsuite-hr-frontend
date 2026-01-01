// Using Supabase REST API for dynamic data

import { api, adminApi } from './api';

// Supabase table structure
interface SupabaseEmployee {
  id: string; // UUID
  employee_id: string;
  first_name: string;
  last_name: string;
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
  lastName: string;
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
  
  // Legacy field names for compatibility
  employee_id?: string;
  first_name?: string;
  last_name?: string;
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
    lastName: supabaseEmp.last_name,
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
    last_name: supabaseEmp.last_name,
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
    last_name: employee.last_name || employee.lastName,
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
      if (companyId) {
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
  }
};
