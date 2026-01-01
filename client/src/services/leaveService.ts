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
    reporting_manager_id?: string;
    department?: string;
    reporting_manager?: {
      id: string;
      first_name: string;
      last_name: string;
      employee_id: string;
    };
  };
}

export interface LeaveRequestFilters {
  status?: 'Pending' | 'Approved' | 'Rejected' | 'all';
  leave_type?: string;
  date_from?: string;
  date_to?: string;
  employee_name?: string;
  page?: number;
  limit?: number;
}

export const leaveService = {
  async getAll(filters?: LeaveRequestFilters) {
    try {
      // First, get leave requests with employee data
      // For reporting manager, we'll fetch it separately to avoid nested relationship issues
      let query = '/leave_requests?select=*,employees!leave_requests_employee_id_fkey(id,first_name,last_name,employee_id,avatar_url,reporting_manager_id,department)&order=created_at.desc';
      
      // Apply filters
      const params: string[] = [];
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.leave_type) {
        params.push(`leave_type=eq.${filters.leave_type}`);
      }
      
      if (filters?.date_from) {
        params.push(`start_date=gte.${filters.date_from}`);
      }
      
      if (filters?.date_to) {
        params.push(`end_date=lte.${filters.date_to}`);
      }
      
      // Pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 25;
      const offset = (page - 1) * limit;
      params.push(`limit=${limit}`);
      params.push(`offset=${offset}`);
      
      if (params.length > 0) {
        query += '&' + params.join('&');
      }
      
      const response = await api.get(query);
      const leaveRequests = response.data as LeaveRequest[];
      
      // Fetch reporting managers for all employees in one query (if any have reporting managers)
      const managerIds = leaveRequests
        .map(lr => lr.employees?.reporting_manager_id)
        .filter((id): id is string => !!id);
      
      if (managerIds.length > 0) {
        const uniqueManagerIds = [...new Set(managerIds)];
        // Use 'in' filter to get all managers in one query
        const managerQuery = `/employees?select=id,first_name,last_name,employee_id&id=in.(${uniqueManagerIds.join(',')})`;
        const managerResponse = await api.get(managerQuery);
        const managers = managerResponse.data as Array<{id: string; first_name: string; last_name: string; employee_id: string}>;
        
        // Map managers to leave requests
        const managerMap = new Map(managers.map(m => [m.id, m]));
        leaveRequests.forEach(lr => {
          if (lr.employees?.reporting_manager_id) {
            const manager = managerMap.get(lr.employees.reporting_manager_id);
            if (manager && lr.employees) {
              lr.employees.reporting_manager = {
                id: manager.id,
                first_name: manager.first_name,
                last_name: manager.last_name,
                employee_id: manager.employee_id
              };
            }
          }
        });
      }
      
      return leaveRequests;
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      return [];
    }
  },
  
  async getCount(filters?: LeaveRequestFilters) {
    try {
      let query = '/leave_requests?select=id';
      
      const params: string[] = [];
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.leave_type) {
        params.push(`leave_type=eq.${filters.leave_type}`);
      }
      
      if (filters?.date_from) {
        params.push(`start_date=gte.${filters.date_from}`);
      }
      
      if (filters?.date_to) {
        params.push(`end_date=lte.${filters.date_to}`);
      }
      
      if (params.length > 0) {
        query += '&' + params.join('&');
      }
      
      const response = await api.get(query);
      return Array.isArray(response.data) ? response.data.length : 0;
    } catch (error) {
      console.error('Error fetching leave requests count:', error);
      return 0;
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
