# FEATURE_STATUS.md — Feature Matrix

**Status:** All features are `PLANNED` (no implementation has started).
**Related:** `IMPLEMENTATION_PLAN.md` (phases), `ARCHITECTURE.md` (modules), `SPECIFICATION_REVIEW_REPORT.md`

Legend: Phase = target implementation phase (`P0`–`P9`); Suite = primary test suite that verifies it.

---

## Foundation (P0)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-01 | pnpm workspaces + Turborepo monorepo | infra | unit | PLANNED |
| F-02 | TypeScript strict config across all apps | infra | typecheck | PLANNED |
| F-03 | ESLint gates: raw-Prisma ban, platform-scope ban, GUC-interpolation ban | infra/lint | lint | PLANNED |
| F-04 | docker-compose: PostgreSQL 17 + Redis 7 | infra | integration | PLANNED |
| F-05 | Boot-time env-var validation (fail-fast on missing secrets) | api/config | unit | PLANNED |
| F-06 | `/healthz` liveness endpoint | api/health | unit | PLANNED |
| F-07 | `/readyz` readiness endpoint (incl. RLS self-test) | api/health | rls | PLANNED |
| F-08 | CI pipeline: lint → typecheck → unit → integration → e2e | infra/ci | — | PLANNED |
| F-09 | pino JSON structured logging + correlation IDs | api/logging | unit | PLANNED |
| F-10 | OpenTelemetry SDK (traces across api + worker) | api/worker/otel | integration | PLANNED |
| F-11 | Prometheus-style metrics endpoint | api/metrics | integration | PLANNED |
| F-12 | `packages/contracts`: shared enums, capability types, OpenAPI-generated types | contracts | typecheck | PLANNED |

---

## Domain + Database (P1)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-13 | Prisma schema (all entities per DATA_OWNERSHIP matrix) | prisma | — | PLANNED |
| F-14 | Initial migration: tables + composite FK backstops | prisma/migrations | rls | PLANNED |
| F-15 | RLS helper functions (`app_company_id`, `app_branch_id`, `app_scope`, `app_is_platform`, `app_set_scope`) | prisma/migrations | rls | PLANNED |
| F-16 | RLS policies for all tenant-protected tables (per AUTHORIZATION_MODEL §5) | prisma/migrations | rls | PLANNED |
| F-16a | RLS migration coverage test: every tenant-sensitive table has ENABLE/FORCE and valid USING/WITH CHECK policy | tests/security | rls | PLANNED |
| F-16b | Narrow preauth lookup policies/functions for login, invitation, reset, and webhook connection resolution | api/auth/prisma | rls | PLANNED |
| F-17 | `BranchDayCounter` table + atomic upsert migration | prisma/migrations | order-workflow | PLANNED |
| F-18 | `WhatsAppEventDedup` table + unique index `(provider, providerMessageId)` | prisma/migrations | whatsapp | PLANNED |
| F-19 | `OrderTransitionToken` table + unique index `(orderId, action, actorUserId)` for same-actor replay | prisma/migrations | order-workflow | PLANNED |
| F-20 | `PendingOrder` table + `confirmToken` hash + `expiresAt` | prisma/migrations | whatsapp | PLANNED |
| F-21 | `IdempotencyKey` table | prisma/migrations | order-workflow | PLANNED |
| F-22 | `UsageEvent` append-only table | prisma/migrations | analytics | PLANNED |
| F-23 | Dev-only seed script (env-guarded, idempotent, refuses `PRODUCTION=true`) | prisma/seed | — | PLANNED |
| F-24 | `ScopedPrismaModule` + `TenantScopeService` (GUC-setting wrapper, context-binding validation preventing cross-tenant user pairing, only legal DB entry point) | api/db | rls | PLANNED |
| F-25 | Two DSN enforcement at boot (migrator vs app role) | api/config | rls | PLANNED |

---

