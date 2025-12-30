-- Fix user_roles table constraints

-- Ensure user_id has unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Ensure email has unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_email_key'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_email_key UNIQUE (email);
  END IF;
END $$;

