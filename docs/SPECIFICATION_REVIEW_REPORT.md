# ChatPilot specification review report

**Scope:** Final pre-implementation reconciliation of `ARCHITECTURE.md`,
`AUTHORIZATION_MODEL.md`, `DATA_OWNERSHIP.md`, `DECISIONS.md`, `FEATURE_STATUS.md`,
and `IMPLEMENTATION_PLAN.md`.

**Implementation status:** No application feature was implemented. All feature
statuses remain strictly `PLANNED`.

## Errors corrected

### Final pre-implementation reconciliation fixes:
- **Order state machine & role permissions:**
  - Resolved `STAFF` operational boundaries: `STAFF` is the front-of-house / intake
    operator who accepts or rejects/cancels `PENDING` orders only. Removed stray
    `STAFF` entries from `ARCHITECTURE.md` table for `start_preparation` and `mark_ready`
    (strictly `KITCHEN`).
  - Removed `DELIVERY` access to `PENDING` order rejection across `AUTHORIZATION_MODEL.md`,
    `ARCHITECTURE.md`, `DATA_OWNERSHIP.md`, and `FEATURE_STATUS.md`. Delivery drivers
    handle delivery transitions and delivery failure reporting only.
  - Aligned operational portals, backend API capability enforcement, and test suites
    so illegal transitions (e.g. Staff attempting prep, Delivery attempting pending rejection)
    consistently return 403 Forbidden.
- **WhatsApp onboarding choices & Baileys worker architecture:**
  - Defined three customer-selectable onboarding choices in the connection wizard:
    1. Standard Meta Cloud API (official default).
    2. Official WhatsApp Business Coexistence for eligible accounts.
    3. Regular WhatsApp QR/device pairing adapter: enabled as an option in the connection
       wizard and not disabled by default (Q-REQ-4), with explicit customer risk
       acknowledgement (unofficial status, session disconnects, terms risk). Decoupled
       behind `WhatsAppProvider` using `@whiskeysockets/baileys` embedded in a dedicated,
       isolated `apps/whatsapp-worker` container (D-21); credentials envelope-encrypted into
       PostgreSQL via `SecretsService`; reconnect worker handles dropped sockets; strictly
       labeled as non-official in UI and API.
  - Phase 6 includes a time-boxed Baileys POC verification gate (QR generation/refresh,
    session persistence, reconnect on restart, disconnect detection, text/media dispatch,
    and dedup). Evolution API is retained as an evaluated fallback; WPPConnect is excluded
    due to heavy Chromium memory footprint.
  - All three adapters implement the same secure company/branch routing and common
    conversation/order pipeline.
- **Target market defaults & localization (Q-REQ-6, D-22):**
  - Configured Egypt (`EG`) defaults with international expansion readiness:
    currency `EGP`, timezone `Africa/Cairo`, locale `ar-EG` (Arabic-first) with English
    (`en-US`) toggle, Arabic RTL-first layouts, and `libphonenumber` validation/normalization
    with `+20` default.
  - Country, currency, timezone, language, and phone defaults are strictly configurable
    per company via `CompanySettings`; no hardcoding of EGP or Egypt in database schemas
    or business logic. Multi-currency segregation is preserved in financial calculations.
- **Hybrid branch-routing requirement:**
  - Promoted the hybrid branch-routing rule to canonical product requirement `Q-REQ-5`
    in `DECISIONS.md`.
  - Canonical rule: explicit branch mapping routes directly; a company with one active
    branch defaults to it; a company-level connection with multiple active branches
    requires customer branch selection before ordering; selected branch is persisted
    on `Conversation.branchId`; branch is validated to be active and company-owned;
    order creation is strictly blocked while branch resolution is incomplete.
  - Updated references across all documents and removed all stale references describing
    routing as unconfirmed.
- **Outstanding architectural decisions resolved as engineering defaults:**
  - D-16: One role per user in v1 (`User.role`), multi-role deferred post-v1.
  - D-17: Multiple WhatsApp connections per company across any supported adapter.
  - D-18: Audited Company Admin branch timezone corrections preserving historical order
    timestamps and sequenceDay values.
  - D-19: Required TOTP MFA for Super Admin in v1 with 10 single-use recovery codes;
    SMS and WebAuthn deferred.
  - D-20: Platform analytics display currency-specific totals by default without FX conversion.
  - D-21: Dedicated WhatsApp worker process with Baileys and envelope-encrypted sessions.
  - D-22: Configurable localization and phone normalization defaults.
