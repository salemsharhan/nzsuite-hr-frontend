import { api, adminApi } from './api';
import { useAuth } from '@/contexts/AuthContext';

export interface DocumentRequest {
  id: string;
  employee_id: string;
  document_type: string;
  purpose?: string;
  language?: string;
  destination?: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Rejected';
  requested_at: string;
  completed_at?: string;
  completed_by?: string;
  document_id?: string; // Reference to existing document
  uploaded_document_url?: string; // URL of newly uploaded document
  notes?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_id: string;
    email?: string;
    department?: string;
  };
  documents?: {
    id: string;
    name: string;
    url: string;
    type: string;
  };
}

export interface DocumentRequestFilters {
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Rejected' | 'all';
  employee_id?: string;
  document_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const documentRequestService = {
  async getAll(filters?: DocumentRequestFilters): Promise<DocumentRequest[]> {
    try {
      let query = '/document_requests?select=*,employees!document_requests_employee_id_fkey(id,first_name,last_name,employee_id,email,department),documents!document_requests_document_id_fkey(id,name,url,type)&order=requested_at.desc';
      
      const params: string[] = [];
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.employee_id) {
        params.push(`employee_id=eq.${filters.employee_id}`);
      }
      
      if (filters?.document_type) {
        params.push(`document_type=eq.${filters.document_type}`);
      }
      
      if (filters?.date_from) {
        params.push(`requested_at=gte.${filters.date_from}`);
      }
      
      if (filters?.date_to) {
        params.push(`requested_at=lte.${filters.date_to}`);
      }
      
      // Pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 25;
      const offset = (page - 1) * limit;
      params.push(`limit=${limit}`);
      params.push(`offset=${offset}`);
      
      if (params.length > 0) {
        query += '&' + params.join('&');
      }
      
      const response = await api.get(query);
      return response.data as DocumentRequest[];
    } catch (error) {
      console.error('Error fetching document requests:', error);
      return [];
    }
  },

  async getByEmployee(employeeId: string): Promise<DocumentRequest[]> {
    try {
      const response = await api.get(
        `/document_requests?select=*,documents!document_requests_document_id_fkey(id,name,url,type)&employee_id=eq.${employeeId}&order=requested_at.desc`
      );
      return response.data as DocumentRequest[];
    } catch (error) {
      console.error('Error fetching employee document requests:', error);
      return [];
    }
  },

  async getById(id: string): Promise<DocumentRequest | null> {
    try {
      const response = await api.get(
        `/document_requests?select=*,employees!document_requests_employee_id_fkey(id,first_name,last_name,employee_id,email,department),documents!document_requests_document_id_fkey(id,name,url,type)&id=eq.${id}&limit=1`
      );
      if (response.data && response.data.length > 0) {
        return response.data[0] as DocumentRequest;
      }
      return null;
    } catch (error) {
      console.error('Error fetching document request:', error);
      return null;
    }
  },

  async create(data: {
    employee_id: string;
    document_type: string;
    purpose?: string;
    language?: string;
    destination?: string;
  }): Promise<DocumentRequest> {
    try {
      const response = await adminApi.post('/document_requests', {
        employee_id: data.employee_id,
        document_type: data.document_type,
        purpose: data.purpose,
        language: data.language || 'en',
        destination: data.destination,
        status: 'Pending'
      }, {
        headers: {
          'Prefer': 'return=representation'
        }
      });
      
      if (response.data && response.data.length > 0) {
        return response.data[0] as DocumentRequest;
      }
      return response.data as DocumentRequest;
    } catch (error) {
      console.error('Error creating document request:', error);
      throw error;
    }
  },

  async updateStatus(
    id: string,
    status: 'Pending' | 'In Progress' | 'Completed' | 'Rejected',
    completedBy: string,
    notes?: string
  ): Promise<DocumentRequest> {
    try {
      const updateData: any = {
        status,
        completed_by: completedBy,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'Completed' || status === 'Rejected') {
        updateData.completed_at = new Date().toISOString();
      }
      
      if (notes) {
        updateData.notes = notes;
      }
      
      const response = await adminApi.patch(
        `/document_requests?id=eq.${id}`,
        updateData,
        {
          headers: {
            'Prefer': 'return=representation'
          }
        }
      );
      
      if (response.data && response.data.length > 0) {
        return response.data[0] as DocumentRequest;
      }
      return response.data as DocumentRequest;
    } catch (error) {
      console.error('Error updating document request status:', error);
      throw error;
    }
  },

  async fulfillWithExistingDocument(
    id: string,
    documentId: string,
    completedBy: string,
    notes?: string
  ): Promise<DocumentRequest> {
    try {
      const response = await adminApi.patch(
        `/document_requests?id=eq.${id}`,
        {
          status: 'Completed',
          document_id: documentId,
          completed_by: completedBy,
          completed_at: new Date().toISOString(),
          notes,
          updated_at: new Date().toISOString()
        },
        {
          headers: {
            'Prefer': 'return=representation'
          }
        }
      );
      
      if (response.data && response.data.length > 0) {
        return response.data[0] as DocumentRequest;
      }
      return response.data as DocumentRequest;
    } catch (error) {
      console.error('Error fulfilling document request with existing document:', error);
      throw error;
    }
  },

  async fulfillWithNewDocument(
    id: string,
    documentUrl: string,
    completedBy: string,
    notes?: string
  ): Promise<DocumentRequest> {
    try {
      const response = await adminApi.patch(
        `/document_requests?id=eq.${id}`,
        {
          status: 'Completed',
          uploaded_document_url: documentUrl,
          completed_by: completedBy,
          completed_at: new Date().toISOString(),
          notes,
          updated_at: new Date().toISOString()
        },
        {
          headers: {
            'Prefer': 'return=representation'
          }
        }
      );
      
      if (response.data && response.data.length > 0) {
        return response.data[0] as DocumentRequest;
      }
      return response.data as DocumentRequest;
    } catch (error) {
      console.error('Error fulfilling document request with new document:', error);
      throw error;
    }
  },

  async getCount(filters?: DocumentRequestFilters): Promise<number> {
    try {
      let query = '/document_requests?select=id';
      
      const params: string[] = [];
      
      if (filters?.status && filters.status !== 'all') {
        params.push(`status=eq.${filters.status}`);
      }
      
      if (filters?.employee_id) {
        params.push(`employee_id=eq.${filters.employee_id}`);
      }
      
      if (filters?.document_type) {
        params.push(`document_type=eq.${filters.document_type}`);
      }
      
      if (filters?.date_from) {
        params.push(`requested_at=gte.${filters.date_from}`);
      }
      
      if (filters?.date_to) {
        params.push(`requested_at=lte.${filters.date_to}`);
      }
      
      if (params.length > 0) {
        query += '&' + params.join('&');
      }
      
      const response = await api.get(query, {
        headers: {
          'Prefer': 'count=exact'
        }
      });
      
      // Get count from response headers
      const count = response.headers['content-range']?.split('/')[1] || '0';
      return parseInt(count, 10);
    } catch (error) {
      console.error('Error getting document request count:', error);
      return 0;
    }
  }
};


