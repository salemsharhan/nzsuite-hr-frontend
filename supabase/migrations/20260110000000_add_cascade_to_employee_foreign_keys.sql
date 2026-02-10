-- Add CASCADE to foreign key constraints that reference employees table
-- This allows automatic deletion of related records when an employee is deleted

-- 1. Update attendance_logs foreign key to CASCADE
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_logs_employee_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_logs 
    DROP CONSTRAINT attendance_logs_employee_id_fkey;
  END IF;
  
  -- Add new constraint with CASCADE
  ALTER TABLE public.attendance_logs 
  ADD CONSTRAINT attendance_logs_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES public.employees(id) 
  ON DELETE CASCADE;
END $$;

-- 2. Update leave_requests foreign key to CASCADE (for employee_id)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leave_requests_employee_id_fkey'
  ) THEN
    ALTER TABLE public.leave_requests 
    DROP CONSTRAINT leave_requests_employee_id_fkey;
  END IF;
  
  ALTER TABLE public.leave_requests 
  ADD CONSTRAINT leave_requests_employee_id_fkey 
  FOREIGN KEY (employee_id) 
  REFERENCES public.employees(id) 
  ON DELETE CASCADE;
END $$;

-- 3. Update leave_requests approved_by to SET NULL (employee can be deleted, but leave request should remain)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leave_requests_approved_by_fkey'
  ) THEN
    ALTER TABLE public.leave_requests 
    DROP CONSTRAINT leave_requests_approved_by_fkey;
  END IF;
  
  ALTER TABLE public.leave_requests 
  ADD CONSTRAINT leave_requests_approved_by_fkey 
  FOREIGN KEY (approved_by) 
  REFERENCES public.employees(id) 
  ON DELETE SET NULL;
END $$;

-- Note: Other tables already have CASCADE based on migration files:
-- - timesheet_entries: ON DELETE CASCADE ✓
-- - employee_education: ON DELETE CASCADE ✓
-- - employee_bank_details: ON DELETE CASCADE ✓
-- - employee_immigration: ON DELETE CASCADE ✓
-- - employee_attendance_locations: ON DELETE CASCADE ✓
-- - employee_shifts: ON DELETE CASCADE ✓
-- - employee_working_hours: ON DELETE CASCADE ✓
-- - employee_requests: ON DELETE CASCADE ✓
-- - document_requests: ON DELETE CASCADE ✓
-- - documents: ON DELETE CASCADE ✓
-- - webauthn_credentials: ON DELETE CASCADE ✓
-- - user_roles: ON DELETE SET NULL ✓

-- Add comment
COMMENT ON CONSTRAINT attendance_logs_employee_id_fkey ON public.attendance_logs IS 
'Foreign key to employees table with CASCADE delete - attendance logs are deleted when employee is deleted';

COMMENT ON CONSTRAINT leave_requests_employee_id_fkey ON public.leave_requests IS 
'Foreign key to employees table with CASCADE delete - leave requests are deleted when employee is deleted';