## Authentication + Authorization (P2)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-26 | Argon2id password hashing service | api/auth | auth | PLANNED |
| F-27 | Login endpoint (credential verify → session + JWT + refresh cookie) | api/auth | auth | PLANNED |
| F-28 | Access JWT issuance: `{sub, sid, jti, ver}` only — no scope/role claims | api/auth | auth | PLANNED |
| F-29 | Refresh token: SHA-256 stored, rotated on use, CAS via SELECT FOR UPDATE | api/auth | auth | PLANNED |
| F-30 | Refresh token reuse detection → revoke whole session + AuditLog | api/auth | auth | PLANNED |
| F-31 | Refresh endpoint: re-runs full authz checks (isActive + company ACTIVE + Branch.isActive) | api/auth | auth | PLANNED |
| F-32 | Logout: revoke session (all refresh hashes) | api/auth | auth | PLANNED |
| F-33 | Session revocation on sensitive change (password change, role change, company suspension) | api/auth | auth | PLANNED |
| F-34 | `AuthContext` builder: from fresh DB row exclusively (never from JWT claims) | api/auth | auth | PLANNED |
| F-35 | `PermissionVersionService`: single chokepoint bumping `User.permissionsVersion` | api/auth | auth | PLANNED |
| F-36 | Per-request guards: JWT sig+exp → session → isActive+ACTIVE+isActive → ver check | api/auth | auth | PLANNED |
| F-37 | Capability-based permission guard (decorator/middleware) | api/auth | auth | PLANNED |
| F-38 | Scope guard: 404 for cross-tenant, 403 for in-scope no-permission | api/auth | auth | PLANNED |
| F-39 | Required TOTP MFA enrollment + verification for SUPER_ADMIN with 10 single-use recovery codes (D-19) | api/auth/mfa | auth | PLANNED |
| F-40 | Re-auth gate for MFA-protected SUPER_ADMIN privilege endpoints | api/auth | auth | PLANNED |
| F-41 | Bootstrap SUPER_ADMIN: env-driven, idempotent migrator step; refuses in PRODUCTION without override | api/auth/seed | auth | PLANNED |
| F-42 | Invitation lifecycle: create → email → accept → activate user | api/auth/invite | auth | PLANNED |
| F-43 | `preauth` and `user` scopes: narrow SELECT-only pre-auth lookups; `user` scope for Super Admin self-auth lifecycle | api/auth | rls | PLANNED |
| F-44 | `service` scope: GUCs from DB-verified binding (webhook, worker) | api/worker | rls | PLANNED |
| F-44a | Ordinary scope setter rejects platform scope; PlatformSupportService path is audited and separately tested | api/worker | isolation | PLANNED |
| F-45 | Rate limiting: login (5/min/IP + 10/min/email), reset, refresh | api/auth | auth | PLANNED |
| F-46 | User-enumeration prevention: identical 401 for missing vs bad credentials | api/auth | auth | PLANNED |
| F-47 | Password reset: single-use hashed token, short TTL, revokes prior, revokes sessions on use | api/auth | auth | PLANNED |
| F-48 | Grantor allowlists enforced (COMPANY_ADMIN → {CA,BM,K,D,S}; BM → {K,D,S} own branch) | api/auth | isolation | PLANNED |
| F-49 | Last-admin rule: 409 on deactivation/role-change leaving no active COMPANY_ADMIN | api/auth | isolation | PLANNED |
| F-50 | HttpOnly Secure SameSite=Lax cookie for refresh token | api/auth | auth | PLANNED |

---

## Company + Branch Management (P3)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-51 | Company create (SUPER_ADMIN; status INITIATED → ACTIVE on first admin accept) | api/company | isolation | PLANNED |
| F-52 | Company + first admin invitation: transactional (atomic) | api/company | isolation | PLANNED |
| F-53 | Company suspend/activate (SUPER_ADMIN) + cascading session revocation | api/company | auth | PLANNED |
| F-54 | Company settings CRUD: profile, country, currency, timezone, locale defaults (configurable per company, Q-REQ-6) | api/company | isolation | PLANNED |
| F-55 | Branch lifecycle: create/deactivate (COMPANY_ADMIN only) | api/branch | isolation | PLANNED |
| F-56 | Branch operational settings CRUD (COMPANY_ADMIN; BRANCH_MANAGER own branch) | api/branch | isolation | PLANNED |
| F-57 | Branch IANA timezone: set at creation, Company Admin auditable correction preserving past order timestamps and sequence-day values (D-18) | api/branch | — | PLANNED |
| F-58 | Staff invite at company-level (COMPANY_ADMIN) | api/staff | isolation | PLANNED |
| F-59 | Staff invite at branch-level (COMPANY_ADMIN or BRANCH_MANAGER own branch) | api/staff | isolation | PLANNED |
| F-60 | Staff deactivate (within scope + last-admin check) | api/staff | isolation | PLANNED |
| F-61 | SUPER_ADMIN companies list + audited support view | api/platform | isolation | PLANNED |
| F-62 | AuditLog write for every SUPER_ADMIN cross-tenant read | api/platform | isolation | PLANNED |

