import { api, adminApi } from './api';

export interface ChecklistItem {
  id: string;
  stage: number;
  item_name: string;
  completed: boolean;
  completed_date?: string;
  completed_by?: string;
  notes?: string;
}

export interface HiringChecklist {
  id: string;
  employee_id: string;
  stage: number;
  progress_percentage: number;
  status: 'In Progress' | 'Pending Approval' | 'Completed';
  hr_approved: boolean;
  hr_approved_by?: string;
  hr_approved_date?: string;
  manager_approved: boolean;
  manager_approved_by?: string;
  manager_approved_date?: string;
  created_at: string;
  updated_at: string;
  items: ChecklistItem[];
  employees?: {
    first_name: string;
    last_name: string;
    employee_id: string;
  };
}

// Checklist template based on PDF structure
export const CHECKLIST_TEMPLATE = [
  {
    stage: 1,
    stageName: 'Offer & Acceptance',
    items: [
      'Issue official offer',
      'Candidate acceptance & signature',
      'Define start date'
    ]
  },
  {
    stage: 2,
    stageName: 'Documents & Contract',
    items: [
      'Collect original documents',
      'Sign employment contract',
      'Sign admin forms (confidentiality, non-objection, ID, uniform)',
      'Generate employee number',
      'Register in social security / official authorities'
    ]
  },
  {
    stage: 3,
    stageName: 'Pre-Onboarding',
    items: [
      'Create email & system accounts',
      'Prepare ID card',
      'Prepare office / tools / laptop / phone',
      'Prepare & deliver uniform',
      'Prepare first-day onboarding schedule'
    ]
  },
  {
    stage: 4,
    stageName: 'First Day (Onboarding)',
    items: [
      'Employee reception',
      'Department & team introduction',
      'Explain daily duties',
      'Explain HR policies',
      'Official handover of tools with signature'
    ]
  },
  {
    stage: 5,
    stageName: 'Probation Period',
    items: [
      'Define probation objectives',
      'Monthly performance follow-up',
      'End of probation evaluation (confirm / terminate)'
    ]
  },
  {
    stage: 6,
    stageName: 'Final Confirmation',
    items: [
      'Final hiring approval',
      'Update employee data in HR & finance system',
      'Deliver contract copy to employee',
      'Archive all documents in employee file'
    ]
  }
];

export const hiringChecklistService = {
  async getAll() {
    try {
      const response = await api.get('/hiring_checklists?select=*,employees(first_name,last_name,employee_id)&order=created_at.desc');
      return response.data as HiringChecklist[];
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn('hiring_checklists table not found');
        return [];
      }
      console.error('API error fetching hiring checklists:', err.message);
      return [];
    }
  },

  async getByEmployeeId(employeeId: string) {
    try {
      const response = await api.get(`/hiring_checklists?employee_id=eq.${employeeId}&select=*,employees(first_name,last_name,employee_id)`);
      if (response.data && response.data.length > 0) {
        return response.data[0] as HiringChecklist;
      }
      return null;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching checklist for employee ${employeeId}:`, err);
      return null;
    }
  },

  async create(employeeId: string) {
    try {
      // Create checklist with all items from template
      const items: Omit<ChecklistItem, 'id'>[] = [];
      CHECKLIST_TEMPLATE.forEach(stage => {
        stage.items.forEach(itemName => {
          items.push({
            stage: stage.stage,
            item_name: itemName,
            completed: false
          });
        });
      });

      const payload = {
        employee_id: employeeId,
        stage: 1,
        progress_percentage: 0,
        status: 'In Progress',
        hr_approved: false,
        manager_approved: false,
        items: JSON.stringify(items)
      };

      const response = await adminApi.post('/hiring_checklists', payload, {
        headers: {
          'Prefer': 'return=representation'
        }
      });
      
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating hiring checklist:', error);
      throw error;
    }
  },

  async updateItem(checklistId: string, itemId: string, updates: Partial<ChecklistItem>) {
    try {
      // First get the current checklist
      const checklistResponse = await api.get(`/hiring_checklists?id=eq.${checklistId}&select=*`);
      if (!checklistResponse.data || checklistResponse.data.length === 0) {
        throw new Error('Checklist not found');
      }

      const checklist = checklistResponse.data[0];
      let items: ChecklistItem[] = typeof checklist.items === 'string' 
        ? JSON.parse(checklist.items) 
        : checklist.items;

      // Update the specific item
      items = items.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      );

      // Calculate progress
      const completedItems = items.filter(item => item.completed).length;
      const progressPercentage = Math.round((completedItems / items.length) * 100);

      // Determine current stage (highest stage with at least one completed item)
      const completedStages = new Set(items.filter(item => item.completed).map(item => item.stage));
      const currentStage = Math.max(...Array.from(completedStages), 1);

      // Update checklist
      const payload = {
        items: JSON.stringify(items),
        progress_percentage: progressPercentage,
        stage: currentStage,
        status: progressPercentage === 100 ? 'Pending Approval' : 'In Progress'
      };

      const response = await adminApi.patch(`/hiring_checklists?id=eq.${checklistId}`, payload, {
        headers: {
          'Prefer': 'return=representation'
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating checklist item:', error);
      throw error;
    }
  },

  async approve(checklistId: string, approvalType: 'hr' | 'manager', approvedBy: string) {
    try {
      const payload: any = {
        [`${approvalType}_approved`]: true,
        [`${approvalType}_approved_by`]: approvedBy,
        [`${approvalType}_approved_date`]: new Date().toISOString()
      };

      // Check if both approvals are done
      const checklistResponse = await api.get(`/hiring_checklists?id=eq.${checklistId}&select=*`);
      if (checklistResponse.data && checklistResponse.data.length > 0) {
        const checklist = checklistResponse.data[0];
        const otherApproval = approvalType === 'hr' ? checklist.manager_approved : checklist.hr_approved;
        
        if (otherApproval) {
          payload.status = 'Completed';
        }
      }

      const response = await adminApi.patch(`/hiring_checklists?id=eq.${checklistId}`, payload, {
        headers: {
          'Prefer': 'return=representation'
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error approving checklist:', error);
      throw error;
    }
  },

  async delete(checklistId: string) {
    try {
      await adminApi.delete(`/hiring_checklists?id=eq.${checklistId}`);
      return true;
    } catch (error) {
      console.error('Error deleting hiring checklist:', error);
      throw error;
    }
  }
};
