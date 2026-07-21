import { api, adminApi } from './api';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'Pending' | 'Pending_GM' | 'On_Hold' | 'Approved' | 'Rejected';
  created_at: string;
  gm_note?: string | null;
  hr_note?: string | null;
  approval_request_id?: string | null;
  employees?: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    arabic_first_name?: string;
    arabic_middle_name?: string;
    arabic_last_name?: string;
    employee_id: string;
    avatar_url?: string;
    reporting_manager_id?: string;
    department?: string;
    company_id?: string;
    reporting_manager?: {
      id: string;
      first_name: string;
      middle_name?: string;
      last_name: string;
      arabic_first_name?: string;
      arabic_middle_name?: string;
      arabic_last_name?: string;
      employee_id: string;
    };
  };
}

export interface LeaveRequestFilters {
  status?: 'Pending' | 'Pending_GM' | 'On_Hold' | 'Approved' | 'Rejected' | 'all';
  leave_type?: string;
  date_from?: string;
  date_to?: string;
  /** When true with date_from+date_to, match leaves that overlap the range (not fully contained). */
  date_overlap?: boolean;
  employee_name?: string;
  companyId?: string; // Filter by company ID (for admin users)
  page?: number;
  limit?: number;
}

export const leaveService = {
  async getAll(filters?: LeaveRequestFilters) {
    try {
      // If companyId is provided, first get all employees for that company
      let employeeIds: string[] | null = null;
      if (filters?.companyId) {
        const { employeeService } = await import('./employeeService');
        const employees = await employeeService.getAll(filters.companyId);
        employeeIds = employees.map(emp => emp.id);
        if (employeeIds.length === 0) {
          return []; // No employees in this company, return empty
        }
      }

      // First, get leave requests with employee data
      // For reporting manager, we'll fetch it separately to avoid nested relationship issues
      let query = '/leave_requests?select=*,employees!leave_requests_employee_id_fkey(id,first_name,middle_name,last_name,arabic_first_name,arabic_middle_name,arabic_last_name,employee_id,avatar_url,reporting_manager_id,department,company_id)&order=created_at.desc';
      
      // Apply filters
      const params: string[] = [];
      
      // Filter by employee IDs if company filter is applied
      if (employeeIds && employeeIds.length > 0) {
        params.push(`employee_id=in.(${employeeIds.join(',')})`);
      }
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.leave_type) {
        params.push(`leave_type=eq.${filters.leave_type}`);
      }
      
      // Overlap mode: leave intersects [date_from, date_to]
      if (filters?.date_from && filters?.date_to && filters.date_overlap) {
        params.push(`start_date=lte.${filters.date_to}`);
        params.push(`end_date=gte.${filters.date_from}`);
      } else {
        if (filters?.date_from) {
          params.push(`start_date=gte.${filters.date_from}`);
        }
        if (filters?.date_to) {
          params.push(`end_date=lte.${filters.date_to}`);
        }
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
      let leaveRequests = response.data as LeaveRequest[];
      
      // Additional filter by company_id if needed (double-check)
      if (filters?.companyId) {
        leaveRequests = leaveRequests.filter(lr => lr.employees?.company_id === filters.companyId);
      }
      
      // Fetch reporting managers for all employees in one query (if any have reporting managers)
      const managerIds = leaveRequests
        .map(lr => lr.employees?.reporting_manager_id)
        .filter((id): id is string => !!id);
      
      if (managerIds.length > 0) {
        const uniqueManagerIds = Array.from(new Set(managerIds));
        // Use 'in' filter to get all managers in one query
        const managerQuery = `/employees?select=id,first_name,middle_name,last_name,arabic_first_name,arabic_middle_name,arabic_last_name,employee_id&id=in.(${uniqueManagerIds.join(',')})`;
        const managerResponse = await api.get(managerQuery);
        const managers = managerResponse.data as Array<{ id: string; first_name: string; middle_name?: string; last_name: string; arabic_first_name?: string; arabic_middle_name?: string; arabic_last_name?: string; employee_id: string }>;
        const managerMap = new Map(managers.map(m => [m.id, m]));
        leaveRequests.forEach(lr => {
          if (lr.employees?.reporting_manager_id) {
            const manager = managerMap.get(lr.employees.reporting_manager_id);
            if (manager && lr.employees) {
              lr.employees.reporting_manager = {
                id: manager.id,
                first_name: manager.first_name,
                middle_name: manager.middle_name,
                last_name: manager.last_name,
                arabic_first_name: manager.arabic_first_name,
                arabic_middle_name: manager.arabic_middle_name,
                arabic_last_name: manager.arabic_last_name,
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
      // If companyId is provided, first get all employees for that company
      let employeeIds: string[] | null = null;
      if (filters?.companyId) {
        const { employeeService } = await import('./employeeService');
        const employees = await employeeService.getAll(filters.companyId);
        employeeIds = employees.map(emp => emp.id);
        if (employeeIds.length === 0) {
          return 0; // No employees in this company
        }
      }

      let query = '/leave_requests?select=id';
      
      const params: string[] = [];
      
      // Filter by employee IDs if company filter is applied
      if (employeeIds && employeeIds.length > 0) {
        params.push(`employee_id=in.(${employeeIds.join(',')})`);
      }
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.leave_type) {
        params.push(`leave_type=eq.${filters.leave_type}`);
      }
      
      if (filters?.date_from && filters?.date_to && filters.date_overlap) {
        params.push(`start_date=lte.${filters.date_to}`);
        params.push(`end_date=gte.${filters.date_from}`);
      } else {
        if (filters?.date_from) {
          params.push(`start_date=gte.${filters.date_from}`);
        }
        if (filters?.date_to) {
          params.push(`end_date=lte.${filters.date_to}`);
        }
      }
      
      if (params.length > 0) {
        query += '&' + params.join('&');
      }
      
      const response = await api.get(query, {
        headers: {
          'Prefer': 'count=exact'
        }
      });
      
      const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
      
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

  async create(request: Omit<LeaveRequest, 'id' | 'created_at' | 'status'> & { company_id?: string }) {
    try {
      const response = await adminApi.post('/leave_requests', { ...request, status: 'Pending' });
      const created =
        response.data && Array.isArray(response.data) && response.data.length > 0
          ? response.data[0]
          : response.data;

      const leaveId = created?.id as string | undefined;
      let companyId = (request as { company_id?: string }).company_id;
      if (!companyId && request.employee_id) {
        try {
          const empRes = await adminApi.get(`/employees?id=eq.${request.employee_id}&select=company_id`);
          companyId = empRes.data?.[0]?.company_id;
        } catch {
          /* ignore */
        }
      }
      if (leaveId) {
        try {
          const { notifyLeaveToHr } = await import('./hrApprovalService');
          await notifyLeaveToHr(leaveId, companyId);
        } catch (e) {
          console.warn('HR WhatsApp notify skipped', e);
        }
      }
      return created;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  },

  async updateStatus(
    id: string,
    status: 'Pending' | 'Pending_GM' | 'On_Hold' | 'Approved' | 'Rejected',
    extra?: { hr_note?: string; gm_note?: string; hr_decided_by?: string },
  ) {
    try {
      const patch: Record<string, unknown> = { status, ...extra };
      if (status === 'Approved' || status === 'Rejected') {
        patch.hr_decision_at = new Date().toISOString();
      }
      const response = await adminApi.patch(`/leave_requests?id=eq.${id}`, patch);
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
