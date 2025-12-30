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

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: 'super_admin' | 'admin';
  company_id?: string;
  company_name?: string;
  is_active: boolean;
  assigned_by?: string;
  assigned_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAdminUserData {
  email: string;
  password: string;
  role: 'super_admin' | 'admin';
  company_id?: string;
  first_name?: string;
  last_name?: string;
}

class UserManagementService {
  async getAllAdmins(): Promise<AdminUser[]> {
    try {
      // Fetch super admins and admins separately, then combine
      const [superAdminsResponse, adminsResponse] = await Promise.all([
        api.get('/user_roles', {
          params: {
            select: '*,companies(name)',
            role: 'eq.super_admin',
            order: 'created_at.desc'
          }
        }),
        api.get('/user_roles', {
          params: {
            select: '*,companies(name)',
            role: 'eq.admin',
            order: 'created_at.desc'
          }
        })
      ]);
      
      const allAdmins = [
        ...(superAdminsResponse.data || []),
        ...(adminsResponse.data || [])
      ];
      
      return allAdmins.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        email: item.email,
        role: item.role,
        company_id: item.company_id,
        company_name: item.companies?.name,
        is_active: item.is_active,
        assigned_by: item.assigned_by,
        assigned_at: item.assigned_at,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  async createAdmin(userData: CreateAdminUserData): Promise<{ user: AdminUser; authUser: any }> {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not configured. Check VITE_SUPABASE_SERVICE_KEY.');
      }

      // Step 1: Get role_id from roles table
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .or(`code.eq.${userData.role.toUpperCase()},name.ilike.%${userData.role}%`)
        .limit(1)
        .single();

      let roleId = null;
      if (roleData) {
        roleId = roleData.id;
      }

      // Step 2: Create user in Supabase Auth using Admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: userData.first_name,
          last_name: userData.last_name,
        }
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create admin user: ${authError?.message || 'Unknown error'}`);
      }

      const authUser = authData.user;

      // Step 3: Create user role entry
      const { data: roleDataInsert, error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authUser.id,
          email: userData.email,
          role: userData.role,
          role_id: roleId,
          company_id: userData.company_id || null,
          assigned_by: 'system',
          is_active: true,
        })
        .select()
        .single();

      if (roleError || !roleDataInsert) {
        // Clean up: Delete auth user if role creation fails
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        throw new Error(`Failed to create user role: ${roleError?.message || 'Unknown error'}`);
      }

      // Fetch company name if company_id exists
      let companyName = undefined;
      if (userData.company_id) {
        try {
          const { data: companyData } = await supabase
            .from('companies')
            .select('name')
            .eq('id', userData.company_id)
            .single();
          companyName = companyData?.name;
        } catch (e) {
          // Ignore company fetch errors
        }
      }

      return {
        user: {
          id: roleDataInsert.id,
          user_id: authUser.id,
          email: userData.email,
          role: userData.role,
          company_id: userData.company_id,
          company_name: companyName,
          is_active: true,
          assigned_by: 'system',
          assigned_at: new Date().toISOString(),
          created_at: roleDataInsert.created_at,
          updated_at: roleDataInsert.updated_at
        },
        authUser: {
          id: authUser.id,
          email: authUser.email
        }
      };
    } catch (error: any) {
      console.error('Error creating admin user:', error);
      throw error;
    }
  }

  async updateAdminStatus(userId: string, isActive: boolean): Promise<boolean> {
    try {
      await adminApi.patch('/user_roles', 
        { is_active: isActive },
        {
          params: {
            user_id: `eq.${userId}`
          }
        }
      );
      return true;
    } catch (error) {
      console.error('Error updating admin status:', error);
      throw error;
    }
  }

  async deleteAdmin(userId: string): Promise<boolean> {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not configured.');
      }

      // Delete from user_roles
      await adminApi.delete('/user_roles', {
        params: {
          user_id: `eq.${userId}`
        }
      });

      // Delete from Supabase Auth
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return true;
    } catch (error) {
      console.error('Error deleting admin user:', error);
      throw error;
    }
  }
}

export const userManagementService = new UserManagementService();

