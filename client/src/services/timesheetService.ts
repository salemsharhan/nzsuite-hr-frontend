import { api, adminApi } from './api';

export interface TimesheetEntry {
  id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  hours_worked: number;
  description?: string;
  project_name?: string;
  task_type?: string;
  is_submitted: boolean;
  submitted_at?: string;
  report_type?: 'daily' | 'weekly';
  week_start_date?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    first_name: string;
    last_name: string;
    employee_id: string;
  };
}

export interface TimesheetFilters {
  employee_id?: string;
  dateFrom?: string;
  dateTo?: string;
  is_submitted?: boolean;
  report_type?: 'daily' | 'weekly';
  week_start_date?: string;
  companyId?: string; // Filter by company ID (for admin users)
  page?: number;
  limit?: number;
}

export interface TimesheetResponse {
  data: TimesheetEntry[];
  totalCount: number;
}

export const timesheetService = {
  /**
   * Get all timesheet entries (for admin - only submitted entries)
   */
  async getAll(filters?: TimesheetFilters): Promise<TimesheetResponse> {
    try {
      // If companyId is provided, first get all employees for that company
      let employeeIds: string[] | null = null;
      if (filters?.companyId) {
        const { employeeService } = await import('./employeeService');
        const employees = await employeeService.getAll(filters.companyId);
        employeeIds = employees.map(emp => emp.id);
        if (employeeIds.length === 0) {
          return { data: [], totalCount: 0 }; // No employees in this company
        }
      }

      const params: any = {
        select: '*,employees(first_name,last_name,employee_id,company_id)',
        order: 'date.desc,created_at.desc'
      };

      // Only show submitted entries for admin
      params.is_submitted = 'eq.true';

      // Filter by employee IDs if company filter is applied
      if (employeeIds && employeeIds.length > 0) {
        params.employee_id = `in.(${employeeIds.join(',')})`;
      } else if (filters?.employee_id) {
        params.employee_id = `eq.${filters.employee_id}`;
      }

      // PostgREST doesn't easily support multiple operators on same column
      // Apply dateFrom filter, then filter dateTo on client side if both are provided
      if (filters?.dateFrom) {
        params.date = `gte.${filters.dateFrom}`;
      } else if (filters?.dateTo) {
        params.date = `lte.${filters.dateTo}`;
      }

      if (filters?.report_type) {
        params.report_type = `eq.${filters.report_type}`;
      }

      if (filters?.week_start_date) {
        params.week_start_date = `eq.${filters.week_start_date}`;
      }

      // Pagination
      if (filters?.limit) {
        params.limit = filters.limit;
        if (filters.page) {
          params.offset = (filters.page - 1) * filters.limit;
        }
      } else {
        params.limit = 1000;
      }

      const response = await adminApi.get<TimesheetEntry[]>('/timesheet_entries', {
        params,
        headers: {
          'Prefer': 'count=exact'
        }
      });

      let data = response.data || [];
      
      // Apply dateTo filter on client side if both dateFrom and dateTo are provided
      if (filters?.dateFrom && filters?.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        data = data.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate <= dateTo;
        });
      }
      
      // Additional filter by company_id if needed (double-check)
      if (filters?.companyId) {
        data = data.filter(entry => entry.employees?.company_id === filters.companyId);
      }
      
      const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
      let totalCount = data.length;
      if (contentRange && !(filters?.dateFrom && filters?.dateTo)) {
        // Only use header count if we didn't filter client-side
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          totalCount = parseInt(match[1], 10);
        }
      }

      return { data, totalCount };
    } catch (error) {
      console.error('Error fetching timesheet entries:', error);
      return { data: [], totalCount: 0 };
    }
  },

  /**
   * Get timesheet entries for a specific employee (employee can see all their entries)
   * Uses adminApi to bypass RLS since employees use demo tokens
   */
  async getByEmployee(employeeId: string, filters?: { dateFrom?: string; dateTo?: string; is_submitted?: boolean }): Promise<TimesheetEntry[]> {
    try {
      const params: any = {
        select: '*',
        employee_id: `eq.${employeeId}`, // Application-level validation: only get entries for this employee
        order: 'date.desc'
      };

      // PostgREST doesn't easily support multiple operators on same column
      // Apply dateFrom filter, then filter dateTo on client side if both are provided
      if (filters?.dateFrom) {
        params.date = `gte.${filters.dateFrom}`;
      } else if (filters?.dateTo) {
        params.date = `lte.${filters.dateTo}`;
      }

      if (filters?.is_submitted !== undefined) {
        params.is_submitted = `eq.${filters.is_submitted}`;
      }

      // Use adminApi to bypass RLS (employees use demo tokens, not valid JWTs)
      const response = await adminApi.get<TimesheetEntry[]>('/timesheet_entries', { params });
      let data = response.data || [];
      
      // Apply dateTo filter on client side if both dateFrom and dateTo are provided
      if (filters?.dateFrom && filters?.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        data = data.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate <= dateTo;
        });
      }
      
      // Application-level validation: ensure all entries belong to the requested employee
      data = data.filter(entry => entry.employee_id === employeeId);
      
      return data;
    } catch (error) {
      console.error('Error fetching employee timesheet entries:', error);
      return [];
    }
  },

  /**
   * Get timesheet entry for a specific date
   * Uses adminApi to bypass RLS since employees use demo tokens
   */
  async getByDate(employeeId: string, date: string): Promise<TimesheetEntry | null> {
    try {
      // Use adminApi to bypass RLS (employees use demo tokens, not valid JWTs)
      const response = await adminApi.get<TimesheetEntry[]>('/timesheet_entries', {
        params: {
          employee_id: `eq.${employeeId}`, // Application-level validation
          date: `eq.${date}`,
          select: '*',
          limit: 1
        }
      });
      const entry = response.data && response.data.length > 0 ? response.data[0] : null;
      
      // Application-level validation: ensure entry belongs to the requested employee
      if (entry && entry.employee_id !== employeeId) {
        return null;
      }
      
      return entry;
    } catch (error) {
      console.error('Error fetching timesheet entry by date:', error);
      return null;
    }
  },

  /**
   * Create or update a timesheet entry (upsert)
   * Uses adminApi to bypass RLS since employees use demo tokens
   * Application-level validation ensures employees can only modify their own entries
   */
  async upsert(entry: Partial<TimesheetEntry>): Promise<TimesheetEntry> {
    try {
      if (!entry.employee_id || !entry.date) {
        throw new Error('Employee ID and date are required');
      }

      // Check if entry exists
      const existing = await this.getByDate(entry.employee_id, entry.date);

      if (existing) {
        // Application-level validation: ensure existing entry belongs to the employee
        if (existing.employee_id !== entry.employee_id) {
          throw new Error('Unauthorized: Cannot modify another employee\'s timesheet entry');
        }
        
        // Update existing entry (only if not submitted)
        if (existing.is_submitted) {
          throw new Error('Cannot update a submitted timesheet entry');
        }

        // Use adminApi to bypass RLS
        const response = await adminApi.patch<TimesheetEntry[]>(
          `/timesheet_entries`,
          {
            hours_worked: entry.hours_worked ?? existing.hours_worked,
            description: entry.description ?? existing.description,
            project_name: entry.project_name ?? existing.project_name,
            task_type: entry.task_type ?? existing.task_type,
            updated_at: new Date().toISOString()
          },
          {
            params: {
              id: `eq.${existing.id}`
            }
          }
        );
        return response.data && response.data.length > 0 ? response.data[0] : existing;
      } else {
        // Create new entry using adminApi to bypass RLS
        const response = await adminApi.post<TimesheetEntry>('/timesheet_entries', {
          employee_id: entry.employee_id,
          date: entry.date,
          hours_worked: entry.hours_worked ?? 0,
          description: entry.description,
          project_name: entry.project_name,
          task_type: entry.task_type,
          is_submitted: false
        });
        return response.data;
      }
    } catch (error) {
      console.error('Error upserting timesheet entry:', error);
      throw error;
    }
  },

  /**
   * Submit timesheet entry as report (daily)
   * Uses adminApi to bypass RLS since employees use demo tokens
   */
  async submitDaily(employeeId: string, date: string): Promise<TimesheetEntry> {
    try {
      const entry = await this.getByDate(employeeId, date);
      if (!entry) {
        throw new Error('Timesheet entry not found for this date');
      }

      // Application-level validation: ensure entry belongs to the employee
      if (entry.employee_id !== employeeId) {
        throw new Error('Unauthorized: Cannot submit another employee\'s timesheet entry');
      }

      if (entry.is_submitted) {
        throw new Error('This timesheet entry is already submitted');
      }

      // Use adminApi to bypass RLS
      const response = await adminApi.patch<TimesheetEntry[]>(
        `/timesheet_entries`,
        {
          is_submitted: true,
          submitted_at: new Date().toISOString(),
          report_type: 'daily'
        },
        {
          params: {
            id: `eq.${entry.id}`
          }
        }
      );

      return response.data && response.data.length > 0 ? response.data[0] : entry;
    } catch (error) {
      console.error('Error submitting daily timesheet:', error);
      throw error;
    }
  },

  /**
   * Submit timesheet entries as weekly report
   * Uses adminApi to bypass RLS since employees use demo tokens
   */
  async submitWeekly(employeeId: string, weekStartDate: string): Promise<TimesheetEntry[]> {
    try {
      // Calculate week end date (7 days from start)
      const startDate = new Date(weekStartDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      // Get all entries for this week
      const entries = await this.getByEmployee(employeeId, {
        dateFrom: weekStartDate,
        dateTo: endDate.toISOString().split('T')[0],
        is_submitted: false
      });

      if (entries.length === 0) {
        throw new Error('No timesheet entries found for this week');
      }

      // Application-level validation: ensure all entries belong to the employee
      const invalidEntries = entries.filter(e => e.employee_id !== employeeId);
      if (invalidEntries.length > 0) {
        throw new Error('Unauthorized: Cannot submit entries that belong to other employees');
      }

      // Submit all entries using adminApi to bypass RLS
      const entryIds = entries.map(e => e.id);
      const response = await adminApi.patch<TimesheetEntry[]>(
        `/timesheet_entries`,
        {
          is_submitted: true,
          submitted_at: new Date().toISOString(),
          report_type: 'weekly',
          week_start_date: weekStartDate
        },
        {
          params: {
            id: `in.(${entryIds.join(',')})`
          }
        }
      );

      return response.data || entries;
    } catch (error) {
      console.error('Error submitting weekly timesheet:', error);
      throw error;
    }
  },

  /**
   * Delete a timesheet entry (only if not submitted)
   * Uses adminApi to bypass RLS since employees use demo tokens
   * Application-level validation ensures employees can only delete their own entries
   */
  async delete(id: string, employeeId?: string): Promise<boolean> {
    try {
      // If employeeId is provided, validate that the entry belongs to the employee
      if (employeeId) {
        const entry = await this.getByDate(employeeId, ''); // We need to fetch by ID instead
        // Actually, let's fetch the entry first to validate
        const response = await adminApi.get<TimesheetEntry[]>('/timesheet_entries', {
          params: {
            id: `eq.${id}`,
            select: '*',
            limit: 1
          }
        });
        
        const entryToDelete = response.data && response.data.length > 0 ? response.data[0] : null;
        if (!entryToDelete) {
          throw new Error('Timesheet entry not found');
        }
        
        // Application-level validation
        if (entryToDelete.employee_id !== employeeId) {
          throw new Error('Unauthorized: Cannot delete another employee\'s timesheet entry');
        }
        
        if (entryToDelete.is_submitted) {
          throw new Error('Cannot delete a submitted timesheet entry');
        }
      }
      
      // Use adminApi to bypass RLS
      await adminApi.delete(`/timesheet_entries`, {
        params: {
          id: `eq.${id}`
        }
      });
      return true;
    } catch (error) {
      console.error('Error deleting timesheet entry:', error);
      throw error;
    }
  },

  /**
   * Get weekly summary for an employee
   */
  async getWeeklySummary(employeeId: string, weekStartDate: string): Promise<{
    totalHours: number;
    entries: TimesheetEntry[];
    submitted: boolean;
  }> {
    try {
      const startDate = new Date(weekStartDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const entries = await this.getByEmployee(employeeId, {
        dateFrom: weekStartDate,
        dateTo: endDate.toISOString().split('T')[0]
      });

      const totalHours = entries.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0);
      const submitted = entries.length > 0 && entries.every(e => e.is_submitted);

      return {
        totalHours,
        entries,
        submitted
      };
    } catch (error) {
      console.error('Error getting weekly summary:', error);
      return { totalHours: 0, entries: [], submitted: false };
    }
  }
};
