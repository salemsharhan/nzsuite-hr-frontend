-- Create Employee Attendance Location Settings Table
-- Allows each employee to have their own attendance location and radius
CREATE TABLE IF NOT EXISTS employee_attendance_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Location Settings
  location_name TEXT NOT NULL DEFAULT 'Employee Location',
  google_maps_link TEXT, -- Full Google Maps URL or embed link
  latitude NUMERIC(10, 8), -- Decimal degrees
  longitude NUMERIC(11, 8), -- Decimal degrees
  radius_meters INTEGER NOT NULL DEFAULT 100, -- Allowed radius in meters
  
  -- Settings
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  use_company_default BOOLEAN NOT NULL DEFAULT TRUE, -- If true, use company location instead
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_employee_location UNIQUE(employee_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_attendance_locations_employee_id 
  ON employee_attendance_locations(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_attendance_locations_active 
  ON employee_attendance_locations(employee_id, is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE employee_attendance_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable read access for employee_attendance_locations" ON employee_attendance_locations;
CREATE POLICY "Enable read access for employee_attendance_locations" ON employee_attendance_locations
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Enable insert access for employee_attendance_locations" ON employee_attendance_locations;
CREATE POLICY "Enable insert access for employee_attendance_locations" ON employee_attendance_locations
  FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for employee_attendance_locations" ON employee_attendance_locations;
CREATE POLICY "Enable update access for employee_attendance_locations" ON employee_attendance_locations
  FOR UPDATE 
  USING (true);






