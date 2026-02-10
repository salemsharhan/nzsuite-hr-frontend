-- Add angle field to employee_face_images table for multi-angle face capture
ALTER TABLE employee_face_images 
ADD COLUMN IF NOT EXISTS capture_angle TEXT DEFAULT 'front'; -- 'front', 'left', 'right', 'up', 'down'

-- Add index for faster queries by angle
CREATE INDEX IF NOT EXISTS idx_employee_face_images_angle 
  ON employee_face_images(employee_id, capture_angle);

-- Update comment
COMMENT ON COLUMN employee_face_images.capture_angle IS 'Angle of face capture: front, left, right, up, down';






