-- Create Attendance Location Settings Table
-- Stores company-level attendance location settings with Google Maps integration
CREATE TABLE IF NOT EXISTS attendance_location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Location Settings
  location_name TEXT NOT NULL DEFAULT 'Office Location',
  google_maps_link TEXT, -- Full Google Maps URL or embed link
  latitude NUMERIC(10, 8), -- Decimal degrees
  longitude NUMERIC(11, 8), -- Decimal degrees
  radius_meters INTEGER NOT NULL DEFAULT 100, -- Allowed radius in meters (tight radius)
  
  -- Face Recognition Settings
  face_recognition_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  require_face_verification BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Additional Settings
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_company_location UNIQUE(company_id)
);

-- Create Employee Face Images Table
-- Stores face images for face recognition
CREATE TABLE IF NOT EXISTS employee_face_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  -- Face Image Data
  face_image_url TEXT NOT NULL, -- URL to stored face image (Supabase Storage)
  face_encoding TEXT, -- Base64 encoded face descriptor/encoding for recognition
  is_primary BOOLEAN NOT NULL DEFAULT TRUE, -- Primary face image for recognition
  
  -- Metadata
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_via TEXT DEFAULT 'web', -- 'web', 'mobile', 'admin'
  device_info TEXT, -- Browser/device information
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update attendance_logs table to include geo-location and face verification
ALTER TABLE IF EXISTS attendance_logs 
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS distance_from_location_meters NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS face_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS face_image_url TEXT,
  ADD COLUMN IF NOT EXISTS face_match_confidence NUMERIC(5, 2), -- 0-100 confidence score
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'manual', -- 'geo_face', 'geo_only', 'face_only', 'manual'
  ADD COLUMN IF NOT EXISTS device_info TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_location_settings_company_id 
  ON attendance_location_settings(company_id);

CREATE INDEX IF NOT EXISTS idx_employee_face_images_employee_id 
  ON employee_face_images(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_face_images_primary 
  ON employee_face_images(employee_id, is_primary) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_attendance_logs_location_verified 
  ON attendance_logs(location_verified);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_face_verified 
  ON attendance_logs(face_verified);

-- Enable RLS
ALTER TABLE attendance_location_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_face_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attendance_location_settings
DROP POLICY IF EXISTS "Enable read access for attendance_location_settings" ON attendance_location_settings;
CREATE POLICY "Enable read access for attendance_location_settings" ON attendance_location_settings
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Enable insert access for attendance_location_settings" ON attendance_location_settings;
CREATE POLICY "Enable insert access for attendance_location_settings" ON attendance_location_settings
  FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for attendance_location_settings" ON attendance_location_settings;
CREATE POLICY "Enable update access for attendance_location_settings" ON attendance_location_settings
  FOR UPDATE 
  USING (true);

-- RLS Policies for employee_face_images
DROP POLICY IF EXISTS "Enable read access for employee_face_images" ON employee_face_images;
CREATE POLICY "Enable read access for employee_face_images" ON employee_face_images
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Enable insert access for employee_face_images" ON employee_face_images;
CREATE POLICY "Enable insert access for employee_face_images" ON employee_face_images
  FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for employee_face_images" ON employee_face_images;
CREATE POLICY "Enable update access for employee_face_images" ON employee_face_images
  FOR UPDATE 
  USING (true);

-- Function to calculate distance between two coordinates (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 NUMERIC,
  lon1 NUMERIC,
  lat2 NUMERIC,
  lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  earth_radius NUMERIC := 6371000; -- Earth radius in meters
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  -- Convert degrees to radians
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  -- Haversine formula
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

