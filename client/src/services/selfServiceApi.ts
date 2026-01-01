// TODO: Replace with actual tRPC endpoints when backend is ready

import { RequestStatus } from '../components/common/StatusBadge';

export interface EmployeeDashboardData {
  checkInTime: string | null;
  leaveBalance: number;
  nextPayday: string | null;
  pendingRequestsCount: number;
}

export interface Request {
  id: string;
  type: string;
  category: string;
  date: string;
  status: RequestStatus;
  currentApprover?: string;
  formData: Record<string, any>;
  timeline: TimelineEvent[];
  comments: Comment[];
  attachments: Attachment[];
}

export interface TimelineEvent {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  notes?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
}

export interface Payslip {
  id: string;
  month: string;
  netSalary: number;
  grossSalary: number;
  deductions: number;
  downloadUrl: string;
}

// Mock data
const mockRequests: Request[] = [
  {
    id: 'REQ-001',
    type: 'Leave Request',
    category: 'Attendance & Leaves',
    date: '2025-12-15',
    status: 'Approved',
    currentApprover: 'HR Department',
    formData: {
      leaveType: 'annual',
      fromDate: '2025-12-20',
      toDate: '2025-12-25',
      reason: 'Family vacation'
    },
    timeline: [
      { id: '1', action: 'Submitted', actor: 'You', timestamp: '2025-12-15 09:00' },
      { id: '2', action: 'Approved by Manager', actor: 'John Smith', timestamp: '2025-12-15 14:30' },
      { id: '3', action: 'Approved by HR', actor: 'HR Department', timestamp: '2025-12-16 10:00' }
    ],
    comments: [],
    attachments: []
  },
  {
    id: 'REQ-002',
    type: 'Salary Certificate',
    category: 'Letters & Certificates',
    date: '2025-12-18',
    status: 'In Review',
    currentApprover: 'HR Department',
    formData: {
      language: 'en',
      destination: 'Bank',
      purpose: 'Loan application',
      stampedCopy: 'yes'
    },
    timeline: [
      { id: '1', action: 'Submitted', actor: 'You', timestamp: '2025-12-18 11:00' }
    ],
    comments: [],
    attachments: []
  },
  {
    id: 'REQ-003',
    type: 'IT Support Ticket',
    category: 'Assets & IT Support',
    date: '2025-12-19',
    status: 'Pending',
    currentApprover: 'IT Department',
    formData: {
      issueCategory: 'software',
      systemOrDevice: 'Email',
      priority: 'high',
      description: 'Cannot access email on mobile device'
    },
    timeline: [
      { id: '1', action: 'Submitted', actor: 'You', timestamp: '2025-12-19 15:30' }
    ],
    comments: [],
    attachments: []
  }
];

const mockPayslips: Payslip[] = [
  {
    id: 'PAY-2025-12',
    month: 'December 2025',
    netSalary: 4500,
    grossSalary: 5000,
    deductions: 500,
    downloadUrl: '#'
  },
  {
    id: 'PAY-2025-11',
    month: 'November 2025',
    netSalary: 4500,
    grossSalary: 5000,
    deductions: 500,
    downloadUrl: '#'
  },
  {
    id: 'PAY-2025-10',
    month: 'October 2025',
    netSalary: 4500,
    grossSalary: 5000,
    deductions: 500,
    downloadUrl: '#'
  }
];

