import { api, adminApi } from './api';

export interface Job {
  id: string;
  role_id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  role?: {
    id: string;
    name: string;
  };
}

class JobService {
  async getAll(roleId?: string): Promise<Job[]> {
    const params: any = {
      select: '*,role:roles(id,name)',
      order: 'name.asc',
      is_active: 'eq.true'
    };
    
    if (roleId) {
      params.role_id = `eq.${roleId}`;
    }
    
    const response = await api.get('/jobs', { params });
    return response.data || [];
  }

  async getById(id: string): Promise<Job> {
    const response = await api.get(`/jobs`, {
      params: {
        id: `eq.${id}`,
        select: '*,role:roles(id,name)'
      }
    });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    throw new Error('Job not found');
  }

  async getByRoleId(roleId: string): Promise<Job[]> {
    const response = await api.get('/jobs', {
      params: {
        role_id: `eq.${roleId}`,
        select: '*,role:roles(id,name)',
        order: 'name.asc',
        is_active: 'eq.true'
      }
    });
    return response.data || [];
  }

  async create(job: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'role'>): Promise<Job> {
    const response = await adminApi.post('/jobs', {
      role_id: job.role_id,
      name: job.name,
      code: job.code || null,
      description: job.description || null,
      is_active: job.is_active !== undefined ? job.is_active : true
    });
    return response.data;
  }

  async update(id: string, updates: Partial<Job>): Promise<Job> {
    const response = await adminApi.patch(`/jobs`, updates, {
      params: {
        id: `eq.${id}`
      }
    });
    return response.data;
  }

  async delete(id: string): Promise<boolean> {
    await adminApi.delete(`/jobs`, {
      params: {
        id: `eq.${id}`
      }
    });
    return true;
  }
}

export const jobService = new JobService();



