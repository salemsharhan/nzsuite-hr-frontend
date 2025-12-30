import { api, adminApi } from './api';

export interface Candidate {
  id: string;
  name: string;
  email: string;
  position?: string; // Maps to role in database
  role?: string; // Actual database column
  stage?: string; // Actual database column for status
  status: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired';
  created_at: string;
  avatar_url?: string;
}

export const recruitmentService = {
  async getAll() {
    try {
      // Use adminApi to bypass RLS restrictions for admin users
      const response = await adminApi.get('/candidates', {
        params: {
          select: '*',
          order: 'created_at.desc'
        }
      });
      // Map database columns to interface
      const candidates = (response.data || []).map((c: any) => ({
        ...c,
        position: c.position || c.role, // Map role to position
        status: c.status || c.stage // Map stage to status
      }));
      return candidates as Candidate[];
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return [];
      }
      console.error('Error fetching candidates:', error);
      return [];
    }
  },

  async create(candidate: Omit<Candidate, 'id' | 'created_at' | 'status'>) {
    try {
      // Map position to role for database
      const payload = {
        name: candidate.name,
        email: candidate.email,
        role: candidate.position || candidate.role, // Use position if provided, fallback to role
        position: candidate.position || candidate.role, // Also set position for compatibility
        stage: 'Applied', // Use stage as the database column
        phone: candidate.phone || null
      };
      
      const response = await adminApi.post('/candidates', payload);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating candidate:', error);
      throw error;
    }
  },

  async updateStatus(id: string, status: Candidate['status']) {
    try {
      // Map status to stage for database
      const response = await adminApi.patch(`/candidates?id=eq.${id}`, { 
        stage: status, // Use stage as the database column
        position: undefined // Don't send position in update
      });
      if (response.data && response.data.length > 0) {
        const candidate = response.data[0];
        return {
          ...candidate,
          position: candidate.position || candidate.role,
          status: candidate.status || candidate.stage
        };
      }
      return response.data;
    } catch (error) {
      console.error('Error updating candidate status:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await adminApi.delete(`/candidates`, {
        params: {
          id: `eq.${id}`
        }
      });
      return true;
    } catch (error) {
      console.error('Error deleting candidate:', error);
      throw error;
    }
  }
};
