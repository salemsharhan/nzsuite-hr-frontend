import { api, adminApi } from './api';

export interface Role {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class RoleService {
  async getAll(): Promise<Role[]> {
    const response = await api.get('/roles', {
      params: {
        select: '*',
        order: 'name.asc',
        is_active: 'eq.true'
      }
    });
    return response.data || [];
  }

  async getById(id: string): Promise<Role> {
    const response = await api.get(`/roles`, {
      params: {
        id: `eq.${id}`,
        select: '*'
      }
    });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    throw new Error('Role not found');
  }

  async create(role: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Promise<Role> {
    const response = await adminApi.post('/roles', {
      name: role.name,
      code: role.code || null,
      description: role.description || null,
      is_active: role.is_active !== undefined ? role.is_active : true
    });
    return response.data;
  }

  async update(id: string, updates: Partial<Role>): Promise<Role> {
    const response = await adminApi.patch(`/roles`, updates, {
      params: {
        id: `eq.${id}`
      }
    });
    return response.data;
  }

  async delete(id: string): Promise<boolean> {
    await adminApi.delete(`/roles`, {
      params: {
        id: `eq.${id}`
      }
    });
    return true;
  }
}

export const roleService = new RoleService();



