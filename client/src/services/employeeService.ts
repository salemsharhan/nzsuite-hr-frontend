import { api, adminApi } from './api';
import { employees as mockEmployees } from '../data/mockData';

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
  avatar_url: string;
  salary?: number;
}

export const employeeService = {
  async getAll() {
    try {
      const response = await api.get('/employees?select=*&order=created_at.desc');
      return response.data as Employee[];
    } catch (err: any) {
      console.warn('API error, falling back to mock data:', err.message);
      return this.getMockData();
    }
  },

  getMockData(): Employee[] {
    return mockEmployees.map(e => ({
      id: e.id,
      employee_id: e.id,
      first_name: e.name.split(' ')[0],
      last_name: e.name.split(' ').slice(1).join(' '),
      email: e.email,
      phone: e.phone,
      department: e.department,
      designation: e.designation,
      join_date: e.joinDate,
      status: e.status,
      avatar_url: e.avatar,
      salary: 0
    }));
  },

  async getById(id: string) {
    try {
      const response = await api.get(`/employees?id=eq.${id}&select=*`);
      if (response.data && response.data.length > 0) {
        return response.data[0] as Employee;
      }
      throw new Error('Employee not found');
    } catch (err) {
      console.warn(`Error fetching employee ${id}, falling back to mock`);
      return this.getMockData().find(e => e.id === id);
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
