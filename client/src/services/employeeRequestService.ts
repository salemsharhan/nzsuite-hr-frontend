import { api, adminApi } from './api';

export interface EmployeeRequest {
  id: string;
  employee_id: string;
  request_type: string;
  request_category: string;
  form_data: Record<string, any>;
  status: 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Cancelled';
  current_approver?: string;
  workflow_route?: string[];
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_comments?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_id: string;
    email?: string;
    department?: string;
  };
}

export interface EmployeeRequestFilters {
  status?: 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Cancelled' | 'all';
  employee_id?: string;
  request_type?: string;
  request_category?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const employeeRequestService = {
  async getAll(filters?: EmployeeRequestFilters): Promise<EmployeeRequest[]> {
    try {
      let query = '/employee_requests?select=*,employees!employee_requests_employee_id_fkey(id,first_name,last_name,employee_id,email,department)&order=submitted_at.desc';
      
      const params: string[] = [];
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.employee_id) {
        params.push(`employee_id=eq.${filters.employee_id}`);
      }
      
      if (filters?.request_type) {
        params.push(`request_type=eq.${filters.request_type}`);
      }
      
      if (filters?.request_category) {
        params.push(`request_category=eq.${filters.request_category}`);
      }
      
      if (filters?.date_from) {
        params.push(`submitted_at=gte.${filters.date_from}`);
      }
      
      if (filters?.date_to) {
        params.push(`submitted_at=lte.${filters.date_to}`);
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
      return response.data as EmployeeRequest[];
    } catch (error) {
      console.error('Error fetching employee requests:', error);
      return [];
    }
  },

  async getByEmployee(employeeId: string): Promise<EmployeeRequest[]> {
    try {
      const response = await api.get(
        `/employee_requests?select=*&employee_id=eq.${employeeId}&order=submitted_at.desc`
      );
      return response.data as EmployeeRequest[];
    } catch (error) {
      console.error('Error fetching employee requests:', error);
      return [];
    }
  },

  async getById(id: string): Promise<EmployeeRequest | null> {
    try {
      const response = await api.get(
        `/employee_requests?select=*,employees!employee_requests_employee_id_fkey(id,first_name,last_name,employee_id,email,department)&id=eq.${id}&limit=1`
      );
      if (response.data && response.data.length > 0) {
        return response.data[0] as EmployeeRequest;
      }
      return null;
    } catch (error) {
      console.error('Error fetching employee request:', error);
      return null;
    }
  },

  async create(data: {
    employee_id: string;
    request_type: string;
    request_category: string;
    form_data: Record<string, any>;
    workflow_route?: string[];
    current_approver?: string;
  }): Promise<EmployeeRequest> {
    try {
      const response = await adminApi.post('/employee_requests', {
        employee_id: data.employee_id,
        request_type: data.request_type,
        request_category: data.request_category,
        form_data: data.form_data,
        workflow_route: data.workflow_route || [],
        current_approver: data.current_approver || (data.workflow_route && data.workflow_route[0]) || 'HR',
        status: 'Pending'
      }, {
        headers: {
          'Prefer': 'return=representation'
        }
      });
      
      if (response.data && response.data.length > 0) {
        return response.data[0] as EmployeeRequest;
      }
      return response.data as EmployeeRequest;
    } catch (error) {
      console.error('Error creating employee request:', error);
      throw error;
    }
  },

  async updateStatus(
    id: string,
    status: 'Pending' | 'In Review' | 'Approved' | 'Rejected' | 'Cancelled',
    reviewedBy: string,
    comments?: string
  ): Promise<EmployeeRequest> {
    try {
      const updateData: any = {
        status,
        reviewed_by: reviewedBy,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'Approved' || status === 'Rejected') {
        updateData.reviewed_at = new Date().toISOString();
      }
      
      if (comments) {
        updateData.review_comments = comments;
      }
      
      const response = await adminApi.patch(
        `/employee_requests?id=eq.${id}`,
        updateData,
        {
          headers: {
            'Prefer': 'return=representation'
          }
        }
      );
      
      if (response.data && response.data.length > 0) {
        return response.data[0] as EmployeeRequest;
      }
      return response.data as EmployeeRequest;
    } catch (error) {
      console.error('Error updating employee request status:', error);
      throw error;
    }
  },

  async getCount(filters?: EmployeeRequestFilters): Promise<number> {
    try {
      let query = '/employee_requests?select=id';
      
      const params: string[] = [];
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.employee_id) {
        params.push(`employee_id=eq.${filters.employee_id}`);
      }
      
      if (filters?.request_type) {
        params.push(`request_type=eq.${filters.request_type}`);
      }
      
      if (filters?.request_category) {
        params.push(`request_category=eq.${filters.request_category}`);
      }
      
      if (filters?.date_from) {
        params.push(`submitted_at=gte.${filters.date_from}`);
      }
      
      if (filters?.date_to) {
        params.push(`submitted_at=lte.${filters.date_to}`);
      }
      
      if (params.length > 0) {
        query += '&' + params.join('&');
      }
      
      const response = await api.get(query, {
        headers: {
          'Prefer': 'count=exact'
        }
      });
      
      // Get count from response headers
      const count = response.headers['content-range']?.split('/')[1] || '0';
      return parseInt(count, 10);
    } catch (error) {
      console.error('Error getting employee request count:', error);
      return 0;
    }
  }
};

