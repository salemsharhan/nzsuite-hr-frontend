-- Fix documents table: make category nullable or provide default
-- Since we're now using folder_id, category can be nullable
ALTER TABLE documents ALTER COLUMN category DROP NOT NULL;

-- Set default category for existing null values
UPDATE documents SET category = 'General' WHERE category IS NULL;

-- Optionally, you can also set a default value
ALTER TABLE documents ALTER COLUMN category SET DEFAULT 'General';


