-- Create Document Requests Table
CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL, -- e.g., 'Salary Certificate', 'Employment Letter', 'Experience Certificate', etc.
  purpose TEXT,
  language TEXT DEFAULT 'en', -- 'en' or 'ar'
  destination TEXT, -- e.g., 'Bank', 'Embassy', etc.
  status TEXT DEFAULT 'Pending', -- 'Pending', 'In Progress', 'Completed', 'Rejected'
  requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES employees(id), -- Admin who fulfilled the request
  document_id UUID REFERENCES documents(id), -- The document that was provided (if selected from existing)
  uploaded_document_url TEXT, -- URL if a new document was uploaded
  notes TEXT, -- Admin notes
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for employee_id for better query performance
CREATE INDEX IF NOT EXISTS idx_document_requests_employee_id ON document_requests(employee_id);

-- Create index for status for filtering
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status);

-- Create index for requested_at for sorting
CREATE INDEX IF NOT EXISTS idx_document_requests_requested_at ON document_requests(requested_at DESC);

-- Enable RLS
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Employees can view their own requests
DROP POLICY IF EXISTS "Employees can view their own document requests" ON document_requests;
CREATE POLICY "Employees can view their own document requests" ON document_requests
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = document_requests.employee_id
    )
  );

-- Employees can create their own requests
DROP POLICY IF EXISTS "Employees can create their own document requests" ON document_requests;
CREATE POLICY "Employees can create their own document requests" ON document_requests
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id IN (
      SELECT id FROM employees WHERE id = document_requests.employee_id
    )
  );

-- Admins can view all requests
DROP POLICY IF EXISTS "Admins can view all document requests" ON document_requests;
CREATE POLICY "Admins can view all document requests" ON document_requests
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can update all requests
DROP POLICY IF EXISTS "Admins can update all document requests" ON document_requests;
CREATE POLICY "Admins can update all document requests" ON document_requests
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE document_requests IS 'Employee requests for official documents';
COMMENT ON COLUMN document_requests.document_id IS 'Reference to existing document if admin selects from employee documents';
COMMENT ON COLUMN document_requests.uploaded_document_url IS 'URL of newly uploaded document if admin uploads a new one';


