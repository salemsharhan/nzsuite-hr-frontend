import { api, adminApi } from './api';
import { attendance as mockAttendance } from '../data/mockData';

export interface AttendanceLog {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string;
  status: string;
  late_minutes: number;
  overtime_minutes: number;
  is_regularized: boolean;
  employees?: {
    first_name: string;
    last_name: string;
    employee_id: string;
  };
}

export const attendanceService = {
  async getAll() {
    try {
      const response = await api.get('/attendance_logs?select=*,employees(first_name,last_name,employee_id)&order=date.desc');
      return response.data as AttendanceLog[];
    } catch (err: any) {
      console.warn('API error, falling back to mock data:', err.message);
      return this.getMockData();
    }
  },

  getMockData(): AttendanceLog[] {
    return mockAttendance.map(a => ({
      id: String(a.id),
      employee_id: a.employeeId,
      date: a.date,
      check_in: a.checkIn ? `${a.date}T${a.checkIn}` : '',
      check_out: a.checkOut ? `${a.date}T${a.checkOut}` : '',
      status: a.status,
      late_minutes: a.late,
      overtime_minutes: a.overtime,
      is_regularized: false,
      employees: {
        first_name: a.employeeId,
        last_name: '',
        employee_id: a.employeeId
      }
    }));
  },

  async getByEmployee(employeeId: string) {
    try {
      const response = await api.get(`/attendance_logs?employee_id=eq.${employeeId}&select=*&order=date.desc`);
      return response.data as AttendanceLog[];
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      return [];
    }
  },

  async createPunch(log: Partial<AttendanceLog>) {
    try {
      const response = await adminApi.post('/attendance_logs', log);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating punch:', error);
      throw error;
    }
  },

  async updatePunch(id: string, updates: Partial<AttendanceLog>) {
    try {
      const response = await adminApi.patch(`/attendance_logs?id=eq.${id}`, updates);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating punch:', error);
      throw error;
    }
  },

  async deletePunch(id: string) {
    try {
      await adminApi.delete(`/attendance_logs?id=eq.${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting punch:', error);
      throw error;
    }
  }
};
