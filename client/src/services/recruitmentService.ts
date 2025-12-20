import { supabase } from './supabase';

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
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data as Candidate[];
    } catch (error) {
      console.error('Error fetching candidates:', error);
      return [];
    }
  },

  async create(candidate: Omit<Candidate, 'id' | 'created_at' | 'status'>) {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .insert([{ ...candidate, status: 'Applied' }])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating candidate:', error);
      throw error;
    }
  },

  async updateStatus(id: string, status: Candidate['status']) {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating candidate status:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting candidate:', error);
      throw error;
    }
  }
};
