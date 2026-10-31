-- 002_preauth_lookups.sql
-- Narrow, SELECT-only pre-authentication lookup functions (AUTHORIZATION_MODEL.md §5.4)

CREATE OR REPLACE FUNCTION lookup_user_by_email(p_email text)
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
    AND u."isActive" = true
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