---

## Menu + Files (P4)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-63 | Menu categories CRUD (COMPANY_ADMIN; soft-delete) | api/menu | isolation | PLANNED |
| F-64 | Menu items CRUD (COMPANY_ADMIN; soft-delete) | api/menu | isolation | PLANNED |
| F-65 | Branch availability overrides (COMPANY_ADMIN; BRANCH_MANAGER own branch) | api/menu | isolation | PLANNED |
| F-66 | Price/availability resolution service (single source of truth for consumers) | api/menu | isolation | PLANNED |
| F-67 | Image upload (magic-byte sniff + MIME + size cap + purpose tag server-assigned) | api/files | isolation | PLANNED |
| F-68 | Private S3 presigned URL generation (capability→purpose check; ≤5 min TTL) | api/files | isolation | PLANNED |
| F-69 | File capability→purpose mapping enforced at URL-generation time | api/files | isolation | PLANNED |

---

## Orders + Kitchen + Delivery + Socket.IO (P5)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-70 | Order create: numbering (BranchDayCounter) + idempotency + transactional items + Decimal totals | api/orders | order-workflow | PLANNED |
| F-71 | Order idempotency: 23505 on `idempotencyKey` → 200 existing order (never 500) | api/orders | order-workflow | PLANNED |
| F-72 | Order state machine: all 8 states and canonical legal transitions; terminal states cannot transition | api/orders | order-workflow | PLANNED |
| F-73 | Order transition: conditional UPDATE on Order guarantees single winner; `OrderTransitionToken` records claim for same-actor replay | api/orders | order-workflow | PLANNED |
| F-74 | Same-actor replay returns stored result (200); competing actor gets 409 via conditional UPDATE match failure | api/orders | order-workflow | PLANNED |
| F-75 | Concurrent accept: exactly one winner (conditional UPDATE row-lock) | api/orders | order-workflow | PLANNED |
| F-76 | CANCELLED + FAILED_DELIVERY: reason codes recorded in `OrderStatusHistory` | api/orders | order-workflow | PLANNED |
| F-77 | Auto-timeout purge: `order-timeout-purge` queue, single conditional UPDATE, first-writer-wins | api/worker | order-workflow | PLANNED |
| F-78 | Kitchen board: KITCHEN + BRANCH_MANAGER view; only KITCHEN performs prep transitions; STAFF views intake board to accept/reject PENDING only | api/orders | order-workflow | PLANNED |
| F-79 | Delivery board: DELIVERY + BRANCH_MANAGER view; DELIVERY performs delivery transitions and reports failure; DELIVERY has no pending rejection rights | api/orders | order-workflow | PLANNED |
| F-80 | Socket.IO gateway: authenticated handshake (cookie or one-time token) | api/socket | socket | PLANNED |
| F-81 | Socket.IO: server-decided rooms from AuthContext; client joins dropped + logged | api/socket | socket | PLANNED |
| F-82 | Socket.IO: ver re-check cadence ≤ access-token TTL; stale → disconnect 4003 | api/socket | socket | PLANNED |
| F-83 | Socket.IO: session revocation via Redis `session:revoked` → immediate disconnect | api/socket | socket | PLANNED |
| F-84 | Order status-change events emitted to `branch:{branchId}` room | api/socket | socket | PLANNED |
| F-85 | `notify` queue: BullMQ jobs for push notifications after order transitions | api/worker | order-workflow | PLANNED |
| F-86 | `OrderStatusHistory` append-only record per transition | api/orders | order-workflow | PLANNED |

---

