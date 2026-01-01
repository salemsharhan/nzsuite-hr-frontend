-- Fix RLS policies for documents table
-- Allow authenticated users to insert, read, update, and delete documents

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON documents;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON documents;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON documents;
DROP POLICY IF EXISTS "Enable update for document owners" ON documents;
DROP POLICY IF EXISTS "Enable delete for document owners" ON documents;

-- Allow authenticated users to read documents
-- Users can read documents for employees in their company (if admin) or their own documents (if employee)
CREATE POLICY "Enable read access for authenticated users" ON documents
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      -- Super admins can read all documents
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.is_active = true
      )
      OR
      -- Company admins can read documents for employees in their company
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.company_id = ur.company_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
      OR
      -- Employees can read their own documents
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.id = ur.employee_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'employee'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
      OR
      -- Allow reading if no employee_id (general documents)
      documents.employee_id IS NULL
    )
  );

-- Allow authenticated users to insert documents
CREATE POLICY "Enable insert for authenticated users" ON documents
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      -- Super admins can insert any document
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.is_active = true
      )
      OR
      -- Company admins can insert documents for employees in their company
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.company_id = ur.company_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
      OR
      -- Employees can insert their own documents
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.id = ur.employee_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'employee'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
      OR
      -- Allow inserting if no employee_id (general documents)
      documents.employee_id IS NULL
    )
  );

-- Allow authenticated users to update documents
CREATE POLICY "Enable update for authenticated users" ON documents
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND (
      -- Super admins can update any document
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.is_active = true
      )
      OR
      -- Company admins can update documents for employees in their company
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.company_id = ur.company_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
      OR
      -- Employees can update their own documents
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.id = ur.employee_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'employee'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
    )
  );

-- Allow authenticated users to delete documents
CREATE POLICY "Enable delete for authenticated users" ON documents
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND (
      -- Super admins can delete any document
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.is_active = true
      )
      OR
      -- Company admins can delete documents for employees in their company
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.company_id = ur.company_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
      OR
      -- Employees can delete their own documents
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN employees e ON e.id = ur.employee_id
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'employee'
        AND ur.is_active = true
        AND documents.employee_id = e.id
      )
    )
  );

