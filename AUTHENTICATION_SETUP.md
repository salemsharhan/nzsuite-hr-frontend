# Authentication & Role-Based Access Control Setup

## Overview
Implemented comprehensive authentication system using Supabase Auth with role-based access control (RBAC). Supports three user roles: Super Admin, Admin, and Employee.

## User Roles

### 1. Super Admin
**Permissions:**
- ✅ Create/Edit/Delete departments, companies, roles, jobs
- ✅ Access all company data
- ✅ All admin permissions
- ✅ All employee permissions
- ✅ System settings access

**Access:**
- All pages and features
- Settings page (masters management)
- Company management
- Full system administration

### 2. Admin
**Permissions:**
- ✅ Create employees for their own company
- ✅ Add documents
- ✅ Manage attendance, leaves, payroll
- ✅ View analytics
- ✅ All employee permissions
- ❌ Cannot access super admin features (settings, company creation)

**Access:**
- Employee management (own company only)
- Documents
- Attendance, Leaves, Payroll
- Analytics
- Recruitment
- Hiring Checklist
- Self Service
- Timesheets

### 3. Employee
**Permissions:**
- ✅ View own attendance
- ✅ View own punches
- ✅ View own payroll
- ✅ View own leaves
- ✅ Self Service portal
- ✅ Timesheets
- ❌ Cannot access admin features

**Access:**
- Dashboard
- Own attendance records
- Own payroll information
- Own leave requests
- Self Service (ESS)
- Timesheets
- Own employee details

## Database Schema

### `user_roles` Table
```sql
- id (UUID, Primary Key)
- user_id (UUID, References auth.users.id, Unique)
- email (TEXT, Unique, Required)
- role (TEXT, Required) - 'super_admin', 'admin', 'employee'
- company_id (UUID, References companies.id, Optional)
- employee_id (UUID, References employees.id, Optional)
- is_active (BOOLEAN, Default: TRUE)
- created_at, updated_at (TIMESTAMPTZ)
```

## Authentication Flow

1. **Login**: User enters email and password
2. **Supabase Auth**: Validates credentials via Supabase Auth
3. **Role Lookup**: Fetches user role from `user_roles` table
4. **Session**: Stores user data in session storage
5. **Route Protection**: Protected routes check user role
6. **Menu Filtering**: Sidebar shows only accessible menu items

## Files Created

### 1. `client/src/services/authService.ts`
- `signIn()` - Authenticate user
- `signOut()` - Sign out user
- `getCurrentUser()` - Get current user from session
- `createUser()` - Create new user with role
- `hasPermission()` - Check if user has required permission
- `canAccessCompany()` - Check company access

### 2. `client/src/contexts/AuthContext.tsx`
- React context for authentication state
- Provides user, loading, signIn, signOut, hasPermission
- Listens to Supabase auth state changes

### 3. `client/src/pages/LoginPage.tsx`
- Login form UI
- Email/password authentication
- Error handling
- Role information display

### 4. `client/src/components/ProtectedRoute.tsx`
- Route protection wrapper
- Checks authentication and permissions
- Redirects to login if not authenticated
- Redirects to dashboard if insufficient permissions

## Route Protection

Routes are protected based on required roles:

```typescript
// Super Admin only
<ProtectedRoute requiredRole="super_admin">
  <SettingsPage />
</ProtectedRoute>

// Admin and Super Admin
<ProtectedRoute requiredRole={['super_admin', 'admin']}>
  <EmployeeListPage />
</ProtectedRoute>

// All authenticated users
<ProtectedRoute requiredRole={['super_admin', 'admin', 'employee']}>
  <AttendancePage />
</ProtectedRoute>
```

## Menu Filtering

Menu items are automatically filtered based on user role:

```typescript
const menuItems = [
  { href: '/settings', roles: ['Admin'] }, // Only super_admin sees this
  { href: '/employees', roles: ['Admin'] }, // super_admin and admin see this
  { href: '/attendance', roles: ['Admin', 'Employee'] }, // All see this
].filter(item => canAccess(item.roles));
```

## Creating Users

### Via Supabase Dashboard
1. Go to Authentication → Users
2. Create user with email/password
3. Manually insert into `user_roles` table:

```sql
INSERT INTO user_roles (user_id, email, role, company_id, is_active)
VALUES (
  'user-uuid-from-auth',
  'user@example.com',
  'super_admin', -- or 'admin', 'employee'
  NULL, -- NULL for super_admin, company_id for admin/employee
  TRUE
);
```

### Via Code (Admin Only)
```typescript
const { user, error } = await authService.createUser(
  'user@example.com',
  'password123',
  'admin',
  'company-uuid', // Optional
  'employee-uuid' // Optional
);
```

## Default Super Admin Users

The following user IDs are mentioned in requirements:
- Current JWT: `6a871b7a-7a5d-4279-a0d8-ed08a86ddb14`
- Standing JWT: `9bc41165-a26f-4662-ad4c-0222a541f99b`

To set these as super admins, create them in Supabase Auth first, then:

```sql
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('6a871b7a-7a5d-4279-a0d8-ed08a86ddb14', 'superadmin1@system.com', 'super_admin', TRUE),
  ('9bc41165-a26f-4662-ad4c-0222a541f99b', 'superadmin2@system.com', 'super_admin', TRUE);
```

## Security Features

1. **Password Hashing**: Supabase Auth handles password hashing
2. **JWT Tokens**: Secure token-based authentication
3. **Session Management**: Automatic token refresh
4. **Role Validation**: Server-side role checking via RLS
5. **Route Protection**: Client and server-side route guards
6. **Company Isolation**: Admins can only access their company data

## Migration Status

✅ Migration `20251221180000_create_auth_users.sql` created

**Note**: Run migration and create users in Supabase Auth before testing login.

## Testing

1. **Create Test Users**:
   - Super Admin: Full access
   - Admin: Company-specific access
   - Employee: Self-access only

2. **Test Login**:
   - Navigate to `/login`
   - Enter credentials
   - Should redirect to dashboard

3. **Test Permissions**:
   - Super Admin: Should see all menu items
   - Admin: Should see admin items but not settings
   - Employee: Should see only employee items

4. **Test Route Protection**:
   - Try accessing `/settings` as admin → Should redirect
   - Try accessing `/employees` as employee → Should redirect

## Next Steps

1. **Create Initial Users**: Set up super admin accounts
2. **Password Policies**: Configure password requirements in Supabase
3. **Email Verification**: Enable email verification if needed
4. **Password Reset**: Implement password reset flow
5. **Audit Logging**: Log all authentication events
6. **2FA**: Add two-factor authentication (optional)

