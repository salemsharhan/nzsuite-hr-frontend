# The System - HRMS TODO

## ✅ Completed Features

- [x] Core system architecture with Neo-Corporate Glass design
- [x] MainLayout with Sidebar/Topbar navigation
- [x] Dashboard page with charts and KPIs
- [x] Full RTL support with Arabic/English translations
- [x] Employee List with CRUD operations
- [x] Attendance Dashboard with punch log tracking
- [x] Payroll Processing module
- [x] Leave Management with approval workflows
- [x] Recruitment Kanban board
- [x] Employee Self-Service (ESS) Portal
- [x] Timesheets module
- [x] Document Management
- [x] Analytics with charts
- [x] Admin and Settings pages
- [x] Supabase integration with Axios
- [x] Employment Type feature (Full Time, Part Time, Consultant)
- [x] Role-based module visibility in navigation
- [x] Consultant exclusion from Attendance tracking

## 📋 Pending Features (from pasted_content_2.txt)

### 2️⃣ Hiring Process Checklist Module

- [ ] Create HiringChecklistPage component
- [ ] Implement 6-stage checklist structure:
  - [ ] Stage 1: Offer & Acceptance
  - [ ] Stage 2: Documents & Contract
  - [ ] Stage 3: Pre-Onboarding
  - [ ] Stage 4: First Day (Onboarding)
  - [ ] Stage 5: Probation Period
  - [ ] Stage 6: Final Confirmation
- [ ] Add checkbox, date, completed_by, notes for each item
- [ ] Implement progress bar calculation
- [ ] Link checklist to employee profile
- [ ] Add PDF export/download functionality
- [ ] Implement HR + Manager approval for final stage
- [ ] Create hiringChecklistService with CRUD operations
- [ ] Add hiring_checklists table migration
- [ ] Display checklist completion status on employee profile
- [ ] Add route and navigation link

### 3️⃣ Global Role & Permission Parameters

- [x] Create RolesPermissionsPage component in Settings
- [x] Implement role management UI (Admin, HR, Manager, Finance, Supervisor, Custom)
- [x] Create permission matrix for modules:
  - [x] HR module permissions
  - [x] Attendance module permissions
  - [x] Payroll module permissions
  - [x] Recruitment module permissions
  - [x] Analytics module permissions
  - [x] Settings module permissions
- [x] Implement action-level permissions (View, Create, Edit, Approve, Delete, Export)
- [x] Create roles and permissions database tables
- [ ] Implement permission enforcement at UI level (hide buttons)
- [ ] Implement permission enforcement at API level (block actions)
- [x] Add audit log for permission changes
- [x] Implement per-user role assignment
- [x] Add effective date support for role changes
- [ ] Update all pages to check permissions before rendering actions
- [x] Create rolesPermissionsService with CRUD operations

## 🔧 Technical Debt

- [ ] Add comprehensive error handling across all services
- [ ] Implement loading states for all async operations
- [ ] Add form validation for all input fields
- [ ] Optimize API calls with caching where appropriate
- [ ] Add unit tests for critical services
- [ ] Improve mobile responsiveness on complex pages


## ✅ Recently Completed

- [x] Create HiringChecklistPage component
- [x] Implement 6-stage checklist structure
- [x] Add checkbox, date, completed_by, notes for each item
- [x] Implement progress bar calculation
- [x] Link checklist to employee profile
- [x] Implement HR + Manager approval for final stage
- [x] Create hiringChecklistService with CRUD operations
- [x] Display checklist completion status
- [x] Add route and navigation link


## 🐛 Bug Fixes

- [x] Identified root cause: Services using Supabase instead of MySQL/Drizzle
- [x] Add all HR tables to Drizzle schema (employees, attendance, payroll, etc.)
- [x] Add hiring_checklists table to Drizzle schema
- [x] Add roles and permissions tables to Drizzle schema
- [x] Generate and run Drizzle migrations
- [x] Create tRPC server routers for all HR operations
- [x] Update employee service to use mock data temporarily
- [x] Fix all TypeScript type errors across pages
- [x] Test all CRUD operations with new database setup


## 🎨 Rebranding to NZSuite

- [x] Generate NZSuite logo with AI (nano banana)
- [x] Update application title from "The System" to "NZSuite"
- [x] Update logo in MainLayout header
- [x] Update favicon
- [x] Update README.md with new branding
- [x] Update all documentation files
- [x] Update GitHub repository description
- [x] Rename GitHub repository to nzsuite-hr-frontend
- [x] Push rebranding to GitHub


## 🚀 Self-Service Module Enhancement

