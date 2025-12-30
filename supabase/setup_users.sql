-- Setup Users for Authentication
-- This script creates user role entries for testing
-- NOTE: Users must be created in Supabase Auth Dashboard first, then update the user_id values below

-- ============================================
-- IMPORTANT: Before running this script
-- ============================================
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Create users with these emails:
--    - superadmin1@system.com
--    - superadmin2@system.com
--    - admin@company.com
--    - employee@company.com
-- 3. Copy the User IDs from Supabase Auth
-- 4. Replace the user_id values below with actual IDs
-- 5. Then run this script

-- ============================================
-- Super Admin Users
-- ============================================
-- Using the provided JWT keys as user IDs (if they exist in Supabase Auth)
-- If these users don't exist, create them first in Supabase Auth Dashboard

-- Super Admin 1 (using provided JWT key)
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('6a871b7a-7a5d-4279-a0d8-ed08a86ddb14', 'superadmin1@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

-- Super Admin 2 (using provided JWT key)
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('9bc41165-a26f-4662-ad4c-0222a541f99b', 'superadmin2@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

-- ============================================
-- Admin User (with Company)
-- ============================================
-- Ensure default company exists, then create admin
DO $$
DECLARE
  company_uuid UUID;
  admin_user_id TEXT := 'REPLACE_WITH_ADMIN_USER_ID'; -- Replace with actual User ID from Supabase Auth
BEGIN
  -- Get or create default company
  SELECT id INTO company_uuid FROM companies WHERE name = 'Default Company' LIMIT 1;
  
  IF company_uuid IS NULL THEN
    INSERT INTO companies (name, code, description, is_active)
    VALUES ('Default Company', 'DEFAULT', 'Default company for existing employees', TRUE)
    RETURNING id INTO company_uuid;
  END IF;
  
  -- Only create admin if user_id is not the placeholder
  IF admin_user_id != 'REPLACE_WITH_ADMIN_USER_ID' THEN
    INSERT INTO user_roles (user_id, email, role, company_id, is_active)
    VALUES (admin_user_id::UUID, 'admin@company.com', 'admin', company_uuid, TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;
  END IF;
END $$;

-- ============================================
-- Employee User (with Company and Employee Record)
-- ============================================
DO $$
DECLARE
  company_uuid UUID;
  employee_uuid UUID;
  employee_user_id TEXT := 'REPLACE_WITH_EMPLOYEE_USER_ID'; -- Replace with actual User ID from Supabase Auth
BEGIN
  -- Get company
  SELECT id INTO company_uuid FROM companies WHERE name = 'Default Company' LIMIT 1;
  
  -- Get first employee (or create one if none exists)
  SELECT id INTO employee_uuid FROM employees LIMIT 1;
  
  IF employee_uuid IS NULL THEN
    -- Create a test employee if none exists
    INSERT INTO employees (employee_id, first_name, last_name, email, status, company_id)
    VALUES ('EMP-TEST-001', 'Test', 'Employee', 'employee@company.com', 'Active', company_uuid)
    RETURNING id INTO employee_uuid;
  END IF;
  
  -- Only create employee user if user_id is not the placeholder
  IF employee_user_id != 'REPLACE_WITH_EMPLOYEE_USER_ID' AND company_uuid IS NOT NULL AND employee_uuid IS NOT NULL THEN
    INSERT INTO user_roles (user_id, email, role, company_id, employee_id, is_active)
    VALUES (employee_user_id::UUID, 'employee@company.com', 'employee', company_uuid, employee_uuid, TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;
  END IF;
END $$;

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

