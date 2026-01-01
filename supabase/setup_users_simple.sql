-- Setup Users for Authentication
-- Run this in Supabase SQL Editor after creating users in Authentication → Users

-- ============================================
-- Super Admin Users
-- ============================================
-- Replace the user_id values with actual User IDs from Supabase Auth Dashboard

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

-- ============================================
-- Admin User (with Company)
-- ============================================
-- First, ensure default company exists
INSERT INTO companies (name, code, description, is_active)
VALUES ('Default Company', 'DEFAULT', 'Default company for existing employees', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Then create admin user
-- REPLACE 'YOUR_ADMIN_USER_ID_HERE' with actual User ID from Supabase Auth
INSERT INTO user_roles (user_id, email, role, company_id, is_active)
SELECT 
  'YOUR_ADMIN_USER_ID_HERE'::UUID,  -- Replace this with actual User ID
  'admin@company.com',
  'admin',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  TRUE
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;

-- ============================================
-- Employee User (with Company and Employee Record)
-- ============================================
-- Create a test employee if none exists
INSERT INTO employees (employee_id, first_name, last_name, email, status, company_id)
SELECT 
  'EMP-TEST-001',
  'Test',
  'Employee',
  'employee@company.com',
  'Active',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE email = 'employee@company.com');

-- Then create employee user
-- REPLACE 'YOUR_EMPLOYEE_USER_ID_HERE' with actual User ID from Supabase Auth
INSERT INTO user_roles (user_id, email, role, company_id, employee_id, is_active)
SELECT 
  'YOUR_EMPLOYEE_USER_ID_HERE'::UUID,  -- Replace this with actual User ID
  'employee@company.com',
  'employee',
  (SELECT id FROM companies WHERE name = 'Default Company' LIMIT 1),
  (SELECT id FROM employees WHERE email = 'employee@company.com' LIMIT 1),
  TRUE
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;

-- ============================================
-- Verify Users
-- ============================================
SELECT 
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


