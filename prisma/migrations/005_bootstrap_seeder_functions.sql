-- 005_bootstrap_seeder_functions.sql
-- SECURITY DEFINER bootstrap helpers for RLS-enforced environments
-- These functions run as chatpilot_migrator (table owner, bypasses RLS)
-- to allow initial super admin creation when no tenant scope is set.

-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Platform-level super admin lookup (replaces prisma.user.findFirst with RLS)
CREATE OR REPLACE FUNCTION platform_find_super_admin(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  password_hash text,
  role text,
  company_id uuid,
  branch_id uuid,
  is_active boolean,
  permissions_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u."passwordHash"::text,
    u.role::text,
    u."companyId",
    u."branchId",
    u."isActive",
    u."permissionsVersion"
  FROM users u
  WHERE lower(u.email) = lower(p_email)
    AND u.role = 'SUPER_ADMIN'
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION platform_find_super_admin(text) TO chatpilot_app;

-- 2. Privileged super admin creator (bypasses RLS INSERT restrictions)
-- Sets explicit platform scope and generates UUID before INSERT to avoid RLS issues.
CREATE OR REPLACE FUNCTION superadmin_create_user(
  p_email text,
  p_name text,
  p_password_hash text,
  p_totp_secret text,
  p_totp_recovery_codes jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE new_id uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;
  IF p_password_hash IS NULL OR trim(p_password_hash) = '' THEN
    RAISE EXCEPTION 'password hash required';
  END IF;

  -- Set explicit platform scope so RLS allows the INSERT
  PERFORM set_config('app.scope', 'platform', true);
  PERFORM set_config('app.company_id', '', true);
  PERFORM set_config('app.branch_id', '', true);
  PERFORM set_config('app.user_id', '', true);

  -- Generate UUID explicitly since set_config resets GUCs inside SECURITY DEFINER
  new_id := gen_random_uuid();

  INSERT INTO users (
    id,
    email, name, "passwordHash", role,
    "platformCapable", "isActive", "isVerified",
    "permissionsVersion", "totpSecret", "totpRecoveryCodes"
  ) VALUES (
    new_id,
    lower(trim(p_email)), p_name, p_password_hash, 'SUPER_ADMIN',
    true, true, true, 1, p_totp_secret, p_totp_recovery_codes
  );

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION superadmin_create_user(text, text, text, text, jsonb) TO chatpilot_app;