### A) Employee Dashboard Redesign
- [x] Create modern KPI cards layout (4 cards: Check-in Time, Leave Balance, Next Payday, Pending Requests)
- [x] Add "Submit Request" primary button in header
- [x] Create "Recent Payslips" panel (last 3 payslips)
- [x] Create "My Requests" panel (last 5 requests with status chips)
- [x] Add empty states for both panels
- [x] Implement responsive mobile layout
- [x] Add data refresh after request submission

### B) Reusable Components
- [x] Create Modal component (reusable dialog)
- [x] Create Stepper component (multi-step wizard)
- [x] Create DynamicForm component (config-driven forms)
- [x] Create StatusBadge component (Approved/Rejected/Pending/In Review)
- [x] Create EmptyState component (no data placeholder)

### C) Request Configuration System
- [x] Create selfServiceRequests.ts config file
- [x] Define 7 primary categories
- [x] Define 14 request types with field configurations
- [x] Implement conditional field validation
- [x] Add file upload rules (types, sizes)
- [x] Create TypeScript types (Employee, Payslip, Request, RequestStatus, Category, FieldConfig)

### D) Submit Request Modal (14 Request Types)
- [x] Step 1: Category selection (7 tiles)
- [x] Step 2: Request type selection
- [x] Step 3: Dynamic form rendering
- [x] 1. Leave Request (with conditional attachment for sick leave)
- [x] 2. Permission / Early Leave
- [x] 3. Attendance Correction
- [x] 4. Payslip Inquiry / Payroll Issue
- [x] 5. Advance / Loan
- [x] 6. Expense Reimbursement
- [x] 7. Update Personal Data
- [x] 8. Salary Certificate
- [x] 9. Experience Letter
- [x] 10. Training Request
- [x] 11. Asset Request
- [x] 12. IT Support Ticket
- [x] 13. Complaint / Grievance (Sensitive)
- [x] 14. Resignation (Sensitive)
- [x] Add form validation and submission
- [x] Show success toast and refresh dashboard

### E) My Requests Page
- [x] Create requests list table
- [x] Add filters (Status, Category, Date range)
- [x] Add search by type/reference
- [x] Create request detail drawer/modal
- [x] Show approval timeline
- [x] Show comments and attachments
- [x] Add audit trail

### F) My Payslips Page
- [x] Create payslips list by month
- [x] Add view/download actions
- [x] Add empty state

### G) Workflow & Approvals
- [x] Implement workflow routing logic
- [x] Attendance/Leaves -> Manager -> HR
- [x] Payroll/Finance -> Finance -> HR
- [x] Administrative -> HR
- [x] Letters/Certificates -> HR
- [x] Training -> Manager -> HR
- [x] Assets/IT -> IT/Assets -> Manager
- [x] Sensitive -> HR only (bypass manager if confidential)

### H) Mock Services (if APIs not ready)
- [x] GET /attendance/today
- [x] GET /leave/balance
- [x] GET /payroll/next-payday
- [x] GET /self-service/requests
- [x] GET /payroll/payslips
- [x] POST /self-service/requests


## 🐛 Current Issues

- [ ] Fix blank page rendering issue - application not displaying in browser
- [ ] Check for JavaScript runtime errors
- [ ] Verify all routes are working correctly


## 🏖️ Complete Leave Management Module (Admin Only)

### A) Leave Dashboard
- [x] Create overview statistics cards (Total Requests, Pending Approvals, Approved This Month, Rejected)
- [x] Add leave type breakdown chart (Annual, Sick, Emergency, etc.)
- [x] Show upcoming leaves calendar widget
- [x] Display recent leave requests table
- [x] Add quick action buttons (Approve/Reject pending requests)

### B) Leave Requests Management
- [x] Create comprehensive requests list with filters:
  - [x] Filter by status (Pending, Approved, Rejected, Cancelled)
  - [x] Filter by leave type
  - [x] Filter by employee/department
  - [x] Filter by date range
- [x] Add search functionality (by employee name, request ID)
- [x] Implement bulk actions (Approve/Reject multiple)
- [x] Create request detail modal with:
  - [x] Employee information
  - [x] Leave details (type, dates, duration, reason)
  - [x] Attachments (medical certificates, etc.)
  - [x] Approval history/timeline
  - [x] Comments section
  - [x] Approve/Reject actions with reason field
- [ ] Add manual leave request creation for employees

### C) Leave Policies Configuration
- [ ] Create leave types management:
  - [ ] Annual Leave
  - [ ] Sick Leave
  - [ ] Emergency Leave
  - [ ] Maternity/Paternity Leave
  - [ ] Unpaid Leave
  - [ ] Compassionate Leave
  - [ ] Study Leave
  - [ ] Custom leave types
