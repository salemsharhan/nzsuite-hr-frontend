import { api, adminApi } from './api';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  employees?: {
    first_name: string;
    last_name: string;
    employee_id: string;
    avatar_url?: string;
  };
}

export const leaveService = {
  async getAll() {
    try {
      const response = await api.get('/leave_requests?select=*,employees(first_name,last_name,employee_id,avatar_url)&order=created_at.desc');
      return response.data as LeaveRequest[];
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      return [];
    }
  },

  async getByEmployee(employeeId: string) {
    try {
      const response = await api.get(`/leave_requests?employee_id=eq.${employeeId}&select=*&order=created_at.desc`);
      return response.data as LeaveRequest[];
    } catch (error) {
      console.error('Error fetching employee leaves:', error);
      return [];
    }
  },

  async create(request: Omit<LeaveRequest, 'id' | 'created_at' | 'status'>) {
    try {
      const response = await adminApi.post('/leave_requests', { ...request, status: 'Pending' });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  },

  async updateStatus(id: string, status: 'Approved' | 'Rejected') {
    try {
      const response = await adminApi.patch(`/leave_requests?id=eq.${id}`, { status });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating leave status:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await adminApi.delete(`/leave_requests?id=eq.${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting leave request:', error);
      throw error;
    }
  }
};
