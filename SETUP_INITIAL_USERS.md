# Setting Up Initial Users

## Quick Start

To set up the authentication system, you need to create users in Supabase Auth and link them to the `user_roles` table.

**📖 For detailed login instructions, see [HOW_TO_LOGIN.md](./HOW_TO_LOGIN.md)**

## Step 1: Create Users in Supabase Auth

1. Go to your Supabase Dashboard
2. Navigate to **Authentication → Users**
3. Click **"Add User"** or **"Create User"**
4. Create users with email and password

### Recommended Initial Users:

1. **Super Admin 1**
   - Email: `superadmin1@system.com` (or your preferred email)
   - Password: (set a strong password)
   - Note the User ID after creation

2. **Super Admin 2**
   - Email: `superadmin2@system.com` (or your preferred email)
   - Password: (set a strong password)
   - Note the User ID after creation

3. **Test Admin** (Optional)
   - Email: `admin@company.com`
   - Password: (set a strong password)
   - Note the User ID after creation

4. **Test Employee** (Optional)
   - Email: `employee@company.com`
   - Password: (set a strong password)
   - Note the User ID after creation

## Step 2: Link Users to Roles

After creating users in Supabase Auth, run these SQL commands in Supabase SQL Editor:

### For Super Admins:
```sql
-- Replace 'USER_ID_FROM_SUPABASE' with the actual user ID from Step 1
-- Replace 'email@example.com' with the actual email

INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('USER_ID_1', 'superadmin1@system.com', 'super_admin', TRUE),
  ('USER_ID_2', 'superadmin2@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
```

### For Admin (with Company):
```sql
-- First, get a company ID
SELECT id FROM companies LIMIT 1;

-- Then insert admin user (replace COMPANY_ID and USER_ID)
INSERT INTO user_roles (user_id, email, role, company_id, is_active)
VALUES 
  ('USER_ID_3', 'admin@company.com', 'admin', 'COMPANY_ID', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, is_active = EXCLUDED.is_active;
```

### For Employee (with Company and Employee Record):
```sql
-- First, get company and employee IDs
SELECT id FROM companies LIMIT 1;
SELECT id FROM employees LIMIT 1;

-- Then insert employee user (replace COMPANY_ID, EMPLOYEE_ID, and USER_ID)
INSERT INTO user_roles (user_id, email, role, company_id, employee_id, is_active)
VALUES 
  ('USER_ID_4', 'employee@company.com', 'employee', 'COMPANY_ID', 'EMPLOYEE_ID', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, company_id = EXCLUDED.company_id, employee_id = EXCLUDED.employee_id, is_active = EXCLUDED.is_active;
```

## Step 3: Using the Provided JWT Keys

If you have existing user IDs (JWT keys) that you want to use:

### Option A: If Users Already Exist in Supabase Auth
```sql
-- Just update the user_roles table
INSERT INTO user_roles (user_id, email, role, is_active)
VALUES 
  ('6a871b7a-7a5d-4279-a0d8-ed08a86ddb14', 'superadmin1@system.com', 'super_admin', TRUE),
  ('9bc41165-a26f-4662-ad4c-0222a541f99b', 'superadmin2@system.com', 'super_admin', TRUE)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
```

### Option B: If Users Don't Exist Yet
1. Create users in Supabase Auth with these IDs (if possible)
2. Or create new users and use their new IDs
3. Then run the SQL above

## Step 4: Test Login

1. Navigate to `/login` in your application
2. Enter email and password
3. You should be redirected to the dashboard
4. Check that menu items match your role:
   - **Super Admin**: Should see all menu items including Settings
   - **Admin**: Should see admin items but NOT Settings
   - **Employee**: Should see only employee items (Dashboard, Attendance, Leaves, Payroll, ESS, Timesheets)

## Role Permissions Summary

### Super Admin
- ✅ All features
- ✅ Settings (Departments, Roles, Jobs, Companies)
- ✅ Employee management (all companies)
- ✅ Analytics
- ✅ Admin panel

### Admin
- ✅ Employee management (own company only)
- ✅ Documents
- ✅ Attendance, Leaves, Payroll
- ✅ Analytics
- ✅ Recruitment
- ✅ Hiring Checklist
- ❌ Settings (masters management)
- ❌ Company creation

### Employee
- ✅ Own attendance
- ✅ Own payroll
- ✅ Own leaves
- ✅ Self Service (ESS)
- ✅ Timesheets
- ✅ Own employee details
- ❌ Employee management
- ❌ Documents (unless assigned)
- ❌ Analytics
- ❌ Admin features

## Troubleshooting

### "User role not found" Error
- Make sure user exists in `user_roles` table
- Check that `is_active = TRUE`
- Verify `user_id` matches Supabase Auth user ID

### "Invalid email or password" Error
- Verify user exists in Supabase Auth
- Check password is correct
- Ensure email matches between Auth and user_roles

### Menu Items Not Showing
- Check user role in `user_roles` table
- Verify role is one of: 'super_admin', 'admin', 'employee'
- Check browser console for errors

### Cannot Access Protected Routes
- Verify user is logged in (check session storage)
- Check route protection requirements
- Ensure user has required role

## Security Notes

1. **Password Security**: Use strong passwords (min 8 chars, mix of letters, numbers, symbols)
2. **Super Admin Access**: Limit super admin accounts to trusted personnel only
3. **Company Isolation**: Admins can only access their own company data
4. **Session Management**: Sessions expire based on Supabase settings
5. **Role Changes**: Update roles in `user_roles` table, not in Supabase Auth

## Next Steps

After setting up initial users:
1. Test all three role types
2. Create company-specific admin accounts
3. Link employee accounts to employee records
4. Configure password policies in Supabase
5. Set up email verification (optional)
6. Implement password reset flow (optional)

