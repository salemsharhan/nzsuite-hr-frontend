import { describe, it, expect } from 'vitest';
import { employeeService } from './employeeService';

describe('Employee Creation', () => {
  it('should create an employee without salary field', async () => {
    const newEmployee = {
      first_name: 'Test',
      last_name: 'User',
      email: `test.user.${Date.now()}@example.com`,
      department: 'Engineering',
      employee_id: `TEST-${Date.now()}`,
      status: 'Active',
      avatar_url: 'https://example.com/avatar.png',
      phone: '1234567890',
      designation: 'Tester',
      join_date: '2025-01-01'
    };

    try {
      const created = await employeeService.create(newEmployee);
      expect(created).toBeDefined();
      expect(created.email).toBe(newEmployee.email);
      
      // Cleanup
      if (created.id) {
        await employeeService.delete(created.id);
      }
    } catch (error: any) {
      console.error('Creation failed:', error.response?.data || error);
      throw error;
    }
  });
});
