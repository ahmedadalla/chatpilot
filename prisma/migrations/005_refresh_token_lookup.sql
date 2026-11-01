-- 005_refresh_token_lookup.sql
-- Narrow pre-auth lookup for rotating refresh tokens.

CREATE OR REPLACE FUNCTION lookup_refresh_token_by_hash(p_token_hash text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  company_id uuid,
  branch_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rt.id,
    rt."userId",
    u."companyId",
    u."branchId"
  FROM refresh_tokens rt
  JOIN users u ON u.id = rt."userId"
  WHERE rt."tokenHash" = p_token_hash
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION lookup_refresh_token_by_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_refresh_token_by_hash(text) TO chatpilot_app;
