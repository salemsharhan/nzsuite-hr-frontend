import { api, adminApi } from './api';

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class DepartmentService {
  async getAll(): Promise<Department[]> {
    const response = await api.get('/departments', {
      params: {
        select: '*',
        order: 'name.asc',
        is_active: 'eq.true'
      }
    });
    return response.data || [];
  }

  async getById(id: string): Promise<Department> {
    const response = await api.get(`/departments`, {
      params: {
        id: `eq.${id}`,
        select: '*'
      }
    });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    throw new Error('Department not found');
  }

  async create(department: Omit<Department, 'id' | 'created_at' | 'updated_at'>): Promise<Department> {
    const response = await adminApi.post('/departments', {
      name: department.name,
      code: department.code || null,
      description: department.description || null,
      is_active: department.is_active !== undefined ? department.is_active : true
    });
    return response.data;
  }

  async update(id: string, updates: Partial<Department>): Promise<Department> {
    const response = await adminApi.patch(`/departments`, updates, {
      params: {
        id: `eq.${id}`
      }
    });
    return response.data;
  }

  async delete(id: string): Promise<boolean> {
    await adminApi.delete(`/departments`, {
      params: {
        id: `eq.${id}`
      }
    });
    return true;
  }
}

export const departmentService = new DepartmentService();