## WhatsApp + AI Ordering (P6)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-87 | WhatsApp provider abstraction (adapter interface) | api/whatsapp | whatsapp | PLANNED |
| F-88 | Standard Meta Cloud API adapter (official default): business connection onboarding + encrypted credentials | api/whatsapp | whatsapp | PLANNED |
| F-88a | Official WhatsApp Business Coexistence adapter: official coexistence mode for eligible accounts via Cloud API | api/whatsapp | whatsapp | PLANNED |
| F-88b | Regular WhatsApp QR/device-pairing adapter: Baileys in dedicated whatsapp-worker; connection wizard option not disabled by default; customer risk acknowledgement; session persistence, reconnect worker (Q-REQ-4, D-21) | api/whatsapp | whatsapp | PLANNED |
| F-89 | HMAC signature verification per-connection (webhook intake) | api/whatsapp | whatsapp | PLANNED |
| F-90 | Receiving business connection identifier → `(companyId, branchId)` mapping: server-side only; hybrid branch routing (Q-REQ-5): explicit branch routes directly, single active branch defaults, multi-branch requires customer selection before order creation, branch validated and persisted on Conversation | api/whatsapp | whatsapp | PLANNED |
| F-91 | Unknown business connection: ack 200 + quarantine queue + AuditLog | api/whatsapp | whatsapp | PLANNED |
| F-92 | `WhatsAppEventDedup` two-phase: INSERT ON CONFLICT DO NOTHING; sweeper re-queues stale QUEUED | api/worker | whatsapp | PLANNED |
| F-93 | Webhook freshness window: 5 min (configurable); stale → ack 200 + AuditLog | api/whatsapp | whatsapp | PLANNED |
| F-94 | Externally reachable webhook ingress: signature/challenge verification and ack within 2 seconds, async processing | api/worker | whatsapp | PLANNED |
| F-95 | Outbound message two-phase: QUEUED → ACCEPTED (`+providerWamid`) or FAILED | api/whatsapp | whatsapp | PLANNED |
| F-96 | `whatsapp-out` queue + `dedup-sweeper` queue | api/worker | whatsapp | PLANNED |
| F-97 | AI provider abstraction (Gemini / OpenAI / OpenRouter adapters) | api/ai | whatsapp | PLANNED |
| F-98 | Per-company AI API key: envelope-encrypted; never in logs/tools/frontend | api/ai | whatsapp | PLANNED |
| F-99 | AI ordering tools: `get_menu`, `build_cart`, `propose_order`, `create_order`, `cancel_pending_order`, `search_knowledge` | api/ai | whatsapp | PLANNED |
| F-100 | AI tools retrieve authoritative prices/totals from DB; model never invents values | api/ai | ai-prompt-injection | PLANNED |
| F-101 | `PendingOrder` lifecycle: confirmToken (7-char, stored hash), expiresAt 10 min, OPEN→CONSUMED→EXPIRED | api/ai | whatsapp | PLANNED |
| F-102 | Customer confirmation gate: server-matched token required before `create_order` | api/ai | whatsapp | PLANNED |
| F-103 | AI conversation: tool parameters server-side re-validated before execution | api/ai | ai-prompt-injection | PLANNED |
| F-104 | Prompt injection defences: delimited+labelled data; per-turn token/tool-call caps; strict tool allowlist | api/ai | ai-prompt-injection | PLANNED |
| F-105 | `ai-process` queue: async AI turn processing | api/worker | whatsapp | PLANNED |
| F-106 | Conversation + Message persistence | api/conversations | whatsapp | PLANNED |
| F-107 | `UsageEvent` write on order_created, message_sent events | api/orders/ai | analytics | PLANNED |
| F-108 | Cloud API connection-health job: monitor subscription/token/connection status and alert on failure | api/worker | whatsapp | PLANNED |

---

