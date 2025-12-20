import { api, adminApi } from './api';

export interface PayrollCycle {
  id: string;
  period: string;
  total_employees: number;
  total_amount: number;
  status: 'Draft' | 'Processing' | 'Processed';
  approval_date?: string;
  created_at: string;
}

export const payrollService = {
  async getAll() {
    try {
      const response = await api.get('/payroll_cycles?select=*&order=created_at.desc');
      return response.data as PayrollCycle[];
    } catch (error) {
      console.error('Error fetching payroll cycles:', error);
      return [];
    }
  },

  async createCycle(period: string) {
    try {
      // Mock calculation logic - in real app this would be a backend function
      // We need to get employee count first
      const countResponse = await api.get('/employees?select=count', {
        headers: { 'Prefer': 'count=exact,head=true' }
      });
      
      // The count is in the Content-Range header: "0-5/6" -> 6
      const contentRange = countResponse.headers['content-range'];
      const count = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
      
      const newCycle = {
        period,
        total_employees: count,
        total_amount: count * 1500, // Mock average salary
        status: 'Processing'
      };

      const response = await adminApi.post('/payroll_cycles', newCycle);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating payroll cycle:', error);
      throw error;
    }
  },

  async updateStatus(id: string, status: 'Processed') {
    try {
      const response = await adminApi.patch(`/payroll_cycles?id=eq.${id}`, { 
        status,
        approval_date: new Date().toISOString().split('T')[0]
      });
      
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating payroll status:', error);
      throw error;
    }
  }
};
