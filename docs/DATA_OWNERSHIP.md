# DATA_OWNERSHIP.md — Resource Ownership Matrix & Data Model

**Owner of this document:** Principal Architect
**Status:** Reconciled pre-implementation specification (see `DECISIONS.md` for provenance and open assumptions)
**Related:** `AUTHORIZATION_MODEL.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `SPECIFICATION_REVIEW_REPORT.md`

This document defines the PostgreSQL data model, the **ownership scope of every
entity**, the identifiers and value rules, and the ownership matrix that every
API, worker, socket, and analytics query must respect. It is the single source of
truth for "who owns what and at which scope."

> Canonical hierarchy: **Platform → Company → Branch → Users & Operations.**
> Every tenant-protected row carries the tenant keys named below. No query may
> return, write, or aggregate tenant-protected rows without applying the matching
> scope (see `AUTHORIZATION_MODEL.md` §Tenant-aware access).

---

## 1. Global conventions

### 1.1 Identifiers
- **UUID** storage for all public/foreign keys, generated server-side with a
  standards-compliant UUIDv7 library before persistence. PostgreSQL 17 does not
  provide a portable built-in `uuidv7()` function in the selected baseline, so
  migrations must not use `@default(dbgenerated("uuidv7"))`; the application
  supplies the value and the database enforces `uuid` types and relationships.
  UUIDv7 ordering is an index-locality optimization, never an authorization
  credential.
- No row's authorization may depend on whether a caller can guess an ID. Scope is
  always enforced (application layer + RLS).
- Public API uses the canonical `id`. Human-readable identifiers (slugs, codes,
  order numbers) are secondary and unique only within their stated boundary.

### 1.2 Money
- All monetary columns are `Decimal(12, 2)` (`DECIMAL`), **never** float.
- Money is **authoritative from the database** and computed server-side. The AI
  never supplies or computes a price or total — it calls a tool that reads them.
- Each order stores `currency` and item-level `unit_price_snapshot` + `line_total`
  so a later menu price change never mutates historical orders.

### 1.3 Timestamps & audit
- Every row has `createdAt` and `updatedAt` (timestamptz). System-generated for
  `createdAt`; `updatedAt` set by ORM.
- Rows that represent an audit/event (orders status history, audit log, usage
  events, messages) are **append-only** — no UPDATE/DELETE at the app layer.
- `updatedAt` is not trusted as a business timestamp for order events; the
  `OrderStatusHistory` / `AuditLog` rows carry the authoritative `occurredAt`.

### 1.4 Soft vs hard delete
- **Menu items, menu categories, branches, knowledge documents:** soft-delete via
  `archivedAt`/`isArchived`. Reasons: preserve order item references and history.
- **Orders, order items, order status history, messages, audit logs, usage events:**
  **hard-delete never** (immutable). Cancellation is a status, not a delete.
- **Users:** deactivated, never deleted (audit + password reset + FK integrity).
  A `deactivatedAt` marks disabled; FKs keep the row.
- **Companies:** suspended, never deleted (data retained for reactivation and
  legal/audit). Deletion is a platform admin operation that is *archival*, not the
  normal path.

### 1.5 Reference scope summary (quick map)
| Scope | Tenant keys on row | RLS | Who sees |
|---|---|---|---|
| Platform | `—` (or `tenantMode = PLATFORM`) | platform rows | Super Admin (audited) |
| Company | `companyId` | yes | platform, company users (own company), branch rows of own branch |
| Branch | `companyId` + `branchId` | yes | platform, company admin (any branch), that branch's staff |
| Private (user) | `userId` | yes (owner-only) | owner + platform (audited) |

---

## 2. Entity list & ownership matrix

Legend — **Scope** = the narrowest scope that can *write*; reads follow the
`AUTHORIZATION_MODEL.md` permissions matrix. **RLS** = whether a Row-Level Security
policy is applied as a backstop (defense-in-depth; the primary enforcement is the
central tenant-aware data-access layer). `—` = no RLS (structurally safe / user-owned).

### 2.1 Platform / identity

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Constraint notes |
|---|---|---|---|---|---|
| `User` | `companyId`? + `branchId`? (nullable) | `BRANCH`/`COMPANY`/`PLATFORM` (role-gated) | role-gated, self always | **yes** | See §3 role/identity rules. One role per user in v1 (D-16). |
| `AuthSession` | `userId` | `USER` | owner + platform (audited) | **yes (owner-only)** | Groups a login; `revokedAt` for logout/revocation. |
| `RefreshToken` | `userId`, `sessionId` | `USER` | platform (audited) | **yes (owner-only)** | Store **hash** only (`sha256(token)`), never raw. `expiresAt`, `revokedAt`. Rotating. |
| `PasswordResetToken` | `userId` | `SELF`/`PLATFORM` | `—` | **yes (owner-only)** | Single-use, expiring, store hash, one active per user. |
| `Invitation` | `companyId` + `branchId`? | `COMPANY` (invite admin)/`BRANCH` (staff) | company users of own company | **yes** | `role`, `status: PENDING/ACCEPTED/REVOKED`, `expiresAt`. Unique per (company, email, role, branchId?). |
| `SuperAdminCredential` / platform bootstrap | `—` | `PLATFORM` | platform | yes (platform-visible rows) | See §8 provisioning. |

**Identity invariants (enforced by CHECK constraints):**
- `role = SUPER_ADMIN` ⇒ `companyId IS NULL AND branchId IS NULL AND platformCapable = true`.
- `role = COMPANY_ADMIN` ⇒ `companyId NOT NULL AND branchId IS NULL`.
- `role IN (BRANCH_MANAGER, KITCHEN, DELIVERY, STAFF)` ⇒ `companyId NOT NULL AND branchId NOT NULL`.
- A user belongs to **at most one company** in v1 (single `companyId` column — no
  cross-company membership table by design).
- For branch roles, the composite FK `(companyId, branchId)` references
  `Branch(companyId, id)`; therefore the selected branch must belong to the
  user's company. Company Admin and Super Admin rows have `branchId IS NULL`.
  The domain service checks the same invariant and the database composite FK is
  the backstop.

### 2.2 Company / tenant root

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `Company` | `—` (root) | `PLATFORM` | platform; company users see their **own** company row | **yes** | `status: INITIATED/ACTIVE/SUSPENDED`, unique `slug`. |
| `CompanySettings` | `companyId` | `COMPANY` | company users (own) | **yes** | Profile, `countryCode` (default `'EG'`), `defaultCurrency` (default `'EGP'`), `defaultTimezone` (default `'Africa/Cairo'`), `defaultLocale` (default `'ar-EG'`), `defaultCallingCode` (default `'+20'`), shared defaults (Q-REQ-6). 1:1 with company. Configurable per company; no hardcoded schema assumptions. |

`Company` is the **tenant root row**. RLS on `Company` lets a company user
`SELECT` only their own row and a branch user their own company row — this is the
row that the RLS GUC `app.company_id` binds to.

### 2.3 Branch

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `Branch` | `companyId` | `COMPANY` (create/deactivate) / `COMPANY` or `BRANCH` (operational settings) | company admin (own company); branch users (own branch) | **yes** | unique `(companyId, code)`; `isActive`, `timezone` (IANA), operating hours, delivery fee/minimum, WhatsApp connection ref. Company Admin may update branch timezone with audit logging (D-18); past order timestamps and sequenceDay values remain immutable. Branch Managers cannot create or deactivate branches. |

**Invariants:**
- `Branch.companyId` FK → `Company.id` (a branch is in exactly one company).
- The database must expose `UNIQUE (companyId, id)` on `Branch`; every child carrying
  both keys references that composite key. This prevents a valid branch UUID from
  being paired with another company's UUID.
- Branches are **never reassigned across companies** by normal operations. Any
  transfer is an explicit, separately-audited platform operation (out of v1 scope).
- `Order`, `Conversation`, `WhatsAppConnection` carrying a `branchId` must share the
  branch's `companyId` (composite consistency, DB-enforced backstop).

### 2.4 Menu (company-wide, shared)

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `MenuCategory` | `companyId` | `COMPANY` | company users (incl. branch staff read) | **yes** | `slug` unique per company, `sortOrder`, `isArchived`. |
| `MenuItem` | `companyId` (via category) | `COMPANY` | company users (incl. branch staff read) | **yes** | `Decimal` price, `currency`, image refs, `isAvailable`, `sortOrder`, `isArchived`. |
| `MenuItemAvailability` | `companyId` + `branchId` | `COMPANY` or `BRANCH` (override) | company users (own) | **yes** | **Branch-specific override only** — `isAvailable` (and optionally price) for one item in one branch. Unique `(companyId, branchId, menuItemId)`. No duplicate catalog. |
| `File` | `companyId` | role-gated to owner-scope write | owner-scope read | **yes** | S3 key, `contentType`, `sizeBytes`, `purpose` (menu_image, kb_document, other). Private by default; access via signed URL with an access check. |

The catalog is **company-wide**. Branch availability is expressed **only** through
`MenuItemAvailability` overrides — never by copying items into a per-branch table.
Available price/availability for a (item, branch) = branch override if present,
else item default. Resolved by the service layer; the DB stores both.

### 2.5 Orders (branch-scoped, immutable)

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `Order` | `companyId` + `branchId` | `BRANCH` ops (+ AI via scoped tool) | role-gated per matrix | **yes** | `orderNumber` unique `(branchId, sequenceDay)` (human-readable per branch/day), `status`, `currency`, `subtotal`, `deliveryFee`, `discount`?, `total`, `customerRef`, `address`, `notes`, `paymentMethod`, `source` (whatsapp/manual), `idempotencyKey` unique (sha256 of `companyId|conversationId|cartDigest`). |
| `OrderItem` | via `Order` | same as order | same | **yes** | `menuItemId` (ref + nullable if archived), `name_snapshot`, `unit_price_snapshot` (Decimal), `quantity`, `line_total` (Decimal), `notes`. |
| `OrderStatusHistory` | via `Order` | `BRANCH` ops/workflow svc | same | **yes** | append-only: `fromStatus`, `toStatus`, `actorUserId`, `actorRole`, `reason?`, `occurredAt`, `meta` (jsonb). One row per transition. |
| `OrderTransitionToken` | via `Order` | workflow svc | `—` | yes | Idempotency guard for transitions. Stores `(orderId, action, actorUserId, transitionToken, result)`. A uniqueness constraint including `actorUserId` does not collide across different actors; single winner under concurrency is guaranteed by conditional status `UPDATE orders SET status = ... WHERE id = ... AND status = ... RETURNING ...` (competing actor receives 409 Conflict when 0 rows match). Same-actor replay returns the stored result with 200 OK without re-executing side effects (deterministic job IDs `order:{orderId}:transition:{to}` ensure post-commit jobs are idempotent). |
| `BranchDayCounter` | `branchId` + `sequenceDay` | workflow svc (atomic upsert) | `—` | yes | `(branchId, sequenceDay, seq)` — atomic `INSERT … ON CONFLICT DO UPDATE SET seq = seq + 1 RETURNING seq` inside create-order transaction; gaps allowed, no collisions. `sequenceDay` is PostgreSQL `date` / Prisma `DateTime @db.Date`, computed in branch IANA timezone. |
| `PendingOrder` | `companyId` + `branchId` | AI (via tool) | AI service (conversation context) | **yes** | Staging table for the AI cart-confirmation flow. `conversationId`, `lines` (jsonb), `prices_snapshot` (jsonb — server-computed Decimal totals), `confirmToken` (7-char random, stored hash), `expiresAt` (now()+10 min), `status` (OPEN/CONSUMED/EXPIRED). `CONSUMED` by `create_order` tool; TTL sweep sets `EXPIRED`. Not the same as a delivered `Order`. |

**Order invariants:**
- `(companyId, branchId)` consistent with branch (DB backstop).
- `PENDING` auto-cancelled after a configurable timeout (scheduled job).
- Transitions enforced by `OrderWorkflowService` (see `ARCHITECTURE.md` §Orders) —
  **server-side, transactional, concurrency-safe**. Row lock / conditional update.
- `total = subtotal - discount + deliveryFee` validated server-side on create and
  on every transition that can change fees; stored in Decimal.
- Duplicate webhook / duplicate confirmation **cannot** create or double-transition
  an order (idempotency key + status guard).

### 2.6 Customers

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `Customer` | `companyId` (company-level) | `COMPANY`/`BRANCH` (from order) | company users (own) — **branch users see customers of their branch** (via their orders/conversations) | **yes** | `name`, `phone` (normalized), `email?`, `preferredLocale?`. **Phone is not globally unique** — unique `(companyId, phone)`. |

**Ownership default:** Customer is a **company-level** record (a
customer is a company concept). A branch user only sees customers *through* their
branch's orders/conversations (scoped joins), never the company-wide customer list.
`(companyId, phone)` unique — a customer can order from multiple branches.

### 2.7 Conversations & messages (branch-scoped)

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `Conversation` | `companyId` + `branchId` | `BRANCH`/AI | company users (own); branch staff (own branch) | **yes** | `customerPhone`, `whatsappWamid?`, `branchId`, `status`, `orderRef?`. Unique per (connection, providerWaId) — **not** a global phone uniqueness. |
| `Message` | via `Conversation` | `BRANCH`/AI | same | **yes** | `direction: IN/OUT`, `providerWAMid`, `providerType`, `text`, `status` (`QUEUED/ACCEPTED/FAILED` for outbound two-phase, `received/delivered/read` for inbound). Two-phase outbound: message row created with `QUEUED` before provider call; updated to `ACCEPTED` (+ provider wamid) or `FAILED` after. `processedAt`, `idempotencyRef`. Append-only; no hard deletes. |
| `WhatsAppEventDedup` | via connection | webhook worker | `—` | yes | `provider`, `providerMessageId` — **unique key is `(provider, providerMessageId)` ONLY**. `providerWatermark` is a plain ordering/tie-break column, NOT part of the uniqueness constraint. Replays on same `providerMessageId` → no-op (insert-on-conflict-do-nothing). |

**Invariants:** A conversation maps to exactly one branch (via its WhatsApp number's
branch). Messages are append-only. Customer PII (phone, address) is tenant-scoped —
never cross-company.

### 2.8 WhatsApp connection (branch-scoped)

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `WhatsAppConnection` | `companyId` + `branchId`? | `COMPANY` (number owned by company, optionally routed to branch) | company users (own) | **yes** | `provider` (`CLOUD_API`, `COEXISTENCE`, `REGULAR_QR_PAIRING`), receiving `businessConnectionId`, phone number, status (`PAIRING_QR_READY`, `CONNECTED`, `DISCONNECTED`, `REQUIRES_REAUTH`), `riskAcknowledgedAt` (mandatory customer acknowledgement for QR pairing), envelope-encrypted credentials/session tokens, webhook secret reference, optional branch route. Multiple connections per company are supported across any adapter (D-17). Baileys multi-device sessions run in isolated `whatsapp-worker` container (D-21). **Unique per (provider, businessConnectionId)** and, when present, `(provider, phoneNumber)`; the customer's sender number is never a tenant key. |

The **connection identifier → (company, branch)** mapping used for inbound routing lives in
this table. A connection without `branchId` automatically uses the company's single active
branch, or prompts the customer for explicit branch selection when multiple active branches
exist (DECISIONS Q-REQ-5). The selected branch is persisted on `Conversation.branchId`,
validated to be active (`Branch.isActive = true`) and owned by the connection's company
(`Branch.companyId = Connection.companyId`). No order can be created while branch resolution
is incomplete. **Never** cross-company: a webhook or event must resolve to exactly one
company/branch or be rejected/quarantined. Credentials and session tokens are envelope-encrypted;
key material never in DB (see §Security).

### 2.9 Knowledge base (company-scoped, optional branch)

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `KnowledgeBaseDocument` | `companyId` + `branchId`? (nullable) | `COMPANY` | company users (own) | **yes** | `title`, `fileRef` (→ File), `status` (pending/processing/ready/failed), `extractedText`, `meta`, `error?`. |
| `KnowledgeChunk` | via doc | `COMPANY` (ingestion) | `—` (internal) | **yes** | `content`, `positions`, `embedding vector(dim)` (pgvector), `metadata`. Scoped by parent doc's company/branch. **Never retrieved across companies.** |

`KnowledgeChunk.embedding` uses **pgvector** (no separate vector DB in v1).
The `vector(dim)` column and the **HNSW index are owned by raw SQL migrations** — do
not depend on Prisma's preview `vector` type, which is unstable. The migration also
sets `ef_search` for PG17 HNSW index-aware filtered queries.
Retrieval is tenant-scoped: query always filters `company_id` (+ branch where set)
**before** the ANN step. Delete/reprocess cascades chunks atomically with the document.

### 2.10 AI configuration (company-scoped)

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `AiConfiguration` | `companyId` | `COMPANY` | company users (own) — **never to worker/AI as raw key** | **yes** | `providerId`, `modelId`, `baseUrl?`, `encryptedApiKey` (envelope), `systemInstructions` (company), `usageCaps` (jsonb: tokens/day, msg/day), `costTrackingEnabled`. |

Provider adapters hold the **only** knowledge of provider request/response shapes.
The raw API key is **never** returned to the API client, frontend, logs, or AI tool
results. A **platform default** `AiConfiguration` (scope PLATFORM) is used when a
company has none.

### 2.11 Subscription, usage & analytics rollups

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `Plan` | `—` (platform) | `PLATFORM` | platform | yes | `name`, `code`, `limits` (orders/month, messages/month, branches, ai models), `features` (jsonb). |
| `Subscription` | `companyId` | `PLATFORM` (assign) | company admin sees **own** status/usage (read) | **yes** | `planId`, `status` (trial/active/suspended/expired), `renewAt`, `usageCounters` (jsonb) or via UsageEvent. |
| `UsageEvent` | `companyId` | service (auto) | `—`/platform | **yes** | append-only: `metric` (order_created/message/ai_token/kb_doc), `amount`, `occurredAt`, `branchId?`, `ref`. Drives counters + caps. **A CANCELLED order's `order_created` UsageEvent is NOT credited back — the attempt is consumed (D-15).** `type=CREDIT` events reserved for future manual adjustments. |
| `PlanLimitStatus` (derived/cache) | `companyId` | service | platform/company (own) | **yes** | optional cached counters; real counters authoritative from UsageEvent aggregates. |
| `PlatformDailyStats` | `—` (platform) | `chatpilot_analytics` role (worker) | platform only | yes (platform) | Rollup per calendar day and currency. Columns: `day Date`, `currency`, `totalCompanies`, `activeCompanies`, `totalBranches`, `totalOrders`, `deliveredOrders`, `cancelledOrders`, `failedDeliveryOrders`, `gmvTotal DECIMAL(16,2)`, `saasActiveCompanies`. **GMV columns structurally separate from SaaS-revenue columns and unlike currencies are never summed.** |
| `CompanyDailyStats` | `companyId` | `chatpilot_analytics` role | company admin (own), platform | yes | PK `(companyId, day)`. Columns: `totalOrders`, `deliveredOrders`, `cancelledOrders`, `failedDeliveryOrders`, `gmvSubtotal DECIMAL(16,2)`, `gmvDelivery DECIMAL(16,2)`, `gmvTotal DECIMAL(16,2)`, `avgOrderValue DECIMAL(12,2)`, `currency`, `totalMessages`, `aiTokensUsed BIGINT`. |
| `BranchDailyStats` | `companyId` + `branchId` | `chatpilot_analytics` role | company admin (all branches), branch manager (own), platform | yes | PK `(branchId, day)`. Same order/GMV metrics as company but branch-scoped. |

**Analytics ownership:** rollup tables are written by the `analytics-aggregate`
worker connecting as the `chatpilot_analytics` DB role. That role may read only
approved aggregate source views (or tenant-bound job snapshots), may INSERT/UPDATE
the rollups, has no BYPASSRLS, and cannot read arbitrary tenant tables. Dashboards
query rollup tables at O(1); raw date-range drilldowns hit the `Order` table via
`ScopedPrisma` (scoped to the requesting user's company/branch).

### 2.12 Audit, notifications, idempotency

| Entity | Tenant key(s) | Scope (write) | Read | RLS | Notes |
|---|---|---|---|---|---|
| `AuditLog` | `companyId`? (nullable for platform) | service (auto) | platform; company (own company events, scoped) | **yes** | `actorUserId`, `actorRole`, `action`, `targetType`, `targetId`, `companyId?`, `meta` (safe jsonb — **no secrets/tokens/passwords**), `occurredAt`. Append-only. |
| `Notification` | `companyId` + `branchId`? | service | role-gated per target | **yes** | `channel` (socket/in-app/email?), `targetScope`, `payload`, `status`, `attempts`. Durable; retried via queue. |
| `IdempotencyKey` | `companyId`? | service | `—` | yes | Optional global request idempotency for mutations (whatsapp, order confirm). `key`, `scope`, `resultRef`, `expiresAt`. |

**Audit rules:** every security-sensitive operation (company create/status, branch
create/change, role/permission change, user activate/deactivate, password reset,
platform config change, cross-company admin access) writes an `AuditLog` row.
**Never** store plaintext passwords, refresh tokens, or API secrets in `meta`.

---

## 3. Role ↔ identity data rules (cross-ref `AUTHORIZATION_MODEL.md`)

| Role | companyId | branchId | What they own (write) | What they see (read) |
|---|---|---|---|---|
| SUPER_ADMIN | NULL | NULL | Platform resources (companies, plans, platform settings) | Platform + (audited) read into any company |
| COMPANY_ADMIN | set | NULL | Company-scoped + all-branch resources | Own company, all its branches |
| BRANCH_MANAGER | set | set | That branch's operational + permitted settings | Own branch, own-company read |
| KITCHEN | set | set | That branch's kitchen transitions (accept, start prep, mark ready) | That branch's orders/kitchen board |
| DELIVERY | set | set | That branch's delivery transitions (start, complete, fail); no pending rejection | That branch's ready/delivery board |
| STAFF | set | set | Accept or reject/cancel pending orders only (no prep/ready transitions) | That branch's order intake / kitchen board |

---

## 4. Referential-integrity & cross-scope consistency (DB backstops)

These are enforced **in the database** (not just app-layer) because a single
buggable line must not be able to create a cross-tenant row:

1. **Company→Branch→Child consistency:** Any table carrying both `companyId` and
   `branchId` enforces that the branch's company equals the row's company.
   Implementation options (pick one, document in `DECISIONS`):
   - (a) `BRANCH_ID` FK is enough if `companyId` is *derived*; OR
   - (b) store both, plus a **composite FK** `(companyId, branchId) REFERENCES
     Branch (companyId, id)` — requires a composite unique on `Branch(companyId,id)`.
   - (c) a `BEFORE INSERT/UPDATE` trigger that raises if mismatch.
   **Chosen (b):** composite FK `(companyId, branchId)` on all branch-scoped tables,
   backed by `UNIQUE (companyId, id)` on `Branch`. This makes a cross-company
   `branchId` fail at the DB regardless of app logic.
2. **Menu category→item** by FK; **item→availability** by `(item, branch)` unique.
3. **Order→items→history** by FK + cascade rules (history never deleted by app).
4. **RefreshToken → User, AuthSession** by FK; user deactivation soft-revokes.
5. **`ORDER` totals** not enforced by DB (Decimal arithmetic in service + a CHECK
   that `total >= 0`); authoritative computation is service-side, DB CHECK is a
   sanity backstop.

---

## 5. Indexing & scale notes

- Composite indexes matching the **scope prefix**: `(companyId)`,
  `(companyId, branchId)`, `(companyId, branchId, status)` for order boards,
  `(branchId, orderNumber, sequenceDay)` (unique), `(conversationRef)` unique,
  `(provider, providerMessageId)` unique for webhook dedup.
- `Order` board queries filter by `(companyId, branchId, status)` and
  `createdAt` → composite index `(companyId, branchId, status, createdAt desc)`.
- Analytics aggregate on `(companyId, createdAt)` and per-branch rollups; heavy
  rollups are pre-aggregated by the `analytics-aggregate` worker into summary rows
  (kept in scope) to keep dashboards O(1). See `ARCHITECTURE.md` §Analytics.
- pgvector HNSW index on `KnowledgeChunk.embedding` (`kb_hnsw`); retrieval uses
  **tenant-filtered ANN search** where queries filter `company_id` (+ `branch_id` where set)
  before/during the vector similarity step so cross-company scans are prevented without table partitioning.

---

## 6. Data model (Prisma sketch — reference only, not yet generated)

> This is the **shape** to validate against the ownership matrix; final field-level
> schema is produced in Implementation Phase 2. Names shown in Prisma style.

```prisma
// (Shape reference only — produced & migrated in Phase 2)
enum Role { SUPER_ADMIN COMPANY_ADMIN BRANCH_MANAGER KITCHEN DELIVERY STAFF }
enum CompanyStatus { INITIATED ACTIVE SUSPENDED }
enum OrderStatus { PENDING ACCEPTED IN_PREPARATION READY_FOR_DELIVERY OUT_FOR_DELIVERY DELIVERED CANCELLED FAILED_DELIVERY }
enum MessageDirection { IN OUT }
enum KbStatus { PENDING PROCESSING READY FAILED }

