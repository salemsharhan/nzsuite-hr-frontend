import { api, adminApi } from './api';

export interface EmployeeEducation {
  id: string;
  employee_id: string;
  institution_name: string;
  place_of_graduation: string;
  graduation_year: number;
  degree_type?: string;
  field_of_study?: string;
  grade_or_gpa?: string;
  is_primary?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const employeeEducationService = {
  // Get all education records for an employee
  getByEmployee: async (employeeId: string): Promise<EmployeeEducation[]> => {
    const response = await adminApi.get(`/employee_education?employee_id=eq.${employeeId}&order=graduation_year.desc`);
    return response.data || [];
  },

  // Get a single education record
  getById: async (id: string): Promise<EmployeeEducation> => {
    const response = await adminApi.get(`/employee_education?id=eq.${id}`);
    if (!response.data || response.data.length === 0) {
      throw new Error('Education record not found');
    }
    return response.data[0];
  },

  // Create a new education record
  create: async (education: Omit<EmployeeEducation, 'id' | 'created_at' | 'updated_at'>): Promise<EmployeeEducation> => {
    const response = await adminApi.post('/employee_education', education);
    return response.data[0];
  },

  // Update an education record
  update: async (id: string, education: Partial<Omit<EmployeeEducation, 'id' | 'employee_id' | 'created_at' | 'updated_at'>>): Promise<EmployeeEducation> => {
    const response = await adminApi.patch(`/employee_education?id=eq.${id}`, education);
    if (!response.data || response.data.length === 0) {
      throw new Error('Education record not found');
    }
    return response.data[0];
  },

  // Delete an education record
  delete: async (id: string): Promise<void> => {
    await adminApi.delete(`/employee_education?id=eq.${id}`);
  },
};