- [ ] Configure policy rules for each type:
  - [ ] Annual entitlement (days per year)
  - [ ] Accrual method (monthly, yearly, joining date)
  - [ ] Carry forward rules
  - [ ] Maximum carry forward days
  - [ ] Encashment rules
  - [ ] Minimum/maximum days per request
  - [ ] Advance notice required (days)
  - [ ] Requires approval (yes/no)
  - [ ] Requires attachment (yes/no)
  - [ ] Applicable to (all employees, specific departments, roles)
- [ ] Set public holidays calendar
- [ ] Configure working days (weekends)

### D) Leave Balance Management
- [ ] View all employees' leave balances
- [ ] Filter by department/employee
- [ ] Show balance breakdown:
  - [ ] Total entitled
  - [ ] Used
  - [ ] Remaining
  - [ ] Pending approval
  - [ ] Carried forward from previous year
- [ ] Manual balance adjustment with reason
- [ ] Bulk balance import/export (Excel)
- [ ] Balance history/audit trail

### E) Leave Calendar View
- [ ] Monthly calendar showing all leaves
- [ ] Color-coded by leave type
- [ ] Filter by department/employee
- [ ] Show employee availability
- [ ] Identify leave conflicts/overlaps
- [ ] Export calendar to PDF

### F) Leave Reports
- [ ] Leave summary report (by employee, department, leave type)
- [ ] Leave trends analysis
- [ ] Absenteeism report
- [ ] Leave encashment report
- [ ] Carry forward report
- [ ] Export to Excel/PDF

### G) Approval Workflows
- [ ] Configure approval chains (Manager → HR → Admin)
- [ ] Auto-approval rules (e.g., auto-approve if < 2 days)
- [ ] Delegation settings (when approver is on leave)
- [ ] Email notifications for:
  - [ ] New leave request
  - [ ] Request approved
  - [ ] Request rejected
  - [ ] Request cancelled
  - [ ] Balance low warning

### H) Database Schema
- [x] leave_types table
- [x] leave_policies table
- [x] leave_requests table
- [x] leave_balances table
- [x] leave_approvals table (approval history)
- [x] public_holidays table
- [x] leave_adjustments table (manual adjustments)


## 🔨 Current Implementation - Leave Management Tabs

- [x] Implement Leave Policies tab with leave type management
- [x] Implement Leave Balances tab with employee balance tracking
- [x] Implement Leave Calendar tab with visual calendar view
- [x] Implement Leave Reports tab with analytics and exports


## 💰 Complete Payroll Module with Compliance Adjustment

### A) Database Schema
- [x] Add payroll tables with government compliance fields
- [x] Add payroll_returns table for tracking return status
- [x] Add payroll_alerts table for accountant notifications
- [x] Add salary components tables (basic, allowances, deductions)

### B) Payroll Dashboard
- [x] Create overview statistics (total payroll, pending, completed)
- [x] Show monthly payroll summary
- [x] Display pending returns alert widget
- [x] Show recent payroll runs

### C) Payroll Generation
- [x] Create payroll generation interface
- [x] Add employee selection with filters
- [x] Implement salary calculation engine
- [x] Add government registered amount field
- [x] Calculate compliance adjustment automatically
- [x] Bulk payroll generation
- [x] Preview before final generation

### D) Enhanced Payslip
- [x] Design payslip with three sections:
  - [x] Salary Calculation (Gross to Net)
  - [x] Bank Transfer Details (Government amount)
  - [x] Return Amount Details
- [x] Add PDF export functionality
- [x] Show return status indicator
- [x] Add bank transfer reference number

### E) Return Tracking Interface
- [x] Create return tracking dashboard for accountants
- [x] List all pending returns with deadlines
- [x] Add mark as returned functionality
- [x] Record return date and reference
- [x] Show return history
- [x] Filter by status (pending/completed/overdue)

### F) Alert System
- [x] Auto-generate alerts for pending returns
- [x] Alert accountant department for overdue returns
- [x] Email notifications (if configured)
- [x] Dashboard notification badges
- [x] Alert history and audit trail

### G) Additional Features
- [x] Salary components management (allowances, deductions)
- [x] Payroll history and reports
- [x] Export payroll data (Excel, PDF)
- [ ] Payroll approval workflow
- [ ] Multi-currency support (if needed)


## 🐛 Payroll Module Bug Fixes

- [x] Fix Payroll Generation button not working (button appears when employees are selected)
- [x] Add manual return amount control in Generate Payroll form (editable input field)
- [ ] Test payroll generation flow end-to-end


## 💼 Employee Default Return Amount Feature

- [x] Add `default_return_amount` and `government_registered_salary` fields to employees table
- [x] Update Employee Profile page to include return amount fields
- [x] Update EmployeeListPage add/edit form with return amount fields
- [x] Modify payroll generation to use employee default return amounts
- [x] Add warning indicator when return amount is manually overridden
- [x] Test end-to-end flow from employee profile to payroll generation
