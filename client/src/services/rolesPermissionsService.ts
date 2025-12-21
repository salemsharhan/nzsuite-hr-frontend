import { api, adminApi } from './api';

export type PermissionAction = 'view' | 'create' | 'edit' | 'approve' | 'delete' | 'export';

export interface Permission {
  module: string;
  actions: PermissionAction[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  effective_date?: string;
  assigned_by: string;
  assigned_at: string;
  roles?: Role;
  users?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: any;
  performed_by: string;
  performed_at: string;
}

// Default system roles
export const SYSTEM_ROLES = [
  {
    name: 'Admin',
    description: 'Full system access with all permissions',
    permissions: [
      { module: 'HR', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] as PermissionAction[] },
      { module: 'Attendance', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] as PermissionAction[] },
      { module: 'Payroll', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] as PermissionAction[] },
      { module: 'Recruitment', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] as PermissionAction[] },
      { module: 'Analytics', actions: ['view', 'export'] as PermissionAction[] },
      { module: 'Settings', actions: ['view', 'edit'] as PermissionAction[] }
    ]
  },
  {
    name: 'HR',
    description: 'HR department with employee and attendance management',
    permissions: [
      { module: 'HR', actions: ['view', 'create', 'edit', 'export'] as PermissionAction[] },
      { module: 'Attendance', actions: ['view', 'create', 'edit', 'export'] as PermissionAction[] },
      { module: 'Recruitment', actions: ['view', 'create', 'edit', 'export'] as PermissionAction[] },
      { module: 'Analytics', actions: ['view'] as PermissionAction[] }
    ]
  },
  {
    name: 'Manager',
    description: 'Team manager with approval permissions',
    permissions: [
      { module: 'HR', actions: ['view'] as PermissionAction[] },
      { module: 'Attendance', actions: ['view', 'approve'] as PermissionAction[] },
      { module: 'Payroll', actions: ['view'] as PermissionAction[] },
      { module: 'Analytics', actions: ['view'] as PermissionAction[] }
    ]
  },
  {
    name: 'Finance',
    description: 'Finance department with payroll access',
    permissions: [
      { module: 'HR', actions: ['view'] as PermissionAction[] },
      { module: 'Payroll', actions: ['view', 'create', 'edit', 'approve', 'export'] as PermissionAction[] },
      { module: 'Analytics', actions: ['view', 'export'] as PermissionAction[] }
    ]
  },
  {
    name: 'Supervisor',
    description: 'Team supervisor with limited approval rights',
    permissions: [
      { module: 'HR', actions: ['view'] as PermissionAction[] },
      { module: 'Attendance', actions: ['view', 'approve'] as PermissionAction[] }
    ]
  }
];

export const rolesPermissionsService = {
  async getAllRoles() {
    try {
      const response = await api.get('/roles?select=*&order=created_at.desc');
      return response.data as Role[];
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn('roles table not found');
        return [];
      }
      console.error('API error fetching roles:', err.message);
      return [];
    }
  },

  async getRoleById(roleId: string) {
    try {
      const response = await api.get(`/roles?id=eq.${roleId}&select=*`);
      if (response.data && response.data.length > 0) {
        return response.data[0] as Role;
      }
      return null;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching role ${roleId}:`, err);
      return null;
    }
  },

  async createRole(role: Omit<Role, 'id' | 'created_at' | 'updated_at'>) {
    try {
      const payload = {
        name: role.name,
        description: role.description,
        is_system_role: role.is_system_role || false,
        permissions: JSON.stringify(role.permissions)
      };

      const response = await adminApi.post('/roles', payload, {
        headers: {
          'Prefer': 'return=representation'
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  },

  async updateRole(roleId: string, updates: Partial<Role>) {
    try {
      const payload: any = {};
      
      if (updates.name) payload.name = updates.name;
      if (updates.description) payload.description = updates.description;
      if (updates.permissions) payload.permissions = JSON.stringify(updates.permissions);

      const response = await adminApi.patch(`/roles?id=eq.${roleId}`, payload, {
        headers: {
          'Prefer': 'return=representation'
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  },

  async deleteRole(roleId: string) {
    try {
      await adminApi.delete(`/roles?id=eq.${roleId}`);
      return true;
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  },

  async getUserRoles() {
    try {
      const response = await api.get('/user_roles?select=*,roles(*),users(first_name,last_name,email)&order=assigned_at.desc');
      return response.data as UserRole[];
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn('user_roles table not found');
        return [];
      }
      console.error('API error fetching user roles:', err.message);
      return [];
    }
  },

  async assignRole(userId: string, roleId: string, assignedBy: string, effectiveDate?: string) {
    try {
      const payload = {
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
        effective_date: effectiveDate || new Date().toISOString()
      };

      const response = await adminApi.post('/user_roles', payload, {
        headers: {
          'Prefer': 'return=representation'
        }
      });

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return response.data;
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  },

  async removeUserRole(userRoleId: string) {
    try {
      await adminApi.delete(`/user_roles?id=eq.${userRoleId}`);
      return true;
    } catch (error) {
      console.error('Error removing user role:', error);
      throw error;
    }
  },

  async getAuditLogs(entityType?: string, entityId?: string) {
    try {
      let url = '/audit_logs?select=*&order=performed_at.desc&limit=100';
      
      if (entityType) {
        url += `&entity_type=eq.${entityType}`;
      }
      if (entityId) {
        url += `&entity_id=eq.${entityId}`;
      }

      const response = await api.get(url);
      return response.data as AuditLog[];
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn('audit_logs table not found');
        return [];
      }
      console.error('API error fetching audit logs:', err.message);
      return [];
    }
  },

  async logAudit(action: string, entityType: string, entityId: string, changes: any, performedBy: string) {
    try {
      const payload = {
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes: JSON.stringify(changes),
        performed_by: performedBy
      };

      await adminApi.post('/audit_logs', payload);
      return true;
    } catch (error) {
      console.error('Error logging audit:', error);
      return false;
    }
  },

  // Helper function to check if user has permission
  hasPermission(userRoles: UserRole[], module: string, action: PermissionAction): boolean {
    for (const userRole of userRoles) {
      if (!userRole.roles) continue;
      
      const role = userRole.roles;
      const permissions = typeof role.permissions === 'string' 
        ? JSON.parse(role.permissions) 
        : role.permissions;

      const modulePermission = permissions.find((p: Permission) => p.module === module);
      if (modulePermission && modulePermission.actions.includes(action)) {
        return true;
      }
    }
    return false;
  }
};
