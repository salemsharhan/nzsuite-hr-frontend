import { supabase } from './supabase';

export type UserRole = 'super_admin' | 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  company_id?: string;
  employee_id?: string;
  is_active: boolean;
}

export interface UserRoleData {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  company_id?: string;
  employee_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class AuthService {
  async signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return { user: null, error: authError };
      }

      if (!authData.user) {
        return { user: null, error: new Error('No user returned from authentication') };
      }

      // Get user role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('is_active', true)
        .single();

      if (roleError || !roleData) {
        return { user: null, error: new Error('User role not found. Please contact administrator.') };
      }

      const user: User = {
        id: authData.user.id,
        email: roleData.email,
        role: roleData.role as UserRole,
        company_id: roleData.company_id || undefined,
        employee_id: roleData.employee_id || undefined,
        is_active: roleData.is_active,
      };

      // Store user in session storage
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('access_token', authData.session?.access_token || '');

      return { user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('access_token');
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      // Check session storage first
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }

      // Get current session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return null;
      }

      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (roleError || !roleData) {
        return null;
      }

      const user: User = {
        id: session.user.id,
        email: roleData.email,
        role: roleData.role as UserRole,
        company_id: roleData.company_id || undefined,
        employee_id: roleData.employee_id || undefined,
        is_active: roleData.is_active,
      };

      sessionStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async createUser(email: string, password: string, role: UserRole, companyId?: string, employeeId?: string): Promise<{ user: User | null; error: Error | null }> {
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError || !authData.user) {
        return { user: null, error: authError || new Error('Failed to create user') };
      }

      // Create user role entry
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          email,
          role,
          company_id: companyId || null,
          employee_id: employeeId || null,
          is_active: true,
        })
        .select()
        .single();

      if (roleError || !roleData) {
        // Clean up auth user if role creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { user: null, error: roleError || new Error('Failed to create user role') };
      }

      const user: User = {
        id: authData.user.id,
        email: roleData.email,
        role: roleData.role as UserRole,
        company_id: roleData.company_id || undefined,
        employee_id: roleData.employee_id || undefined,
        is_active: roleData.is_active,
      };

      return { user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  // Check if user has permission
  hasPermission(user: User | null, requiredRole: UserRole | UserRole[]): boolean {
    if (!user || !user.is_active) return false;

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Super admin has all permissions
    if (user.role === 'super_admin') return true;
    
    // Check if user's role is in the required roles array
    // This handles cases like ['super_admin', 'admin'] where admin should have access
    if (roles.includes(user.role)) return true;
    
    return false;
  }

  // Check if user can access company data
  canAccessCompany(user: User | null, companyId: string): boolean {
    if (!user || !user.is_active) return false;
    
    // Super admin can access all companies
    if (user.role === 'super_admin') return true;
    
    // Admin and employee can only access their own company
    return user.company_id === companyId;
  }
}

export const authService = new AuthService();

