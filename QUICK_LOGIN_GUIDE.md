# Quick Login Guide

## ✅ Super Admin Users - Already Set Up!

The following super admin users have been configured in the database:

1. **superadmin1@system.com**
   - User ID: `6a871b7a-7a5d-4279-a0d8-ed08a86ddb14`
   - Role: Super Admin

2. **superadmin2@system.com**
   - User ID: `9bc41165-a26f-4662-ad4c-0222a541f99b`
   - Role: Super Admin

### To Login as Super Admin:

1. **Create User in Supabase Auth:**
   - Go to: https://app.supabase.com/project/wqfbltrnlwngyohvxjjq/auth/users
   - Click **"Add User"**
   - Email: `superadmin1@system.com` (or `superadmin2@system.com`)
   - Password: (set your password)
   - **Important**: When creating, use the User ID from above, OR create a new user and update the `user_roles` table with the new User ID

2. **If User ID Doesn't Match:**
   - After creating user in Supabase Auth, copy the new User ID
   - Run this SQL in Supabase SQL Editor:
   ```sql
   UPDATE user_roles 
   SET user_id = 'NEW_USER_ID_FROM_AUTH'
   WHERE email = 'superadmin1@system.com';
   ```

3. **Login:**
   - Go to `/login` in your app
   - Email: `superadmin1@system.com`
   - Password: (the password you set)
   - You should see all menu items including **Settings**

## 🔧 Setting Up Admin and Employee Users

### Step 1: Create Users in Supabase Auth

1. Go to: https://app.supabase.com/project/wqfbltrnlwngyohvxjjq/auth/users
2. Create users:
   - **Admin**: `admin@company.com` + password
   - **Employee**: `employee@company.com` + password
3. Copy the User IDs after creation

### Step 2: Link Users to Roles (SQL Editor)

Go to: https://app.supabase.com/project/wqfbltrnlwngyohvxjjq/sql/new

**For Admin:**
```sql
-- Replace YOUR_ADMIN_USER_ID with actual User ID from Supabase Auth
INSERT INTO user_roles (user_id, role_id, email, role, company_id, assigned_by, is_active)
SELECT 
  'YOUR_ADMIN_USER_ID'::UUID,
  (SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1), -- Use any role, we use 'role' column for auth
  'admin@company.com',
  'admin',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  'system',
  TRUE
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;
```

**For Employee:**
```sql
-- Replace YOUR_EMPLOYEE_USER_ID with actual User ID from Supabase Auth
-- First ensure employee record exists
INSERT INTO employees (employee_id, first_name, last_name, email, status, company_id)
SELECT 
  'EMP-TEST-001',
  'Test',
  'Employee',
  'employee@company.com',
  'Active',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1)
ON CONFLICT DO NOTHING;

-- Then create employee user
INSERT INTO user_roles (user_id, role_id, email, role, company_id, employee_id, assigned_by, is_active)
SELECT 
  'YOUR_EMPLOYEE_USER_ID'::UUID,
  (SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1), -- Use any role, we use 'role' column for auth
  'employee@company.com',
  'employee',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  (SELECT id FROM employees WHERE email = 'employee@company.com' LIMIT 1),
  'system',
  TRUE
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;
```

### Step 3: Login

1. Go to `/login`
2. Enter email and password
3. You'll be redirected based on your role

## 📋 Complete Setup Script

Here's a complete script you can run in Supabase SQL Editor after creating users in Auth:

```sql
-- ============================================
-- Complete User Setup
-- ============================================
-- After creating users in Supabase Auth Dashboard, update the User IDs below

-- Get or create default company
INSERT INTO companies (name, code, description, is_active)
VALUES ('Default Company', 'DEFAULT', 'Default company', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Get Super Admin role (for role_id - we use 'role' column for actual auth role)
DO $$
DECLARE
  super_admin_role_id UUID;
BEGIN
  SELECT id INTO super_admin_role_id FROM roles WHERE name = 'Super Admin' LIMIT 1;
  
  IF super_admin_role_id IS NULL THEN
    INSERT INTO roles (name, code, description, is_active)
    VALUES ('Super Admin', 'SUPER_ADMIN', 'Super Administrator', TRUE)
    RETURNING id INTO super_admin_role_id;
  END IF;
END $$;

-- Super Admin 1 (already set up, but you can update if needed)
-- UPDATE user_roles SET user_id = 'YOUR_NEW_USER_ID' WHERE email = 'superadmin1@system.com';

-- Super Admin 2 (already set up, but you can update if needed)
-- UPDATE user_roles SET user_id = 'YOUR_NEW_USER_ID' WHERE email = 'superadmin2@system.com';

-- Admin User
-- REPLACE 'YOUR_ADMIN_USER_ID' with actual User ID from Supabase Auth
INSERT INTO user_roles (user_id, role_id, email, role, company_id, assigned_by, is_active)
SELECT 
  'YOUR_ADMIN_USER_ID'::UUID,  -- Replace this
  (SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1),
  'admin@company.com',
  'admin',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  'system',
  TRUE
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;

-- Employee User
-- First create employee record
INSERT INTO employees (employee_id, first_name, last_name, email, status, company_id)
SELECT 
  'EMP-TEST-001',
  'Test',
  'Employee',
  'employee@company.com',
  'Active',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1)
ON CONFLICT DO NOTHING;

-- Then create employee user
-- REPLACE 'YOUR_EMPLOYEE_USER_ID' with actual User ID from Supabase Auth
INSERT INTO user_roles (user_id, role_id, email, role, company_id, employee_id, assigned_by, is_active)
SELECT 
  'YOUR_EMPLOYEE_USER_ID'::UUID,  -- Replace this
  (SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1),
  'employee@company.com',
  'employee',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  (SELECT id FROM employees WHERE email = 'employee@company.com' LIMIT 1),
  'system',
  TRUE
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;

-- Verify all users
SELECT 
  ur.email,
  ur.role,
  ur.is_active,
  c.name as company_name,
  e.first_name || ' ' || e.last_name as employee_name
FROM user_roles ur
LEFT JOIN companies c ON ur.company_id = c.id
LEFT JOIN employees e ON ur.employee_id = e.id
ORDER BY ur.role, ur.email;
```

## 🎯 Quick Test

1. **Super Admin**: Already configured - just create user in Auth with matching email
2. **Admin**: Create user → Run SQL → Login
3. **Employee**: Create user → Run SQL → Login

## 📝 Notes

- The `role_id` column is required by the table structure but we use the `role` text column for actual authentication roles
- Super Admin users are already in the database, you just need to create them in Supabase Auth
- Make sure the email in Supabase Auth matches the email in `user_roles` table
- User IDs must match exactly between Supabase Auth and `user_roles` table

