import { adminApi } from './api';

export interface EmployeeAttendanceLocation {
  id: string;
  employee_id: string;
  location_name: string;
  google_maps_link: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  is_active: boolean;
  use_company_default: boolean;
  created_at: string;
  updated_at: string;
}

export const employeeAttendanceLocationService = {
  /**
   * Get attendance location settings for an employee
   */
  async getByEmployee(employeeId: string): Promise<EmployeeAttendanceLocation | null> {
    try {
      const response = await adminApi.get<EmployeeAttendanceLocation[]>(
        `/employee_attendance_locations?employee_id=eq.${employeeId}&limit=1`
      );
      return response.data && response.data.length > 0 ? response.data[0] : null;
    } catch (error) {
      console.error('Error fetching employee attendance location:', error);
      return null;
    }
  },

  /**
   * Create or update employee attendance location settings
   */
  async upsert(location: Partial<EmployeeAttendanceLocation>): Promise<EmployeeAttendanceLocation> {
    try {
      // Check if location exists for this employee
      if (location.employee_id) {
        const existing = await this.getByEmployee(location.employee_id);
        if (existing) {
          // Update existing
          const response = await adminApi.patch<EmployeeAttendanceLocation[]>(
            `/employee_attendance_locations?id=eq.${existing.id}`,
            {
              ...location,
              updated_at: new Date().toISOString()
            }
          );
          return response.data[0];
        }
      }
      
      // Create new
      const response = await adminApi.post<EmployeeAttendanceLocation>(
        '/employee_attendance_locations',
        {
          ...location,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error upserting employee attendance location:', error);
      throw error;
    }
  },

  /**
   * Delete employee attendance location
   */
  async delete(employeeId: string): Promise<void> {
    try {
      await adminApi.delete(`/employee_attendance_locations?employee_id=eq.${employeeId}`);
    } catch (error) {
      console.error('Error deleting employee attendance location:', error);
      throw error;
    }
  }
};






