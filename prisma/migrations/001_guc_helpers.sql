-- 001_guc_helpers.sql
-- Transaction-local GUC helper functions owned by migrator, executed by runtime app role (D-4)

CREATE OR REPLACE FUNCTION app_company_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_branch_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.branch_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_scope() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.scope', true), '')
$$;

CREATE OR REPLACE FUNCTION app_is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.scope', true), ''), '') = 'platform'
$$;

-- Ordinary scope setter: supports company, branch, service, preauth, and user scopes.
-- Rejects 'platform' scope (fails closed).
CREATE OR REPLACE FUNCTION app_set_scope(
  p_scope      text,
  p_company_id uuid,
  p_branch_id  uuid,
  p_user_id    uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN ('company', 'branch', 'service', 'preauth', 'user') THEN
    RAISE EXCEPTION 'invalid non-platform scope';
  END IF;
  IF p_scope = 'user' AND p_user_id IS NULL THEN
    RAISE EXCEPTION 'user scope requires user id';
  END IF;
  IF p_scope = 'company' AND p_company_id IS NULL THEN
    RAISE EXCEPTION 'company scope requires company id';
  END IF;
  IF p_scope IN ('branch', 'service') AND (p_company_id IS NULL OR p_branch_id IS NULL) THEN
    RAISE EXCEPTION 'branch/service scope requires company and branch ids';
  END IF;

  PERFORM set_config('app.scope', COALESCE(p_scope, ''), true);
  PERFORM set_config('app.company_id', COALESCE(p_company_id::text, ''), true);
  PERFORM set_config('app.branch_id', COALESCE(p_branch_id::text, ''), true);
  PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), true);
END;
$$;

-- Dedicated platform-scope setter for audited PlatformSupportService only (D-5)
CREATE OR REPLACE FUNCTION app_set_platform_scope(
  p_audit_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_audit_reason IS NULL OR trim(p_audit_reason) = '' THEN
    RAISE EXCEPTION 'platform support scope requires an audit reason';
  END IF;

  PERFORM set_config('app.scope', 'platform', true);
  PERFORM set_config('app.company_id', '', true);
  PERFORM set_config('app.branch_id', '', true);
  PERFORM set_config('app.audit_reason', p_audit_reason, true);
END;
$$;

-- Grant execute permissions to chatpilot_app
GRANT EXECUTE ON FUNCTION app_company_id() TO chatpilot_app;
GRANT EXECUTE ON FUNCTION app_branch_id() TO chatpilot_app;
GRANT EXECUTE ON FUNCTION app_user_id() TO chatpilot_app;
GRANT EXECUTE ON FUNCTION app_scope() TO chatpilot_app;
GRANT EXECUTE ON FUNCTION app_is_platform() TO chatpilot_app;
GRANT EXECUTE ON FUNCTION app_set_scope(text, uuid, uuid, uuid) TO chatpilot_app;
GRANT EXECUTE ON FUNCTION app_set_platform_scope(text) TO chatpilot_app;