- **Operational vs financial analytics separation:**
  - Split generic branch analytics capabilities into `analytics:operational:read`
    (order throughput, volumes, queue depth, prep/delivery durations) and
    `analytics:financial:read` (GMV subtotal/delivery/total, revenue, average ticket, pricing loss).
  - Granted operational metrics to operational branch roles (`KITCHEN`, `DELIVERY`, `STAFF`);
    strictly denied financial metrics to operational staff in capability matrices,
    endpoint definitions, and test suites.
- **RLS-safe Super Admin authentication & session lifecycle:**
  - Added `'user'` scope to `app_set_scope` allowing Super Admin login session creation,
    token refresh, self-logout, and self-session revocation to execute with `app.user_id = userId`
    matching owner-scoped policies (`AuthSession`, `RefreshToken`).
  - Guaranteed that under `'user'` scope, `app_is_platform()` strictly evaluates to `FALSE`,
    preventing ordinary auth and worker code from obtaining platform-wide access to tenant data.
  - Confined platform-wide administrative session revocation strictly to the audited
    `PlatformSupportService` using `app_set_platform_scope(p_audit_reason)`.
- **OrderTransitionToken & transition concurrency semantics:**
  - Corrected the concurrency model: clarified that a uniqueness constraint including
    `actorUserId` does not collide across competing actors.
  - Established atomic conditional state updates (`UPDATE "Order" SET status = :to WHERE id = :id AND status = :from`)
    as the sole mechanism guaranteeing a single winner under concurrency; competing actors
    receive 409 Conflict when 0 rows match.
  - Defined `OrderTransitionToken` as the mechanism for same-actor idempotent replay
    (returning stored results with 200 OK without re-executing side effects).
- **Knowledge Base migration & filtered vector search:**
  - Corrected the migration target: both the `vector(1536)` column (`embedding`) and
    the HNSW index (`kb_hnsw`) are defined directly on `KnowledgeChunk`, NOT on
    `KnowledgeBaseDocument`.
  - Removed erroneous claims of PostgreSQL "tenant partitioning", replacing them with
    accurate descriptions of compound tenant-filtered ANN search (`company_id` and optional `branch_id`).
  - Added retrieval accuracy (recall@5 >= 95% vs kNN ground truth) and performance/latency
    benchmark (p95 < 50ms) test gates for filtered ANN queries in Phase 7.
- **ScopedPrisma contract strengthening:**
  - Added context binding invariants to `ScopedPrisma` / `TenantScopeService` enforcing
    that an authenticated user cannot be paired with a mismatched company or branch scope
    (e.g. User A of Company 1 paired with Company 2).
  - Specified immediate fail-closed rejection with `InvalidTenantContextException` before
    opening transactions or setting GUCs.
  - Added negative test cases in the `rls` integration test suite.
- **Stale decision IDs & report claims:**
  - Corrected `deferred (A-2)` for multi-role users in `IMPLEMENTATION_PLAN.md` to `deferred (A-1)`.
  - Replaced all stale references to `A-2` with `Q-REQ-5`.

### Prior review corrections retained:
- Removed the invalid `DELIVERED → FAILED_DELIVERY` path. `DELIVERED`,
  `CANCELLED`, and `FAILED_DELIVERY` are terminal.
- Made `FAILED_DELIVERY` reachable only from `OUT_FOR_DELIVERY`, with a required
  reason and only Delivery or the assigned Branch Manager permitted to report it.
- Made branch creation/deactivation Company Admin-only. Branch Managers may edit
  operational settings for their assigned branch.
- Changed WhatsApp routing to use the receiving business connection identifier;
  the customer's sender number is never a tenant-routing key.
- Standardized webhook verification, five-minute freshness, deduplication by
  `(provider, providerMessageId)`, quarantine of unknown connections, and
  acknowledgement within two seconds.
- Corrected PostgreSQL policy examples by removing invalid `AS FOR` syntax,
  adding `ENABLE` and `FORCE ROW LEVEL SECURITY`, and adding `WITH CHECK` clauses.
