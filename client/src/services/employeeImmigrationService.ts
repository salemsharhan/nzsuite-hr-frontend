import { api, adminApi } from './api';

export interface EmployeeImmigration {
  id: string;
  employee_id: string;
  
  // Work Permit
  work_permit_number?: string;
  work_permit_issue_date?: string;
  work_permit_expiry_date?: string;
  work_permit_status?: string;
  work_permit_last_renewed_date?: string;
  work_permit_next_renewal_date?: string;
  work_permit_renewal_reminder_days?: number;
  
  // Passport
  passport_number?: string;
  passport_issue_date?: string;
  passport_expiry_date?: string;
  passport_issue_country?: string;
  passport_status?: string;
  passport_validity_days?: number;
  
  // Health Insurance
  health_insurance_number?: string;
  health_insurance_provider?: string;
  health_insurance_issue_date?: string;
  health_insurance_expiry_date?: string;
  health_insurance_status?: string;
  health_insurance_last_renewed_date?: string;
  health_insurance_next_renewal_date?: string;
  health_insurance_renewal_reminder_days?: number;
  
  // Residence Permit
  residence_permit_number?: string;
  residence_permit_issue_date?: string;
  residence_permit_expiry_date?: string;
  residence_permit_status?: string;
  residence_permit_last_renewed_date?: string;
  residence_permit_next_renewal_date?: string;
  residence_permit_renewal_reminder_days?: number;
  residence_permit_article?: string;
  
  // Civil ID
  civil_id_number?: string;
  civil_id_issue_date?: string;
  civil_id_expiry_date?: string;
  civil_id_status?: string;
  civil_id_last_updated_date?: string;
  civil_id_update_reason?: string;
  
  // General
  is_expatriate?: boolean;
  visa_type?: string;
  sponsor_name?: string;
  entry_date?: string;
  last_exit_date?: string;
  last_entry_date?: string;
  
  // Renewal Tracking
  next_renewal_action?: string;
  next_renewal_date?: string;
  renewal_priority?: string;
  
  // Notes
  notes?: string;
  renewal_notes?: string;
  last_renewal_processed_by?: string;
  last_renewal_processed_date?: string;
  
  created_at?: string;
  updated_at?: string;
}

export const employeeImmigrationService = {
  // Get immigration record for an employee
  getByEmployee: async (employeeId: string): Promise<EmployeeImmigration | null> => {
    const response = await adminApi.get(`/employee_immigration?employee_id=eq.${employeeId}`);
    if (!response.data || response.data.length === 0) {
      return null;
    }
    return response.data[0];
  },

  // Get immigration record by ID
  getById: async (id: string): Promise<EmployeeImmigration> => {
    const response = await adminApi.get(`/employee_immigration?id=eq.${id}`);
    if (!response.data || response.data.length === 0) {
      throw new Error('Immigration record not found');
    }
    return response.data[0];
  },

  // Get all immigration records (for HR dashboard)
  getAll: async (filters?: {
    status?: string;
    renewal_priority?: string;
    is_expatriate?: boolean;
    next_renewal_date_from?: string;
    next_renewal_date_to?: string;
  }): Promise<EmployeeImmigration[]> => {
    let query = '/employee_immigration?order=next_renewal_date.asc';
    
    if (filters) {
      const params: string[] = [];
      if (filters.status) {
        params.push(`or=(work_permit_status.eq.${filters.status},residence_permit_status.eq.${filters.status},health_insurance_status.eq.${filters.status})`);
      }
      if (filters.renewal_priority) {
        params.push(`renewal_priority=eq.${filters.renewal_priority}`);
      }
      if (filters.is_expatriate !== undefined) {
        params.push(`is_expatriate=eq.${filters.is_expatriate}`);
      }
      if (filters.next_renewal_date_from) {
        params.push(`next_renewal_date=gte.${filters.next_renewal_date_from}`);
      }
      if (filters.next_renewal_date_to) {
        params.push(`next_renewal_date=lte.${filters.next_renewal_date_to}`);
      }
      if (params.length > 0) {
        query += '&' + params.join('&');
      }
    }
    
    const response = await adminApi.get(query);
    return response.data || [];
  },

  // Create or update immigration record (upsert)
  upsert: async (immigration: Omit<EmployeeImmigration, 'id' | 'created_at' | 'updated_at'>): Promise<EmployeeImmigration> => {
    // Check if immigration record already exists
    const existing = await employeeImmigrationService.getByEmployee(immigration.employee_id);
    
    if (existing) {
      // Update existing
      const response = await adminApi.patch(
        `/employee_immigration?id=eq.${existing.id}`,
        {
          ...immigration,
          updated_at: new Date().toISOString()
        }
      );
      return response.data[0];
    } else {
      // Create new
      const response = await adminApi.post('/employee_immigration', immigration);
      return response.data[0];
    }
  },

  // Update immigration record
  update: async (id: string, updates: Partial<EmployeeImmigration>): Promise<EmployeeImmigration> => {
    const response = await adminApi.patch(
      `/employee_immigration?id=eq.${id}`,
      {
        ...updates,
        updated_at: new Date().toISOString()
      }
    );
    return response.data[0];
  },

  // Delete immigration record
  delete: async (id: string): Promise<void> => {
    await adminApi.delete(`/employee_immigration?id=eq.${id}`);
  },

  // Calculate next renewal date and priority
  calculateRenewalInfo: (immigration: EmployeeImmigration): { nextRenewalDate: string | null; nextRenewalAction: string; priority: string } => {
    const dates: Array<{ date: string; action: string }> = [];
    
    if (immigration.work_permit_expiry_date) {
      dates.push({ date: immigration.work_permit_expiry_date, action: 'Work Permit' });
    }
    if (immigration.residence_permit_expiry_date) {
      dates.push({ date: immigration.residence_permit_expiry_date, action: 'Residence Permit' });
    }
    if (immigration.health_insurance_expiry_date) {
      dates.push({ date: immigration.health_insurance_expiry_date, action: 'Health Insurance' });
    }
    if (immigration.passport_expiry_date) {
      dates.push({ date: immigration.passport_expiry_date, action: 'Passport' });
    }
    if (immigration.civil_id_expiry_date) {
      dates.push({ date: immigration.civil_id_expiry_date, action: 'Civil ID' });
    }
    
    if (dates.length === 0) {
      return { nextRenewalDate: null, nextRenewalAction: 'None', priority: 'Normal' };
    }
    
    // Sort by date and get earliest
    dates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const nextRenewal = dates[0];
    
    // Calculate days until expiry
    const today = new Date();
    const expiryDate = new Date(nextRenewal.date);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine priority
    let priority = 'Normal';
    if (daysUntilExpiry < 0) {
      priority = 'Urgent'; // Already expired
    } else if (daysUntilExpiry <= 30) {
      priority = 'Urgent';
    } else if (daysUntilExpiry <= 60) {
      priority = 'High';
    } else if (daysUntilExpiry <= 90) {
      priority = 'Normal';
    } else {
      priority = 'Low';
    }
    
    return {
      nextRenewalDate: nextRenewal.date,
      nextRenewalAction: nextRenewal.action,
      priority
    };
  }
};

