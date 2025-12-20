# Functional Specification & Scope of Work (SOW)
**Project:** The System - Enterprise HRMS
**Version:** 2.0
**Status:** Active Implementation Reference

This document serves as the **Single Source of Truth** for all functional requirements, database interactions, and API integrations. All development work must strictly adhere to the specifications below.

---

## 1. Employee Management Module
**Page:** `/employees` & `/employees/:id`
**Table:** `employees`

### 1.1 Employee List
*   **View:** Grid/List of all employees.
*   **Data Source:** `SELECT * FROM employees`
*   **Filters:** Search by Name, Department, Status.

### 1.2 Add Employee (Modal)
*   **Button:** "Add Employee" (Top Right)
*   **Action:** Opens `AddEmployeeModal`.
*   **Fields:**
    *   `first_name` (Text, Required)
    *   `last_name` (Text, Required)
    *   `email` (Email, Unique, Required)
    *   `department` (Dropdown: HR, IT, Sales, Ops)
    *   `position` (Text)
    *   `joining_date` (Date)
    *   `salary` (Number)
*   **API Call:** `supabase.from('employees').insert({...})`
*   **Success:** Close modal, refresh list, show toast "Employee Added".
*   **Error:** Show toast with error message.

### 1.3 Edit Employee
*   **Button:** "Edit" (On Employee Card / Detail Page)
*   **Action:** Opens `EditEmployeeModal` (pre-filled).
*   **API Call:** `supabase.from('employees').update({...}).eq('id', id)`

### 1.4 Delete/Archive Employee
*   **Button:** "Delete" (Danger Zone in Detail Page)
*   **Action:** Confirm Dialog -> Soft Delete.
*   **API Call:** `supabase.from('employees').update({ status: 'Terminated' }).eq('id', id)`

---

## 2. Leave Management Module
**Page:** `/leaves`
**Table:** `leave_requests`

### 2.1 Leave Dashboard
*   **View:** List of pending and past leave requests.
*   **Data Source:** `SELECT * FROM leave_requests ORDER BY created_at DESC`

### 2.2 New Leave Request (Modal)
*   **Button:** "New Request"
*   **Action:** Opens `NewLeaveModal`.
*   **Fields:**
    *   `employee_id` (Hidden/Select)
    *   `leave_type` (Annual, Sick, Unpaid)
    *   `start_date` (Date)
    *   `end_date` (Date)
    *   `reason` (Text Area)
*   **API Call:** `supabase.from('leave_requests').insert({...})`

### 2.3 Approve/Reject Leave
*   **Button:** "Approve" / "Reject" (On Request Card)
*   **Action:** Updates status.
*   **API Call:**
    *   Approve: `supabase.from('leave_requests').update({ status: 'Approved' }).eq('id', id)`
    *   Reject: `supabase.from('leave_requests').update({ status: 'Rejected' }).eq('id', id)`

---

## 3. Recruitment (Kanban) Module
**Page:** `/recruitment`
**Table:** `candidates` (New Table Required)

### 3.1 Kanban Board
*   **View:** Columns for "Applied", "Screening", "Interview", "Offer", "Hired".
*   **Data Source:** `SELECT * FROM candidates`

### 3.2 Add Candidate
*   **Button:** "Add Candidate"
*   **Action:** Opens `AddCandidateModal`.
*   **Fields:** Name, Email, Position, Status (Default: Applied).
*   **API Call:** `supabase.from('candidates').insert({...})`

### 3.3 Move Candidate (Drag & Drop)
*   **Action:** Drag card to new column.
*   **API Call:** `supabase.from('candidates').update({ status: new_status }).eq('id', id)`

---

## 4. Attendance Module
**Page:** `/attendance`
**Table:** `attendance_logs`

### 4.1 Daily Logs
*   **View:** List of punches for the selected date.
*   **Data Source:** `SELECT * FROM attendance_logs WHERE date = selected_date`

### 4.2 Manual Punch (Admin Override)
*   **Button:** "Add Punch"
*   **Action:** Opens `ManualPunchModal`.
*   **API Call:** `supabase.from('attendance_logs').insert({...})`

---

## 5. Payroll Module
**Page:** `/payroll`
**Table:** `payroll_cycles`

### 5.1 Run Payroll
*   **Button:** "Process Payroll"
*   **Action:** Triggers calculation function (Mock for frontend, or Edge Function).
*   **API Call:** `supabase.from('payroll_cycles').insert({ status: 'Processing', ... })`

---

## 6. Database Schema Requirements
The following tables must exist in Supabase:

```sql
-- Employees
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT,
  position TEXT,
  status TEXT DEFAULT 'Active',
  joining_date DATE,
  salary NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leave Requests
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Pending', -- Pending, Approved, Rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates (Recruitment)
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  position TEXT,
  status TEXT DEFAULT 'Applied', -- Applied, Screening, Interview, Offer, Hired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Logs
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  check_in TIMESTAMP WITH TIME ZONE,
  check_out TIMESTAMP WITH TIME ZONE,
  date DATE DEFAULT CURRENT_DATE,
  status TEXT -- Present, Late, Absent
);
```
