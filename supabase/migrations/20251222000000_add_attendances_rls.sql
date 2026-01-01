-- Add RLS policies for attendances table
-- This table contains raw attendance data from the machine with integer employee_id

-- Enable RLS on attendances table
ALTER TABLE IF EXISTS public.attendances ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access for authenticated users
-- Using adminApi (service role) will bypass RLS, but this is for direct API access
DROP POLICY IF EXISTS "Enable read access for attendances" ON public.attendances;
CREATE POLICY "Enable read access for attendances" ON public.attendances
  FOR SELECT 
  USING (true);

-- Create index on employee_id for better query performance
CREATE INDEX IF NOT EXISTS idx_attendances_employee_id ON public.attendances(employee_id);

-- Create index on timestamp for better query performance
CREATE INDEX IF NOT EXISTS idx_attendances_timestamp ON public.attendances(timestamp DESC);

-- Create composite index for employee_id and timestamp (common query pattern)
CREATE INDEX IF NOT EXISTS idx_attendances_employee_timestamp ON public.attendances(employee_id, timestamp DESC);

