-- Create message_api_configs table for storing WhatsApp message API configurations
CREATE TABLE IF NOT EXISTS message_api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  api_type TEXT NOT NULL CHECK (api_type IN ('single', 'bulk')),
  api_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  -- For single message API
  user_id INTEGER,
  message_type INTEGER DEFAULT 0,
  -- For bulk message API
  mode INTEGER DEFAULT 2,
  custom_message_template TEXT,
  -- Authentication
  auth_token TEXT,
  auth_header TEXT DEFAULT 'Authorization',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, api_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_api_configs_company_id ON message_api_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_message_api_configs_enabled ON message_api_configs(enabled);

-- Enable RLS
ALTER TABLE message_api_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow admins to view their company's config
CREATE POLICY "Admins can view their company message API configs"
  ON message_api_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (ur.role = 'admin' AND ur.company_id = message_api_configs.company_id)
      )
    )
  );

-- Allow admins to insert their company's config
CREATE POLICY "Admins can insert their company message API configs"
  ON message_api_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (ur.role = 'admin' AND ur.company_id = message_api_configs.company_id)
      )
    )
  );

-- Allow admins to update their company's config
CREATE POLICY "Admins can update their company message API configs"
  ON message_api_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (ur.role = 'admin' AND ur.company_id = message_api_configs.company_id)
      )
    )
  );

-- Allow admins to delete their company's config
CREATE POLICY "Admins can delete their company message API configs"
  ON message_api_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (ur.role = 'admin' AND ur.company_id = message_api_configs.company_id)
      )
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_message_api_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_message_api_configs_updated_at
  BEFORE UPDATE ON message_api_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_message_api_configs_updated_at();


