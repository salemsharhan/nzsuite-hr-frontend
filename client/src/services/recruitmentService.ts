import { api, adminApi } from './api';

export interface Candidate {
  id: string;
  name: string;
  email: string;
  position: string;
  status: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired';
  created_at: string;
  avatar_url?: string;
}

export const recruitmentService = {
  async getAll() {
    try {
      const response = await api.get('/candidates?select=*&order=created_at.desc');
      return response.data as Candidate[];
    } catch (error) {
      console.error('Error fetching candidates:', error);
      return [];
    }
  },

  async create(candidate: Omit<Candidate, 'id' | 'created_at' | 'status'>) {
    try {
      const response = await adminApi.post('/candidates', { ...candidate, status: 'Applied' });
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
      const response = await adminApi.patch(`/candidates?id=eq.${id}`, { status });
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating candidate status:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      await adminApi.delete(`/candidates?id=eq.${id}`);
      return true;
    } catch (error) {
      console.error('Error deleting candidate:', error);
      throw error;
    }
  }
};
