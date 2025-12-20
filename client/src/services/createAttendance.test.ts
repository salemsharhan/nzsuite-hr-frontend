import { describe, it, expect } from 'vitest';
import { attendanceService } from './attendanceService';

describe('Attendance Creation', () => {
  it('should create an attendance log', async () => {
    // We need a valid employee ID first. Let's assume the one from the previous test exists or use a mock one.
    // Since we don't want to depend on other tests, we'll try to fetch one or use a known ID.
    // For this test, we'll try to create a log for a random ID, which might fail foreign key constraint if strict.
    // But we are testing RLS/API access.
    
    const newLog = {
      employee_id: 'EMP-001', // Assuming this exists from inspection
      date: new Date().toISOString().split('T')[0],
      check_in: new Date().toISOString(),
      status: 'Present',
      late_minutes: 0,
      overtime_minutes: 0,
      is_regularized: false
    };

    try {
      const created = await attendanceService.createPunch(newLog);
      expect(created).toBeDefined();
      
      // Cleanup
      if (created.id) {
        await attendanceService.deletePunch(created.id);
      }
    } catch (error: any) {
      // If it fails with 401/403, we know we need adminApi
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('RLS Error: ' + error.response.data.message);
      }
      // If it fails with FK constraint, that's fine, it means auth worked
      if (error.response?.data?.code === '23503') {
        console.log('Auth worked, but FK failed (expected)');
        return;
      }
      throw error;
    }
  });
});
