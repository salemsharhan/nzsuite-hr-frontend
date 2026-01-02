-- Create Employee Requests Table (for all self-service requests except leaves and documents)
CREATE TABLE IF NOT EXISTS employee_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  request_type TEXT NOT NULL, -- e.g., 'IT Support Ticket', 'Training Request', 'Asset Request', etc.
  request_category TEXT NOT NULL, -- e.g., 'Assets & IT Support', 'Training & Development', etc.
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store all form data as JSON
  status TEXT DEFAULT 'Pending', -- 'Pending', 'In Review', 'Approved', 'Rejected', 'Cancelled'
  current_approver TEXT, -- e.g., 'IT Department', 'HR', 'Manager'
  workflow_route TEXT[], -- Array of approvers in order
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES employees(id), -- Admin/Manager who reviewed
  review_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_requests_employee_id ON employee_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status);
CREATE INDEX IF NOT EXISTS idx_employee_requests_request_type ON employee_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_employee_requests_submitted_at ON employee_requests(submitted_at DESC);

-- Enable RLS
ALTER TABLE employee_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Employees can view their own requests
DROP POLICY IF EXISTS "Employees can view their own requests" ON employee_requests;
CREATE POLICY "Employees can view their own requests" ON employee_requests
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_requests.employee_id
    )
  );

-- Employees can create their own requests
DROP POLICY IF EXISTS "Employees can create their own requests" ON employee_requests;
CREATE POLICY "Employees can create their own requests" ON employee_requests
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = employee_requests.employee_id
    )
  );

-- Admins can view all requests
DROP POLICY IF EXISTS "Admins can view all employee requests" ON employee_requests;
CREATE POLICY "Admins can view all employee requests" ON employee_requests
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can update all requests
DROP POLICY IF EXISTS "Admins can update all employee requests" ON employee_requests;
CREATE POLICY "Admins can update all employee requests" ON employee_requests
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Add comments
COMMENT ON TABLE employee_requests IS 'Employee self-service requests (excluding leaves and documents)';
COMMENT ON COLUMN employee_requests.form_data IS 'JSON object containing all form field data';
COMMENT ON COLUMN employee_requests.workflow_route IS 'Array of approver roles/departments in order';


