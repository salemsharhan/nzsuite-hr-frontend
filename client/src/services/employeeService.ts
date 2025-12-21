// Using mock data until tRPC integration is complete

export interface Employee {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  hireDate?: string;
  salary?: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  employmentType: 'Full Time' | 'Part Time' | 'Consultant';
  createdAt?: string;
  updatedAt?: string;
  
  // Legacy field names for compatibility
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  designation?: string;
  join_date?: string;
  employment_type?: 'Full Time' | 'Part Time' | 'Consultant';
  avatar_url?: string;
}

// Mock data for now until tRPC is fully integrated
const mockEmployees: Employee[] = [
  {
    id: 1,
    employeeId: 'EMP001',
    firstName: 'Ahmed',
    lastName: 'Al-Mutairi',
    email: 'ahmed.mutairi@thesystem.com',
    phone: '+965 9999 9999',
    department: 'Engineering',
    position: 'Senior Developer',
    hireDate: '2023-01-15',
    salary: '3500',
    status: 'Active',
    employmentType: 'Full Time',
    employee_id: 'EMP001',
    first_name: 'Ahmed',
    last_name: 'Al-Mutairi',
    designation: 'Senior Developer',
    join_date: '2023-01-15',
    employment_type: 'Full Time',
    avatar_url: '/placeholder-avatar.png'
  },
  {
    id: 2,
    employeeId: 'EMP002',
    firstName: 'Fatima',
    lastName: 'Al-Salem',
    email: 'fatima.salem@thesystem.com',
    phone: '+965 9888 8888',
    department: 'HR',
    position: 'HR Manager',
    hireDate: '2022-06-01',
    salary: '4000',
    status: 'Active',
    employmentType: 'Full Time',
    employee_id: 'EMP002',
    first_name: 'Fatima',
    last_name: 'Al-Salem',
    designation: 'HR Manager',
    join_date: '2022-06-01',
    employment_type: 'Full Time',
    avatar_url: '/placeholder-avatar.png'
  },
  {
    id: 3,
    employeeId: 'EMP003',
    firstName: 'Mohammed',
    lastName: 'Al-Rashid',
    email: 'mohammed.rashid@thesystem.com',
    phone: '+965 9777 7777',
    department: 'Sales',
    position: 'Sales Executive',
    hireDate: '2023-03-20',
    salary: '2800',
    status: 'Active',
    employmentType: 'Part Time',
    employee_id: 'EMP003',
    first_name: 'Mohammed',
    last_name: 'Al-Rashid',
    designation: 'Sales Executive',
    join_date: '2023-03-20',
    employment_type: 'Part Time',
    avatar_url: '/placeholder-avatar.png'
  },
  {
    id: 4,
    employeeId: 'EMP004',
    firstName: 'Sarah',
    lastName: 'Al-Kandari',
    email: 'sarah.kandari@thesystem.com',
    phone: '+965 9666 6666',
    department: 'Marketing',
    position: 'Marketing Consultant',
    hireDate: '2024-01-10',
    salary: '5000',
    status: 'Active',
    employmentType: 'Consultant',
    employee_id: 'EMP004',
    first_name: 'Sarah',
    last_name: 'Al-Kandari',
    designation: 'Marketing Consultant',
    join_date: '2024-01-10',
    employment_type: 'Consultant',
    avatar_url: '/placeholder-avatar.png'
  }
];

export const employeeService = {
  async getAll() {
    try {
      // Return mock data for now
      return mockEmployees;
    } catch (error) {
      console.error('Error fetching employees:', error);
      return [];
    }
  },

  async getById(id: string | number) {
    try {
      const numId = typeof id === 'string' ? parseInt(id) : id;
      const employee = mockEmployees.find(emp => emp.id === numId);
      return employee || null;
    } catch (error) {
      console.error(`Error fetching employee ${id}:`, error);
      return null;
    }
  },

  async create(employee: any) {
    try {
      const newEmployee: Employee = {
        id: mockEmployees.length + 1,
        employeeId: employee.employee_id || employee.employeeId,
        firstName: employee.first_name || employee.firstName,
        lastName: employee.last_name || employee.lastName,
        email: employee.email,
        phone: employee.phone || '',
        department: employee.department || '',
        position: employee.designation || employee.position || '',
        hireDate: employee.join_date || employee.hireDate,
        salary: employee.salary?.toString() || '0',
        status: employee.status || 'Active',
        employmentType: employee.employment_type || employee.employmentType || 'Full Time',
        employee_id: employee.employee_id || employee.employeeId,
        first_name: employee.first_name || employee.firstName,
        last_name: employee.last_name || employee.lastName,
        designation: employee.designation || employee.position || '',
        join_date: employee.join_date || employee.hireDate,
        employment_type: employee.employment_type || employee.employmentType || 'Full Time',
        avatar_url: '/placeholder-avatar.png'
      };
      
      mockEmployees.push(newEmployee);
      return newEmployee;
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  },

  async update(id: string | number, updates: any) {
    try {
      const numId = typeof id === 'string' ? parseInt(id) : id;
      const index = mockEmployees.findIndex(emp => emp.id === numId);
      
      if (index === -1) {
        throw new Error('Employee not found');
      }
      
      mockEmployees[index] = {
        ...mockEmployees[index],
        ...updates
      };
      
      return { success: true };
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  },

  async delete(id: string | number) {
    try {
      const numId = typeof id === 'string' ? parseInt(id) : id;
      const index = mockEmployees.findIndex(emp => emp.id === numId);
      
      if (index === -1) {
        throw new Error('Employee not found');
      }
      
      mockEmployees.splice(index, 1);
      return true;
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }
};
