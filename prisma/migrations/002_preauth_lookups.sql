-- 002_preauth_lookups.sql
-- Narrow, SELECT-only pre-authentication lookup functions (AUTHORIZATION_MODEL.md §5.4)

DROP FUNCTION IF EXISTS lookup_user_by_email(text);

CREATE OR REPLACE FUNCTION lookup_user_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  password_hash text,
  role text,
  company_id uuid,
  branch_id uuid,
  is_active boolean,
  deactivated_at timestamptz,
  permissions_version integer,
  totp_secret text,
  totp_recovery_codes jsonb,
  company_status text,
  branch_is_active boolean
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
    u.name::text,
    u."passwordHash"::text,
    u.role::text,
    u."companyId",
    u."branchId",
    u."isActive",
    u."deactivatedAt",
    u."permissionsVersion",
    u."totpSecret"::text,
    u."totpRecoveryCodes",
    c.status::text,
    b."isActive"
  FROM users u
  LEFT JOIN companies c ON c.id = u."companyId"
  LEFT JOIN branches b ON b.id = u."branchId"
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION lookup_invitation_by_token_hash(p_token_hash text)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  branch_id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i."companyId",
    i."branchId",
    i.email::text,
    i.role::text,
    i.status::text,
    i."expiresAt"
  FROM invitations i
  WHERE i."tokenHash" = p_token_hash
    AND i.status = 'PENDING'
    AND i."expiresAt" > now()
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION lookup_password_reset_by_token_hash(p_token_hash text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    prt.id,
    prt."userId",
    prt."expiresAt"
  FROM password_reset_tokens prt
  WHERE prt."tokenHash" = p_token_hash
    AND prt."expiresAt" > now()
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION lookup_whatsapp_connection_by_business_id(p_provider text, p_business_id text)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  branch_id uuid,
  provider text,
  status text,
  webhook_secret_ref text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wc.id,
    wc."companyId",
    wc."branchId",
    wc.provider::text,
    wc.status::text,
    wc."webhookSecretRef"::text
  FROM whatsapp_connections wc
  WHERE wc.provider::text = p_provider
    AND wc."businessConnectionId" = p_business_id
  LIMIT 1;
END;
$$;

-- Grant execution to runtime app role
GRANT EXECUTE ON FUNCTION lookup_user_by_email(text) TO chatpilot_app;
GRANT EXECUTE ON FUNCTION lookup_invitation_by_token_hash(text) TO chatpilot_app;
GRANT EXECUTE ON FUNCTION lookup_password_reset_by_token_hash(text) TO chatpilot_app;
GRANT EXECUTE ON FUNCTION lookup_whatsapp_connection_by_business_id(text, text) TO chatpilot_app;
