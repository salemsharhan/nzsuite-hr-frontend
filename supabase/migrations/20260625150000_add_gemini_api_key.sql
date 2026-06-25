-- Gemini API key for AI payroll generation (per company)
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

COMMENT ON COLUMN company_settings.gemini_api_key IS
  'Google Gemini API key for AI-assisted payroll generation. Stored per company; used only by edge functions.';