// Mock API functions
export const selfServiceApi = {
  getDashboardData: async (): Promise<EmployeeDashboardData> => {
    // TODO: Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      checkInTime: '08:45 AM',
      leaveBalance: 12,
      nextPayday: '2025-12-31',
      pendingRequestsCount: mockRequests.filter(r => 
        r.status === 'Pending' || r.status === 'In Review'
      ).length
    };
  },

  getRecentRequests: async (limit: number = 5): Promise<Request[]> => {
    // TODO: Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockRequests.slice(0, limit);
  },

  getAllRequests: async (filters?: {
    status?: RequestStatus;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<Request[]> => {
    // Get current user from session storage
    const userStr = sessionStorage.getItem('user');
    let employeeId: string | null = null;
    
    if (userStr) {
      const user = JSON.parse(userStr);
      employeeId = user.employee_id;
      
      // For employee login, get employee_id from employee_data
      if (!employeeId) {
        const employeeDataStr = sessionStorage.getItem('employee_data');
        if (employeeDataStr) {
          const employeeData = JSON.parse(employeeDataStr);
          employeeId = employeeData.id;
        }
      }
    }
    
    if (!employeeId) {
      return [];
    }
    
    // Fetch all request types for the employee
    const [documentRequests, employeeRequests, leaveRequests] = await Promise.all([
      // Document requests
      (async () => {
        try {
          const { documentRequestService } = await import('./documentRequestService');
          return await documentRequestService.getByEmployee(employeeId!);
        } catch (error) {
          console.error('Error fetching document requests:', error);
          return [];
        }
      })(),
      // Employee requests (general)
      (async () => {
        try {
          const { employeeRequestService } = await import('./employeeRequestService');
          return await employeeRequestService.getByEmployee(employeeId!);
        } catch (error) {
          console.error('Error fetching employee requests:', error);
          return [];
        }
      })(),
      // Leave requests
      (async () => {
        try {
          const { leaveService } = await import('./leaveService');
          return await leaveService.getByEmployee(employeeId!);
        } catch (error) {
          console.error('Error fetching leave requests:', error);
          return [];
        }
      })()
    ]);
    
    // Convert document requests to Request format
    const docRequests: Request[] = documentRequests.map(docReq => ({
      id: docReq.id,
      type: docReq.document_type,
      category: 'Letters & Certificates',
      date: new Date(docReq.requested_at).toISOString().split('T')[0],
      status: docReq.status as RequestStatus,
      formData: {
        documentType: docReq.document_type,
        purpose: docReq.purpose,
        language: docReq.language,
        destination: docReq.destination
      },
      timeline: [
        {
          id: '1',
          action: 'Submitted',
          actor: 'You',
          timestamp: new Date(docReq.requested_at).toLocaleString()
        },
        ...(docReq.completed_at ? [{
          id: '2',
          action: docReq.status === 'Completed' ? 'Completed' : 'Rejected',
          actor: 'HR',
          timestamp: new Date(docReq.completed_at).toLocaleString()
        }] : [])
      ],
      comments: docReq.notes ? [{
        id: '1',
        author: 'HR',
        text: docReq.notes,
        timestamp: docReq.completed_at || docReq.requested_at
      }] : [],
      attachments: docReq.document_id || docReq.uploaded_document_url ? [{
        id: '1',
        name: docReq.documents?.name || 'Document',
        url: docReq.uploaded_document_url || docReq.documents?.url || '',
        size: 0
      }] : []
    }));
    
    // Convert employee requests to Request format
    const empRequests: Request[] = employeeRequests.map(empReq => ({
      id: empReq.id,
      type: empReq.request_type,
      category: empReq.request_category,
      date: new Date(empReq.submitted_at).toISOString().split('T')[0],
      status: empReq.status as RequestStatus,
      currentApprover: empReq.current_approver,
      formData: empReq.form_data,
      timeline: [
        {
          id: '1',
          action: 'Submitted',
          actor: 'You',
          timestamp: new Date(empReq.submitted_at).toLocaleString()
        },
        ...(empReq.reviewed_at ? [{
          id: '2',
          action: empReq.status === 'Approved' ? 'Approved' : empReq.status === 'Rejected' ? 'Rejected' : 'In Review',
          actor: 'Admin',
          timestamp: new Date(empReq.reviewed_at).toLocaleString()
        }] : [])
      ],
      comments: empReq.review_comments ? [{
        id: '1',
        author: 'Admin',
        text: empReq.review_comments,
        timestamp: empReq.reviewed_at || empReq.submitted_at
      }] : [],
      attachments: []
    }));
    
    // Convert leave requests to Request format
    const leaveReqs: Request[] = leaveRequests.map(leaveReq => ({
      id: leaveReq.id,
      type: 'Leave Request',
      category: 'Attendance & Leaves',
      date: new Date(leaveReq.created_at).toISOString().split('T')[0],
      status: leaveReq.status as RequestStatus,
      formData: {
        leaveType: leaveReq.leave_type,
        fromDate: leaveReq.start_date,
        toDate: leaveReq.end_date,
        reason: leaveReq.reason
      },
      timeline: [
        {
          id: '1',
          action: 'Submitted',
          actor: 'You',
          timestamp: new Date(leaveReq.created_at).toLocaleString()
        },
        ...(leaveReq.approved_by ? [{
          id: '2',
          action: leaveReq.status === 'Approved' ? 'Approved' : 'Rejected',
          actor: 'Manager',
          timestamp: leaveReq.created_at
        }] : [])
      ],
      comments: [],
      attachments: []
    }));
    
    // Combine all requests
    let allRequests = [...docRequests, ...empRequests, ...leaveReqs];
    
    // Apply filters
    if (filters?.status) {
      allRequests = allRequests.filter(r => r.status === filters.status);
    }
    if (filters?.category) {
      allRequests = allRequests.filter(r => r.category === filters.category);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      allRequests = allRequests.filter(r => 
        r.id.toLowerCase().includes(search) ||
        r.type.toLowerCase().includes(search)
      );
    }
    
    // Sort by date (newest first)
    allRequests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allRequests;
  },

  getRequestById: async (id: string): Promise<Request | null> => {
    // TODO: Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockRequests.find(r => r.id === id) || null;
  },

  createRequest: async (requestData: {
    typeId: string;
    categoryId: string;
    formData: Record<string, any>;
  }): Promise<Request> => {
    // Get current user from session storage
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
      throw new Error('User not authenticated');
    }
    const user = JSON.parse(userStr);
    
    // For employee login, get employee_id from employee_data
    let employeeId = user.employee_id;
    if (!employeeId) {
      const employeeDataStr = sessionStorage.getItem('employee_data');
      if (employeeDataStr) {
        const employeeData = JSON.parse(employeeDataStr);
        employeeId = employeeData.id;
      }
    }
    
    if (!employeeId) {
      throw new Error('Employee ID not found');
    }

    // Check if this is a document request
    if (requestData.typeId === 'document-request') {
      const { documentRequestService } = await import('./documentRequestService');
      
      // Create document request
      const docRequest = await documentRequestService.create({
        employee_id: employeeId,
        document_type: requestData.formData.documentType || 'Other',
        purpose: requestData.formData.purpose,
        language: requestData.formData.language || 'en',
        destination: requestData.formData.destination
      });
      
      // Convert to Request format for compatibility
      return {
        id: docRequest.id,
        type: docRequest.document_type,
        category: 'Letters & Certificates',
        date: new Date(docRequest.requested_at).toISOString().split('T')[0],
        status: docRequest.status as RequestStatus,
        formData: requestData.formData,
        timeline: [
          {
            id: '1',
            action: 'Submitted',
            actor: 'You',
            timestamp: new Date(docRequest.requested_at).toLocaleString()
          }
        ],
        comments: [],
        attachments: []
      };
    }

    // Check if this is a leave request - handle separately
    if (requestData.typeId === 'leave-request') {
      const { leaveService } = await import('./leaveService');
      
      // Create leave request
      const leaveRequest = await leaveService.create({
        employee_id: employeeId,
        leave_type: requestData.formData.leaveType || 'Annual Leave',
        start_date: requestData.formData.fromDate,
        end_date: requestData.formData.toDate,
        reason: requestData.formData.reason
      });
      
      // Convert to Request format for compatibility
      return {
        id: leaveRequest.id,
        type: 'Leave Request',
        category: 'Attendance & Leaves',
        date: new Date(leaveRequest.created_at).toISOString().split('T')[0],
        status: leaveRequest.status as RequestStatus,
        formData: requestData.formData,
        timeline: [
          {
            id: '1',
            action: 'Submitted',
            actor: 'You',
            timestamp: new Date(leaveRequest.created_at).toLocaleString()
          }
        ],
        comments: [],
        attachments: []
      };
    }
    
    // For all other request types, save to employee_requests table
    const { employeeRequestService } = await import('./employeeRequestService');
    const { REQUEST_CATEGORIES } = await import('../config/selfServiceRequests');
    
    // Find the request type config to get workflow route
    let workflowRoute: string[] = [];
    let requestTitle = requestData.typeId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    for (const category of REQUEST_CATEGORIES) {
      const requestType = category.requestTypes.find(rt => rt.id === requestData.typeId);
      if (requestType) {
        workflowRoute = requestType.workflowRoute || [];
        requestTitle = requestType.title;
        break;
      }
    }
    
    // Create employee request
    const empRequest = await employeeRequestService.create({
      employee_id: employeeId,
      request_type: requestTitle,
      request_category: requestData.categoryId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      form_data: requestData.formData,
      workflow_route: workflowRoute,
      current_approver: workflowRoute.length > 0 ? workflowRoute[0] : 'HR'
    });
    
    // Convert to Request format for compatibility
    return {
      id: empRequest.id,
      type: empRequest.request_type,
      category: empRequest.request_category,
      date: new Date(empRequest.submitted_at).toISOString().split('T')[0],
      status: empRequest.status as RequestStatus,
      currentApprover: empRequest.current_approver,
      formData: empRequest.form_data,
      timeline: [
        {
          id: '1',
          action: 'Submitted',
          actor: 'You',
          timestamp: new Date(empRequest.submitted_at).toLocaleString()
        }
      ],
      comments: empRequest.review_comments ? [{
        id: '1',
        author: 'Admin',
        text: empRequest.review_comments,
        timestamp: empRequest.reviewed_at || empRequest.submitted_at
      }] : [],
      attachments: []
    };
  },

  getRecentPayslips: async (limit: number = 3): Promise<Payslip[]> => {
    // TODO: Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockPayslips.slice(0, limit);
  },

  getAllPayslips: async (): Promise<Payslip[]> => {
    // TODO: Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockPayslips;
  },

  downloadPayslip: async (id: string): Promise<void> => {
    // TODO: Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Downloading payslip:', id);
    // In real implementation, this would trigger a file download
  }
};
