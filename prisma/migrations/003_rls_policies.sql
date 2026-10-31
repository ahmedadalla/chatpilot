-- 003_rls_policies.sql
-- Forced PostgreSQL Row-Level Security with symmetrical USING and WITH CHECK policies (D-3, D-4)

-- 1. Tenant Root: companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_co_self ON companies;
CREATE POLICY tenant_co_self ON companies
  FOR ALL TO chatpilot_app
  USING (app_is_platform() OR id = app_company_id())
  WITH CHECK (app_is_platform() OR id = app_company_id());

-- 2. Company-Scoped Tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'company_settings',
    'menu_categories',
    'menu_items',
    'customers',
    'ai_configurations',
    'subscriptions',
    'usage_events',
    'files',
    'idempotency_keys',
    'company_daily_stats'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_company_policy ON %I;', tbl);
    EXECUTE format('
      CREATE POLICY tenant_company_policy ON %I
        FOR ALL TO chatpilot_app
        USING (app_is_platform() OR "companyId" = app_company_id())
        WITH CHECK (app_is_platform() OR "companyId" = app_company_id());
    ', tbl);
  END LOOP;
END
$$;

-- 3. Branch Entity
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_branch_policy ON branches;
CREATE POLICY tenant_branch_policy ON branches
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR id = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR id = app_branch_id())
    )
  );

-- 4. Branch-Scoped Tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'orders',
    'pending_orders',
    'conversations',
    'branch_daily_stats',
    'whatsapp_connections'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_branch_scoped_policy ON %I;', tbl);
    EXECUTE format('
      CREATE POLICY tenant_branch_scoped_policy ON %I
        FOR ALL TO chatpilot_app
        USING (
          app_is_platform()
          OR (
            "companyId" = app_company_id()
            AND (app_scope() = ''company'' OR "branchId" IS NULL OR "branchId" = app_branch_id())
          )
        )
        WITH CHECK (
          app_is_platform()
          OR (
            "companyId" = app_company_id()
            AND (app_scope() = ''company'' OR "branchId" IS NULL OR "branchId" = app_branch_id())
          )
        );
    ', tbl);
  END LOOP;
END
$$;

-- 5. Child Tables of Orders / Branches
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_order_items ON order_items;
CREATE POLICY tenant_order_items ON order_items
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items."orderId"
        AND o."companyId" = app_company_id()
        AND (app_scope() = 'company' OR o."branchId" = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items."orderId"
        AND o."companyId" = app_company_id()
        AND (app_scope() = 'company' OR o."branchId" = app_branch_id())
    )
  );

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_order_history ON order_status_history;
CREATE POLICY tenant_order_history ON order_status_history
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_history."orderId"
        AND o."companyId" = app_company_id()
        AND (app_scope() = 'company' OR o."branchId" = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_history."orderId"
        AND o."companyId" = app_company_id()
        AND (app_scope() = 'company' OR o."branchId" = app_branch_id())
    )
  );

ALTER TABLE order_transition_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_transition_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_order_tokens ON order_transition_tokens;
CREATE POLICY tenant_order_tokens ON order_transition_tokens
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_transition_tokens."orderId"
        AND o."companyId" = app_company_id()
        AND (app_scope() = 'company' OR o."branchId" = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_transition_tokens."orderId"
        AND o."companyId" = app_company_id()
        AND (app_scope() = 'company' OR o."branchId" = app_branch_id())
    )
  );

ALTER TABLE branch_day_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_day_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_day_counters ON branch_day_counters;
CREATE POLICY tenant_day_counters ON branch_day_counters
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_day_counters."branchId"
        AND b."companyId" = app_company_id()
        AND (app_scope() = 'company' OR b.id = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_day_counters."branchId"
        AND b."companyId" = app_company_id()
        AND (app_scope() = 'company' OR b.id = app_branch_id())
    )
  );

ALTER TABLE menu_item_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_availabilities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_item_availabilities ON menu_item_availabilities;
CREATE POLICY tenant_item_availabilities ON menu_item_availabilities
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = menu_item_availabilities."branchId"
        AND b."companyId" = app_company_id()
        AND (app_scope() = 'company' OR b.id = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = menu_item_availabilities."branchId"
        AND b."companyId" = app_company_id()
        AND (app_scope() = 'company' OR b.id = app_branch_id())
    )
  );

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_messages ON messages;
CREATE POLICY tenant_messages ON messages
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages."conversationId"
        AND c."companyId" = app_company_id()
        AND (app_scope() = 'company' OR c."branchId" IS NULL OR c."branchId" = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages."conversationId"
        AND c."companyId" = app_company_id()
        AND (app_scope() = 'company' OR c."branchId" IS NULL OR c."branchId" = app_branch_id())
    )
  );

-- 6. Nullable-Branch Knowledge Base Tables
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kb_documents_policy ON knowledge_base_documents;
CREATE POLICY kb_documents_policy ON knowledge_base_documents
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR "branchId" IS NULL OR "branchId" = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR "branchId" IS NULL OR "branchId" = app_branch_id())
    )
  );

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kb_chunks_policy ON knowledge_chunks;
CREATE POLICY kb_chunks_policy ON knowledge_chunks
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR "branchId" IS NULL OR "branchId" = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR "branchId" IS NULL OR "branchId" = app_branch_id())
    )
  );

-- 7. User and Invitation Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_policy ON users;
CREATE POLICY users_policy ON users
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR (app_scope() = 'company' AND "companyId" = app_company_id())
    OR (app_scope() IN ('branch', 'service') AND "branchId" = app_branch_id())
    OR (id = app_user_id())
  )
  WITH CHECK (
    app_is_platform()
    OR (app_scope() = 'company' AND "companyId" = app_company_id())
    OR (app_scope() IN ('branch', 'service') AND "branchId" = app_branch_id())
    OR (id = app_user_id())
  );

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitations_policy ON invitations;
CREATE POLICY invitations_policy ON invitations
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR "branchId" IS NULL OR "branchId" = app_branch_id())
    )
  )
  WITH CHECK (
    app_is_platform()
    OR (
      "companyId" = app_company_id()
      AND (app_scope() = 'company' OR "branchId" IS NULL OR "branchId" = app_branch_id())
    )
  );

-- 8. Owner-Only Tables (Sessions, Refresh Tokens, Password Resets)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'auth_sessions',
    'refresh_tokens',
    'password_reset_tokens'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS owner_only_policy ON %I;', tbl);
    EXECUTE format('
      CREATE POLICY owner_only_policy ON %I
        FOR ALL TO chatpilot_app
        USING (app_is_platform() OR "userId" = app_user_id())
        WITH CHECK (app_is_platform() OR "userId" = app_user_id());
    ', tbl);
  END LOOP;
END
$$;

-- 9. Audit Log Policy
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_policy ON audit_logs;
CREATE POLICY audit_logs_policy ON audit_logs
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR ("companyId" = app_company_id() AND "companyId" IS NOT NULL)
  )
  WITH CHECK (
    app_is_platform()
    OR ("companyId" = app_company_id() AND "companyId" IS NOT NULL)
  );

-- 10. Platform Stats Policy
ALTER TABLE platform_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_daily_stats FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_stats_policy ON platform_daily_stats;
CREATE POLICY platform_stats_policy ON platform_daily_stats
  FOR ALL TO chatpilot_app
  USING (app_is_platform())
  WITH CHECK (app_is_platform());
