import { api, adminApi } from './api';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Create admin client for user management (uses service role key)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export interface Company {
  id: string;
  name: string;
  code?: string;
  description?: string;
  api_endpoint?: string;
  api_key?: string;
  api_secret?: string;
  sync_enabled: boolean;
  sync_frequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  last_sync_at?: string;
  sync_status: 'idle' | 'syncing' | 'success' | 'error';
  sync_error_message?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyAdmin {
  id: string;
  company_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyData {
  name: string;
  code?: string;
  description?: string;
  api_endpoint?: string;
  api_key?: string;
  api_secret?: string;
  sync_enabled?: boolean;
  sync_frequency?: 'daily' | 'weekly' | 'monthly' | 'manual';
  // Admin credentials
  admin_email: string;
  admin_password: string;
  admin_first_name?: string;
  admin_last_name?: string;
}

class CompanyService {
  async getAll(): Promise<Company[]> {
    const response = await api.get('/companies', {
      params: {
        select: '*',
        order: 'name.asc',
        is_active: 'eq.true'
      }
    });
    return response.data || [];
  }

  async getById(id: string): Promise<Company> {
    const response = await api.get(`/companies`, {
      params: {
        id: `eq.${id}`,
        select: '*'
      }
    });
    if (response.data && response.data.length > 0) {
      return response.data[0];
    }
    throw new Error('Company not found');
  }

  async create(companyData: CreateCompanyData): Promise<{ company: Company; admin: CompanyAdmin; authUser: any }> {
    try {
      // Step 1: Create the company
      const companyResponse = await adminApi.post('/companies', {
        name: companyData.name,
        code: companyData.code || null,
        description: companyData.description || null,
        api_endpoint: companyData.api_endpoint || null,
        api_key: companyData.api_key || null,
        api_secret: companyData.api_secret || null,
        sync_enabled: companyData.sync_enabled !== undefined ? companyData.sync_enabled : false,
        sync_frequency: companyData.sync_frequency || 'manual',
        is_active: true
      });

      // Extract company - Supabase returns array with Prefer: return=representation
      let company: Company;
      if (Array.isArray(companyResponse.data)) {
        company = companyResponse.data[0];
      } else {
        company = companyResponse.data;
      }

      if (!company || !company.id) {
        throw new Error('Failed to create company: Invalid response');
      }

      // Step 2: Get admin role_id from roles table
      const { data: adminRoleData } = await supabase
        .from('roles')
        .select('id')
        .eq('code', 'ADMIN')
        .or('name.ilike.Admin')
        .single();

      let roleId = null;
      if (adminRoleData) {
        roleId = adminRoleData.id;
      } else {
        // If admin role doesn't exist, try to get any role with 'admin' in the name
        const { data: fallbackRole } = await supabase
          .from('roles')
          .select('id')
          .ilike('name', '%admin%')
          .limit(1)
          .single();
        if (fallbackRole) {
          roleId = fallbackRole.id;
        }
      }

      // Step 3: Create user in Supabase Auth using Admin API (bypasses email confirmation)
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not configured. Check VITE_SUPABASE_SERVICE_KEY.');
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: companyData.admin_email,
        password: companyData.admin_password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: companyData.admin_first_name,
          last_name: companyData.admin_last_name,
        }
      });

      if (authError || !authData.user) {
        // Rollback: Delete the company if user creation fails
        await adminApi.delete(`/companies?id=eq.${company.id}`);
        throw new Error(`Failed to create admin user: ${authError?.message || 'Unknown error'}`);
      }

      const authUser = authData.user;

      // Step 4: Create user role entry with role_id and company_id
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authUser.id,
          email: companyData.admin_email,
          role: 'admin',
          role_id: roleId,
          company_id: company.id,
          assigned_by: 'system',
          is_active: true,
        })
        .select()
        .single();

      if (roleError || !roleData) {
        // Clean up: Delete auth user and company if role creation fails
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        await adminApi.delete(`/companies?id=eq.${company.id}`);
        throw new Error(`Failed to create user role: ${roleError?.message || 'Unknown error'}`);
      }

      // Step 5: Create entry in company_admins table (for backward compatibility)
      let admin: CompanyAdmin;
      try {
        const adminResponse = await adminApi.post('/company_admins', {
          company_id: company.id,
          email: companyData.admin_email,
          password_hash: 'hashed_in_auth', // Password is stored in Supabase Auth, not here
          first_name: companyData.admin_first_name || null,
          last_name: companyData.admin_last_name || null,
          is_active: true
        });

        // Extract admin - Supabase returns array with Prefer: return=representation
        if (Array.isArray(adminResponse.data)) {
          admin = adminResponse.data[0];
        } else {
          admin = adminResponse.data;
        }
      } catch (adminError: any) {
        // If company_admins insert fails, log but don't fail the whole operation
        // since the user is already created in Auth and user_roles
        console.warn('Failed to create company_admins entry:', adminError);
        admin = {
          id: authUser.id,
          company_id: company.id,
          email: companyData.admin_email,
          first_name: companyData.admin_first_name,
          last_name: companyData.admin_last_name,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      return {
        company,
        admin,
        authUser: {
          id: authUser.id,
          email: authUser.email || companyData.admin_email,
          role: 'admin' as const,
          company_id: company.id,
          is_active: true
        }
      };
    } catch (error: any) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Company>): Promise<Company> {
    const response = await adminApi.patch(`/companies`, updates, {
      params: {
        id: `eq.${id}`
      }
    });
    return response.data;
  }

  async delete(id: string): Promise<boolean> {
    await adminApi.delete(`/companies`, {
      params: {
        id: `eq.${id}`
      }
    });
    return true;
  }

  async syncEmployees(companyId: string): Promise<{ success: boolean; message: string; count?: number }> {
    const response = await adminApi.post(`/companies/${companyId}/sync`, {});
    return response.data;
  }

  async getAdmins(companyId: string): Promise<CompanyAdmin[]> {
    const response = await api.get('/company_admins', {
      params: {
        company_id: `eq.${companyId}`,
        select: '*',
        order: 'created_at.desc'
      }
    });
    return response.data || [];
  }
}

export const companyService = new CompanyService();