model User {
  id            String   @id @db.Uuid  // UUIDv7 value supplied by the application
  email         String   @unique
  name          String
  passwordHash  String   // Argon2id
  role          Role
  companyId     String?  @db.Uuid // platform users: null
  branchId      String?  @db.Uuid // branch roles: set
  platformCapable Boolean @default(false)
  isVerified    Boolean  @default(false)
  isActive      Boolean  @default(true)
  deactivatedAt DateTime?
  permissionsVersion Int  @default(1) // bumped on any role/scope/status change → stale-token guard
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company  Company?  @relation(fields: [companyId], references: [id])
  branch   Branch?   @relation(fields: [branchId],  references: [id])
  @@index([companyId])
  @@index([branchId])
  // CHECK enforced via raw migration: role/companyId/branchId invariants
}

model Branch {
  id        String  @id @db.Uuid
  companyId String @db.Uuid
  code      String  // unique per company
  name      String
  address   String?
  timezone  String  @default("UTC")
  isActive  Boolean @default(true)
  deliveryFee   Decimal? @db.Decimal(12,2)
  minOrder      Decimal? @db.Decimal(12,2)
  operatingHours Json?    // structured
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  company Company @relation(...)
  @@unique([companyId, code])
  @@unique([companyId, id])  // backstop for composite FK from children
  @@index([companyId])
}

