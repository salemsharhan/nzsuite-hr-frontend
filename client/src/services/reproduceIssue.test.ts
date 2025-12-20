import { describe, it, expect } from 'vitest';
import { employeeService } from './employeeService';

describe('Reproduction of joining_date issue', () => {
  it('should not send joining_date in the payload', async () => {
    const newEmployee = {
      first_name: 'Test',
      last_name: 'User',
      email: `test.user.${Date.now()}@example.com`,
      department: 'Engineering',
      position: 'Tester',
      salary: 5000,
      joining_date: '2025-01-01'
    };

    // Simulate exactly what EmployeeListPage does
    const { salary, ...employeeData } = newEmployee;
    
    const payload = {
      first_name: employeeData.first_name,
      last_name: employeeData.last_name,
      email: employeeData.email,
      department: employeeData.department,
      employee_id: `EMP-${Math.floor(Math.random() * 10000)}`,
      status: 'Active',
      avatar_url: `https://ui-avatars.com/api/?name=${employeeData.first_name}+${employeeData.last_name}`,
      phone: null as any,
      designation: employeeData.position,
      join_date: employeeData.joining_date
    };

    console.log('Payload being sent:', JSON.stringify(payload, null, 2));

    try {
      const created = await employeeService.create(payload);
      expect(created).toBeDefined();
      
      if (created.id) {
        await employeeService.delete(created.id);
      }
    } catch (error: any) {
      console.error('Creation failed:', error.response?.data || error);
      throw error;
    }
  });
});
