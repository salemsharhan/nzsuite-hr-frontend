-- Fix RLS policies for employee_requests to filter by company
-- First, ensure the table exists (create if it doesn't)
CREATE TABLE IF NOT EXISTS employee_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  request_type TEXT NOT NULL,
  request_category TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'Pending',
  current_approver TEXT,
  workflow_route TEXT[],
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES employees(id),
  review_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_employee_requests_employee_id ON employee_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status);
CREATE INDEX IF NOT EXISTS idx_employee_requests_request_type ON employee_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_employee_requests_submitted_at ON employee_requests(submitted_at DESC);

-- Enable RLS
ALTER TABLE employee_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe even if they don't exist)
DROP POLICY IF EXISTS "Employees can view their own requests" ON employee_requests;
DROP POLICY IF EXISTS "Employees can create their own requests" ON employee_requests;
DROP POLICY IF EXISTS "Admins can view all employee requests" ON employee_requests;
DROP POLICY IF EXISTS "Admins can update all employee requests" ON employee_requests;
DROP POLICY IF EXISTS "Admins can view their company employee requests" ON employee_requests;
DROP POLICY IF EXISTS "Admins can update their company employee requests" ON employee_requests;
DROP POLICY IF EXISTS "Admins can insert their company employee requests" ON employee_requests;
DROP POLICY IF EXISTS "Admins can delete their company employee requests" ON employee_requests;

-- Employees can view their own requests (only if they belong to the same company)
CREATE POLICY "Employees can view their own requests" ON employee_requests
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM employees e
      JOIN user_roles ur ON ur.employee_id = e.id
      WHERE e.id = employee_requests.employee_id
      AND ur.user_id = auth.uid()
    )
  );

-- Employees can create their own requests
CREATE POLICY "Employees can create their own requests" ON employee_requests
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM employees e
      JOIN user_roles ur ON ur.employee_id = e.id
      WHERE e.id = employee_requests.employee_id
      AND ur.user_id = auth.uid()
    )
  );

-- Admins can view employee requests from their company only
CREATE POLICY "Admins can view their company employee requests" ON employee_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (
          ur.role = 'admin' 
          AND EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = employee_requests.employee_id
            AND e.company_id = ur.company_id
          )
        )
      )
    )
  );

-- Admins can update employee requests from their company only
CREATE POLICY "Admins can update their company employee requests" ON employee_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (
          ur.role = 'admin' 
          AND EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = employee_requests.employee_id
            AND e.company_id = ur.company_id
          )
        )
      )
    )
  );

-- Admins can insert employee requests for their company employees only
CREATE POLICY "Admins can insert their company employee requests" ON employee_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (
          ur.role = 'admin' 
          AND EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = employee_requests.employee_id
            AND e.company_id = ur.company_id
          )
        )
      )
    )
  );

-- Admins can delete employee requests from their company only
CREATE POLICY "Admins can delete their company employee requests" ON employee_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (
          ur.role = 'admin' 
          AND EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = employee_requests.employee_id
            AND e.company_id = ur.company_id
          )
        )
      )
    )
  );

-- Add table comments
COMMENT ON TABLE employee_requests IS 'Employee self-service requests (excluding leaves and documents)';
COMMENT ON COLUMN employee_requests.form_data IS 'JSON object containing all form field data';
COMMENT ON COLUMN employee_requests.workflow_route IS 'Array of approver roles/departments in order';

