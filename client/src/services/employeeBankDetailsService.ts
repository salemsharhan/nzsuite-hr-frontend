import { api, adminApi } from './api';

export interface EmployeeBankDetails {
  id: string;
  employee_id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch_name?: string;
  branch_code?: string;
  iban?: string;
  swift_code?: string;
  account_type?: string;
  currency?: string;
  is_primary?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const employeeBankDetailsService = {
  // Get bank details for an employee
  getByEmployee: async (employeeId: string): Promise<EmployeeBankDetails | null> => {
    const response = await adminApi.get(`/employee_bank_details?employee_id=eq.${employeeId}`);
    if (!response.data || response.data.length === 0) {
      return null;
    }
    return response.data[0];
  },

  // Get bank details by ID
  getById: async (id: string): Promise<EmployeeBankDetails> => {
    const response = await adminApi.get(`/employee_bank_details?id=eq.${id}`);
    if (!response.data || response.data.length === 0) {
      throw new Error('Bank details not found');
    }
    return response.data[0];
  },

  // Create or update bank details (upsert)
  upsert: async (bankDetails: Omit<EmployeeBankDetails, 'id' | 'created_at' | 'updated_at'>): Promise<EmployeeBankDetails> => {
    // Check if bank details already exist
    const existing = await employeeBankDetailsService.getByEmployee(bankDetails.employee_id);
    
    if (existing) {
      // Update existing
      const response = await adminApi.patch(
        `/employee_bank_details?id=eq.${existing.id}`,
        bankDetails
      );
      return response.data[0];
    } else {
      // Create new
      const response = await adminApi.post('/employee_bank_details', bankDetails);
      return response.data[0];
    }
  },

  // Update bank details
  update: async (id: string, bankDetails: Partial<Omit<EmployeeBankDetails, 'id' | 'employee_id' | 'created_at' | 'updated_at'>>): Promise<EmployeeBankDetails> => {
    const response = await adminApi.patch(`/employee_bank_details?id=eq.${id}`, bankDetails);
    if (!response.data || response.data.length === 0) {
      throw new Error('Bank details not found');
    }
    return response.data[0];
  },

  // Delete bank details
  delete: async (id: string): Promise<void> => {
    await adminApi.delete(`/employee_bank_details?id=eq.${id}`);
  },
};