- Added narrow, SELECT-only pre-authentication lookup rules for login,
  invitation acceptance, password reset, and webhook connection resolution.
- Added null/empty-safe UUID GUC helpers and a typed `app_user_id()` helper.
- Standardized `sequenceDay` as PostgreSQL `date` / Prisma `DateTime @db.Date`.
- Removed unsupported historical “Session 1” product-owner confirmations.

## Decisions that remain open

The architectural defaults above (D-16 through D-20) have resolved prior operational ambiguities. The following items genuinely remain open for business confirmation before their respective implementation phases:

- **A-1:** Platform reporting currency (e.g. SAR or USD) and approved FX-rate source / refresh policy (required before Phase 8 billing and reporting rollups).
- **A-2:** Multi-currency company operational settlement policy if a company operates branches across different currency boundaries (required before Phase 8).
*(Note: R-1 is confirmed and resolved by Product Owner approval enabling regular QR device pairing in the wizard for clients without Meta Business Accounts).*

## Tests required before implementation begins

The implementation must add and pass these gates against real PostgreSQL (and
Redis where queue behavior is involved):

- **RLS coverage migration test:** every tenant-sensitive table has `ENABLE`,
  `FORCE`, and a policy with valid `USING`/`WITH CHECK` semantics.
- **ScopedPrisma context binding tests:** authenticated user paired with mismatched
  company or branch throws `InvalidTenantContextException` and aborts without DB writes.
- **Super Admin self-auth RLS tests:** login session creation, token refresh, and
  self-logout execute under `scope='user'`, proving `app_is_platform()` is false
  and tenant tables remain inaccessible.
- **Order state machine tests:**
  - Legal transition matrix passing; illegal transitions returning 403 or 422.
  - Concurrent accept: 2 KITCHEN sessions race for same PENDING order → conditional
    UPDATE ensures single winner (200 OK); competing session receives 409 Conflict.
  - Same-actor replay via `OrderTransitionToken` returns 200 OK with cached result
    and no duplicate notifications.
  - `DELIVERY` role calling `reject_pending` or cancel on PENDING → 403 Forbidden.
  - `STAFF` role attempting `start_preparation` or `mark_ready` → 403 Forbidden.
  - Auto-timeout sweeper: conditional first-writer-wins cancellation.
- **WhatsApp tests:**
  - Cloud API challenge/signature verification, business connection routing, sender-number
    non-routing, five-minute freshness, deduplication, quarantine, retry, and outbound two-phase.
  - Hybrid branch-routing rule (Q-REQ-5): explicit branch routes directly; 1 active branch
    defaults; >1 active branches prompts customer for selection and blocks order creation.
  - Regular WhatsApp QR adapter lifecycle: pairing initiation (QR/pairing-code generation),
    connection state transitions, automated reconnection, and message delivery.
  - Baileys POC verification gate: QR refresh, session persistence, reconnect across restarts,
    disconnect detection, and dedup protection.
  - Phone number normalization (`libphonenumber-js`): Egypt `+20` default, international formats,
    malformed numbers failing closed.
- **Knowledge Base vector search tests:**
  - `KnowledgeChunk` vector column and HNSW index migration verification.
  - Filtered ANN retrieval accuracy: recall@5 >= 95% against exact kNN ground truth
    for tenant-filtered queries.
  - Filtered ANN performance and latency benchmark: p95 query latency < 50ms under load.
- **Analytics isolation tests:**
  - Operational staff (`KITCHEN`, `DELIVERY`, `STAFF`) accessing financial analytics
    endpoints receive 403 Forbidden; operational branch endpoints omit financial fields.

## Validation performed for this reconciliation

- **Decision-reference scan:** all referenced `Q-REQ-*`, `D-*`, `A-*`, and `R-*`
  identifiers resolve in `DECISIONS.md`.
- **Feature-status scan:** all 147 feature rows remain `PLANNED`.
- **Role & State machine scan:** role permissions, state transitions, portal boundaries,
  and test assertions agree across all files.
- **Schema & Migration scan:** `KnowledgeChunk` owns the vector column and HNSW index;
  partitioning claims removed; `ScopedPrisma` context binding invariants defined.

Runtime PostgreSQL, Redis, and application integration tests cannot run yet
because this task intentionally leaves the application unimplemented. They
remain mandatory implementation gates above.
