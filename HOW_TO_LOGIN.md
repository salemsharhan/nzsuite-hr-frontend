# How to Login for Each Role

This guide explains how to create users and login for each role (Super Admin, Admin, Employee).

## Step 1: Create Users in Supabase Auth

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Authentication → Users**
4. Click **"Add User"** or **"Create User"**
5. Fill in the form:
   - **Email**: Enter email (e.g., `superadmin@system.com`)
   - **Password**: Enter a strong password
   - **Auto Confirm User**: ✅ Check this (to skip email verification)
6. Click **"Create User"**
7. **Copy the User ID** (you'll need this for Step 2)

Repeat for each user you want to create:
- Super Admin: `superadmin@system.com`
- Admin: `admin@company.com`
- Employee: `employee@company.com`

### Option B: Via SQL (Advanced)

You can also create users programmatically, but Supabase Auth requires special functions. It's easier to use the Dashboard.

## Step 2: Link Users to Roles

After creating users in Supabase Auth, you need to link them to roles in the `user_roles` table.

### Go to Supabase SQL Editor

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**

### Create Super Admin

```sql
-- Replace 'USER_ID_FROM_STEP_1' with the actual User ID from Supabase Auth
-- Replace 'superadmin@system.com' with the email you used

INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('USER_ID_FROM_STEP_1', 'superadmin@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
```

**Example:**
```sql
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('6a871b7a-7a5d-4279-a0d8-ed08a86ddb14', 'superadmin1@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
```

### Create Admin (with Company)

First, get a company ID:
```sql
-- Get company ID
SELECT id, name FROM companies LIMIT 1;
```

Then create admin user:
```sql
-- Replace USER_ID, COMPANY_ID, and email
INSERT INTO user_roles (user_id, email, role, company_id, is_active)
VALUES 
  ('USER_ID_FROM_STEP_1', 'admin@company.com', 'admin', 'COMPANY_ID', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;
```

**Example:**
```sql
-- First, get a company ID (or create one in Settings → Companies)
SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1;

-- Then insert admin (replace with actual IDs)
INSERT INTO user_roles (user_id, email, role, company_id, is_active)
VALUES 
  ('9bc41165-a26f-4662-ad4c-0222a541f99b', 'admin@company.com', 'admin', 
   (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1), 
   TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;
```

### Create Employee (with Company and Employee Record)

First, get company and employee IDs:
```sql
-- Get company and employee IDs
SELECT c.id as company_id, e.id as employee_id 
FROM companies c 
CROSS JOIN employees e 
LIMIT 1;
```

Then create employee user:
```sql
-- Replace USER_ID, COMPANY_ID, EMPLOYEE_ID, and email
INSERT INTO user_roles (user_id, email, role, company_id, employee_id, is_active)
VALUES 
  ('USER_ID_FROM_STEP_1', 'employee@company.com', 'employee', 'COMPANY_ID', 'EMPLOYEE_ID', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;
```

**Example:**
```sql
-- Insert employee user (replace with actual IDs)
INSERT INTO user_roles (user_id, email, role, company_id, employee_id, is_active)
VALUES 
  ('YOUR_EMPLOYEE_USER_ID', 'employee@company.com', 'employee', 
   (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
   (SELECT id FROM employees LIMIT 1),
   TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;
```

## Step 3: Complete Setup Script

Here's a complete script to set up all three roles at once:

```sql
-- ============================================
-- Complete User Setup Script
-- ============================================

-- Step 1: Create users in Supabase Auth Dashboard first, then run this

-- Step 2: Update these values with actual User IDs from Supabase Auth
-- Get User IDs from: Authentication → Users → Click on user → Copy "User UID"

-- Super Admin 1
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('6a871b7a-7a5d-4279-a0d8-ed08a86ddb14', 'superadmin1@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

-- Super Admin 2
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('9bc41165-a26f-4662-ad4c-0222a541f99b', 'superadmin2@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

-- Admin (replace USER_ID_3 with actual ID from Supabase Auth)
-- First, ensure you have a company
DO $$
DECLARE
  company_uuid UUID;
  admin_user_id UUID := 'YOUR_ADMIN_USER_ID_HERE'; -- Replace this
BEGIN
  -- Get or create default company
  SELECT id INTO company_uuid FROM companies WHERE name = 'Default Company' LIMIT 1;
  
  IF company_uuid IS NULL THEN
    INSERT INTO companies (name, code, description, is_active)
    VALUES ('Default Company', 'DEFAULT', 'Default company', TRUE)
    RETURNING id INTO company_uuid;
  END IF;
  
  -- Create admin user
  INSERT INTO user_roles (user_id, email, role, company_id, is_active)
  VALUES (admin_user_id, 'admin@company.com', 'admin', company_uuid, TRUE)
  ON CONFLICT (user_id) DO UPDATE 
  SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;
END $$;

-- Employee (replace USER_ID_4 with actual ID from Supabase Auth)
DO $$
DECLARE
  company_uuid UUID;
  employee_uuid UUID;
  employee_user_id UUID := 'YOUR_EMPLOYEE_USER_ID_HERE'; -- Replace this
BEGIN
  -- Get company
  SELECT id INTO company_uuid FROM companies WHERE name = 'Default Company' LIMIT 1;
  
  -- Get first employee
  SELECT id INTO employee_uuid FROM employees LIMIT 1;
  
  IF company_uuid IS NOT NULL AND employee_uuid IS NOT NULL THEN
    -- Create employee user
    INSERT INTO user_roles (user_id, email, role, company_id, employee_id, is_active)
    VALUES (employee_user_id, 'employee@company.com', 'employee', company_uuid, employee_uuid, TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;
  END IF;
END $$;

-- Verify all users were created
SELECT 
  ur.email,
  ur.role,
  c.name as company_name,
  e.first_name || ' ' || e.last_name as employee_name,
  ur.is_active
FROM user_roles ur
LEFT JOIN companies c ON ur.company_id = c.id
LEFT JOIN employees e ON ur.employee_id = e.id
ORDER BY ur.role, ur.email;
```

## Step 4: Test Login

### For Super Admin

1. Navigate to `/login` in your application
2. Enter credentials:
   - **Email**: `superadmin1@system.com` (or the email you used)
   - **Password**: (the password you set in Supabase Auth)
3. Click **"Sign In"**
4. You should see:
   - ✅ All menu items including **Settings**
   - ✅ Can access all pages
   - ✅ Can create departments, companies, roles, jobs

### For Admin

1. Navigate to `/login`
2. Enter credentials:
   - **Email**: `admin@company.com` (or the email you used)
   - **Password**: (the password you set in Supabase Auth)
3. Click **"Sign In"**
4. You should see:
   - ✅ Menu items: Dashboard, Employees, Attendance, Leaves, Payroll, Documents, Analytics, etc.
   - ❌ **NO Settings** menu item
   - ✅ Can create employees for their company
   - ✅ Can add documents

### For Employee

1. Navigate to `/login`
2. Enter credentials:
   - **Email**: `employee@company.com` (or the email you used)
   - **Password**: (the password you set in Supabase Auth)
3. Click **"Sign In"**
4. You should see:
   - ✅ Menu items: Dashboard, Attendance, Leaves, Payroll, Self Service, Timesheets
   - ❌ **NO Employees** menu item
   - ❌ **NO Documents** menu item
   - ❌ **NO Analytics** menu item
   - ✅ Can view own attendance, payroll, leaves

## Quick Test Users Setup

Here's a quick script to create test users if you want to test immediately:

```sql
-- Quick Test: Create a test super admin
-- First create user in Supabase Auth Dashboard with email: test@superadmin.com
-- Then get the User ID and run:

-- Replace 'YOUR_USER_ID' with actual ID from Supabase Auth
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('YOUR_USER_ID', 'test@superadmin.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
```

## Troubleshooting

### "User role not found" Error
- ✅ Check that user exists in `user_roles` table
- ✅ Verify `is_active = TRUE`
- ✅ Ensure `user_id` matches Supabase Auth User ID exactly

### "Invalid email or password" Error
- ✅ Verify user exists in Supabase Auth
- ✅ Check password is correct
- ✅ Ensure email matches between Auth and user_roles

### Menu Items Not Showing
- ✅ Check user role in `user_roles` table: `SELECT * FROM user_roles WHERE email = 'your@email.com';`
- ✅ Verify role is exactly: `'super_admin'`, `'admin'`, or `'employee'` (case-sensitive)
- ✅ Check browser console for errors

### Cannot Access Routes
- ✅ Verify user is logged in (check session storage in browser DevTools)
- ✅ Check route protection requirements match user role
- ✅ Ensure user has `is_active = TRUE`

## Verify User Setup

Run this query to see all users and their roles:

```sql
SELECT 
  ur.id,
  ur.email,
  ur.role,
  ur.is_active,
  c.name as company_name,
  e.first_name || ' ' || e.last_name as employee_name,
  ur.created_at
FROM user_roles ur
LEFT JOIN companies c ON ur.company_id = c.id
LEFT JOIN employees e ON ur.employee_id = e.id
ORDER BY ur.role, ur.email;
```

## Summary

1. **Create users** in Supabase Auth Dashboard (Authentication → Users)
2. **Link to roles** using SQL in SQL Editor
3. **Test login** at `/login` with email and password
4. **Verify permissions** by checking menu items and route access

Each role has different access levels as described in the authentication documentation.


