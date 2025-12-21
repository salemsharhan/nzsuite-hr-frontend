import { api, adminApi } from './api';

export interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  join_date: string;
  status: string;
  employment_type: 'Full Time' | 'Part Time' | 'Consultant';
  avatar_url: string;
  salary?: number;
}

export const employeeService = {
  async getAll() {
    try {
      const response = await api.get('/employees?select=*&order=created_at.desc');
      return response.data as Employee[];
    } catch (err: any) {
      console.error('API error fetching employees:', err.message);
      return [];
    }
  },

  async getById(id: string) {
    try {
      const response = await api.get(`/employees?id=eq.${id}&select=*`);
      if (response.data && response.data.length > 0) {
        return response.data[0] as Employee;
      }
      throw new Error('Employee not found');
    } catch (err) {
      console.error(`Error fetching employee ${id}:`, err);
      throw err;
    }
  },

  async create(employee: Omit<Employee, 'id' | 'created_at'>) {
    try {
      // Sanitize payload to ensure no extra fields (like salary or joining_date) are sent
      const payload = {
        employee_id: employee.employee_id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        designation: employee.designation,
        join_date: employee.join_date,
        status: employee.status,
        employment_type: employee.employment_type,
        avatar_url: employee.avatar_url
      };
      const response = await adminApi.post('/employees', payload);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Employee>) {
    try {
      const response = await adminApi.patch(`/employees?id=eq.${id}`, updates);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await adminApi.delete(`/employees?id=eq.${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }
};
