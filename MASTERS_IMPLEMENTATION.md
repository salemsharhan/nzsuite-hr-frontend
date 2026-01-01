# Masters Implementation: Departments, Roles, and Jobs

## Overview
Implemented a comprehensive masters management system for Departments, Roles, and Jobs with a hierarchical relationship: **Role → Jobs** (e.g., Role "Engineer" can have multiple Jobs like "Software Engineer", "IT Engineer", "Product Engineer").

## Database Schema

### Tables Created

#### 1. **departments** Table
- `id` (UUID, Primary Key)
- `name` (TEXT, Unique, Required)
- `code` (TEXT, Unique, Optional) - e.g., "ENG", "SALES"
- `description` (TEXT, Optional)
- `is_active` (BOOLEAN, Default: TRUE)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 2. **roles** Table
- `id` (UUID, Primary Key)
- `name` (TEXT, Unique, Required)
- `code` (TEXT, Unique, Optional) - e.g., "ENG", "MGR"
- `description` (TEXT, Optional)
- `is_active` (BOOLEAN, Default: TRUE)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 3. **jobs** Table
- `id` (UUID, Primary Key)
- `role_id` (UUID, Foreign Key → roles.id, Required)
- `name` (TEXT, Required)
- `code` (TEXT, Optional)
- `description` (TEXT, Optional)
- `is_active` (BOOLEAN, Default: TRUE)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **Constraint**: Unique job name per role (`UNIQUE(role_id, name)`)

### Employees Table Modifications
Added foreign key columns to `employees` table:
- `department_id` (UUID → departments.id)
- `role_id` (UUID → roles.id)
- `job_id` (UUID → jobs.id)

**Note**: Legacy columns (`department`, `designation`) are still maintained for backward compatibility.

## Default Data

### Default Departments
- Engineering, Sales, Marketing, HR, Operations, Finance, IT, Legal

### Default Roles
- Engineer, Manager, Analyst, Specialist, Director, Executive, Coordinator, Assistant

### Default Jobs (by Role)
**Engineer Role:**
- Software Engineer, IT Engineer, Product Engineer, DevOps Engineer, QA Engineer

**Manager Role:**
- Engineering Manager, Sales Manager, Product Manager, Operations Manager

**Analyst Role:**
- Business Analyst, Data Analyst, Financial Analyst

**Specialist Role:**
- HR Specialist, Marketing Specialist, IT Specialist

## Services Created

### 1. `departmentService.ts`
- `getAll()` - Get all active departments
- `getById(id)` - Get department by ID
- `create(department)` - Create new department
- `update(id, updates)` - Update department
- `delete(id)` - Delete department

### 2. `roleService.ts`
- `getAll()` - Get all active roles
- `getById(id)` - Get role by ID
- `create(role)` - Create new role
- `update(id, updates)` - Update role
- `delete(id)` - Delete role (cascades to jobs)

### 3. `jobService.ts`
- `getAll(roleId?)` - Get all jobs (optionally filtered by role)
- `getById(id)` - Get job by ID
- `getByRoleId(roleId)` - Get all jobs for a specific role
- `create(job)` - Create new job
- `update(id, updates)` - Update job
- `delete(id)` - Delete job

## UI Implementation

### Settings Page (`SettingsPage.tsx`)
Added three new tabs for masters management:

#### 1. **Departments Tab**
- List all departments with name, code, and description
- Add/Edit/Delete departments
- Modal form for creating/editing

#### 2. **Roles Tab**
- List all roles with name, code, and description
- Add/Edit/Delete roles
- Modal form for creating/editing

#### 3. **Jobs Tab**
- Jobs grouped by Role
- Add/Edit/Delete jobs
- Modal form with Role selection dropdown
- Job dropdown is disabled until a role is selected

### Employee Form (`EmployeeListPage.tsx`)
Updated the "Add Employee" form:

#### Changes:
1. **Department Selection**: Replaced hardcoded dropdown with dynamic departments from database
2. **Role & Job Selection**: 
   - Two-step selection: First select Role, then Job
   - Job dropdown is populated based on selected Role
   - Job dropdown is disabled until a role is selected

#### Form Fields:
- **Department**: Dropdown from `departments` table
- **Role**: Dropdown from `roles` table
- **Job**: Dropdown from `jobs` table (filtered by selected role)

## Data Flow

### Creating an Employee:
1. User selects Department from dropdown
2. User selects Role from dropdown
3. System loads Jobs for selected Role
4. User selects Job from filtered list
5. Form submission sends:
   - `department_id` (UUID)
   - `role_id` (UUID)
   - `job_id` (UUID)
   - Legacy fields (`department`, `designation`) for backward compatibility

### Masters Management:
1. Navigate to Settings → Departments/Roles/Jobs
2. Click "Add" button to create new master
3. Fill in form (name, code, description)
4. Save to database
5. Masters are immediately available in employee form

## Migration File
- **File**: `supabase/migrations/20251221160000_create_masters_tables.sql`
- **Status**: ✅ Pushed to remote database

## Features

### ✅ Implemented
- [x] Departments master table and CRUD operations
- [x] Roles master table and CRUD operations
- [x] Jobs master table with role relationship
- [x] Foreign keys in employees table
- [x] Settings page UI for managing masters
- [x] Employee form with dynamic dropdowns
- [x] Role-based job filtering
- [x] Default data seeding
- [x] RLS policies for all tables
- [x] Indexes for performance

### 🔄 Future Enhancements
- [ ] Bulk import/export of masters
- [ ] Master data validation rules
- [ ] Audit trail for master changes
- [ ] Soft delete with archive functionality
- [ ] Master data versioning

## Usage Example

### Creating a New Job:
1. Go to Settings → Jobs
2. Click "Add Job"
3. Select Role (e.g., "Engineer")
4. Enter Job Name (e.g., "Frontend Engineer")
5. Optionally add Code and Description
6. Save

### Using in Employee Form:
1. Open "Add Employee" modal
2. Go to "Employment" tab
3. Select Department (e.g., "Engineering")
4. Select Role (e.g., "Engineer")
5. Select Job from filtered list (e.g., "Software Engineer")
6. Complete rest of form and save

## Notes
- All masters support soft delete via `is_active` flag
- Jobs are automatically deleted when their parent Role is deleted (CASCADE)
- Employees retain references even if masters are deleted (SET NULL)
- Legacy `department` and `designation` fields are maintained for backward compatibility