model Order {
  id           String      @id @db.Uuid
  companyId    String      @db.Uuid
  branchId     String      @db.Uuid
  orderNumber  String      // human-readable, per branch/day
  sequenceDay  DateTime    @db.Date // calendar date in branch IANA timezone
  status       OrderStatus @default(PENDING)
  currency     String
  subtotal     Decimal     @db.Decimal(12,2)
  deliveryFee  Decimal     @default(0) @db.Decimal(12,2)
  discount     Decimal?    @db.Decimal(12,2)  // reserved; UI deferred
  total        Decimal     @db.Decimal(12,2)
  customerId   String?      @db.Uuid
  address      String?
  phone        String?
  notes        String?
  paymentMethod String    @default("PAY_ON_DELIVERY")
  source       String      // whatsapp | manual
  idempotencyKey String?   @unique   // duplicate webhook/confirmation guard
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  branch  Branch  @relation(...)
  customer Customer? @relation(...)
  @@unique([branchId, sequenceDay, orderNumber])
  // REMOVED: @@unique([companyId, branchId]) — redundant; composite FK on Branch already prevents cross-company branchId
  @@index([companyId, branchId, status, createdAt(sort: Desc)])
  @@index([companyId, createdAt])
}
// OrderItem, OrderStatusHistory, Conversation, Message, WhatsAppConnection,
// KnowledgeBaseDocument/Chunk, AiConfiguration, Plan/Subscription/UsageEvent,
// AuditLog, Notification, File — full definitions produced in Phase 2
// per the matrix above (same ownership scope + constraints).
```

---

## 7. Cross-reference index

- Tenant keys & scope invariants → `AUTHORIZATION_MODEL.md` §Tenant-aware access, §Roles & scope.
- How RLS is actually wired with Prisma (GUCs, roles, fail-closed) → `AUTHORIZATION_MODEL.md` §PostgreSQL RLS strategy.
- Order state machine & transitions → `ARCHITECTURE.md` §Order state machine.
- WhatsApp/AI conversation data flow → `ARCHITECTURE.md` §Integrations.
- Open assumptions (STAFF role, customer scope, numbering, etc.) → `DECISIONS.md` "Assumptions register".