## Knowledge Base (P7)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-109 | Secure KB document upload → S3 (magic-byte + size cap + purpose tag) | api/kb | isolation | PLANNED |
| F-110 | `kb-ingest` queue: chunking + embedding generation | api/worker | isolation | PLANNED |
| F-111 | pgvector `vector(dim)` column + HNSW index defined on `KnowledgeChunk` (`kb_hnsw`) via raw migration; tenant-filtered ANN queries without table partitioning | prisma/migrations | isolation | PLANNED |
| F-112 | Tenant-scoped retrieval: `company_id` filter BEFORE vector similarity (+ RLS backstop) | api/kb | isolation | PLANNED |
| F-113 | KB document management UI (COMPANY_ADMIN; BRANCH_MANAGER read) | web/kb | isolation | PLANNED |
| F-114 | KB reprocess + cascade delete (chunks + embeddings) | api/kb | isolation | PLANNED |

---

## Analytics + Subscriptions (P8)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-115 | `PlatformDailyStats` rollup table (GMV cols structurally separate from SaaS-revenue cols) | prisma/migrations | analytics | PLANNED |
| F-116 | `CompanyDailyStats` rollup table | prisma/migrations | analytics | PLANNED |
| F-117 | `BranchDailyStats` rollup table | prisma/migrations | analytics | PLANNED |
| F-118 | `analytics-aggregate` worker: tenant-bound company/branch rollups plus aggregate-only platform rollup source; no general platform scope | api/worker | analytics | PLANNED |
| F-118a | Analytics worker privilege test: documented reads/writes succeed; arbitrary tenant reads and platform scope fail | tests/security | analytics | PLANNED |
| F-118b | Platform GMV rollups remain currency-specific and never combine unlike currencies | tests/integration | analytics | PLANNED |
| F-119 | Platform analytics dashboard (SUPER_ADMIN; rollup reads only) | web/analytics | analytics | PLANNED |
| F-120 | Company analytics dashboard (COMPANY_ADMIN; own company rollups) | web/analytics | analytics | PLANNED |
| F-121 | Branch operational analytics dashboard (branch roles; own branch operational rollups) | web/analytics | analytics | PLANNED |
| F-121a | Financial analytics separated from operational analytics: operational roles (Kitchen, Delivery, Staff) denied financial metrics | api/analytics | isolation | PLANNED |
| F-122 | `Plan` + `Subscription` CRUD (SUPER_ADMIN assigns to company) | api/billing | analytics | PLANNED |
| F-123 | Usage enforcement: check BEFORE action (order-create cap, message-send cap) | api/billing | analytics | PLANNED |
| F-124 | Plan limit exceeded → 402 `PLAN_LIMIT_EXCEEDED` + upgrade prompt | api/billing | analytics | PLANNED |
| F-125 | Company suspension on plan non-compliance (`subscription-check` queue) | api/worker | analytics | PLANNED |
| F-126 | Company usage self-view (COMPANY_ADMIN) | web/analytics | analytics | PLANNED |
| F-127 | CANCELLED order `order_created` UsageEvent NOT credited back (D-15) | api/orders | analytics | PLANNED |

---

## Hardening + Production Readiness (P9)

| # | Feature | Module | Suite | Status |
|---|---|---|---|---|
| F-128 | Full threat-model sweep (§20 checklist) | security | — | PLANNED |
| F-129 | Dependency audit + Dependabot / Renovate | infra/ci | — | PLANNED |
| F-130 | Static analysis (Semgrep or equivalent) in CI | infra/ci | — | PLANNED |
| F-131 | Playwright e2e: one-branch company full flow | tests/e2e | e2e | PLANNED |
| F-132 | Playwright e2e: multi-branch company + Company B isolation probes | tests/e2e | e2e | PLANNED |
| F-133 | RTL/LTR layout pass: Arabic (ar-EG default) + English (en-US), dynamic dir="rtl", logical CSS properties (Q-REQ-6) | web | — | PLANNED |
| F-134 | Accessibility audit (WCAG 2.1 AA) for all boards + dashboards | web | — | PLANNED |
| F-135 | Backup + restore drill: tested against production-schema snapshot | infra | — | PLANNED |
| F-136 | Docker production build + Dokploy deployment docs | infra | — | PLANNED |
| F-137 | Migration runbook + rollback plan | infra | — | PLANNED |
| F-138 | Alert rules: queue depth, webhook latency, AI latency+errors, GUC-missing rate | infra/observability | — | PLANNED |
| F-139 | Security headers: HSTS, CSP, X-Frame-Options, no-sniff | api/web | — | PLANNED |
