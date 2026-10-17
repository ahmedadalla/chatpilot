# AUTHORIZATION_MODEL.md — Roles, Permissions, Auth Architecture, Isolation

**Status:** Reconciled pre-implementation specification
**Related:** `DATA_OWNERSHIP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `SPECIFICATION_REVIEW_REPORT.md`

This document specifies **(a)** every role and its authorized scope, **(b)** the
permission matrix, **(c)** the authentication architecture (tokens, sessions,
cookies, revocation, MFA, bootstrap, invitations), **(d)** the trusted
authorization context and scope invariants, and **(e)** the **PostgreSQL
Row-Level Security** strategy and how it is wired with **Prisma**.

> First principle: **authorization is decided server-side only**, from identity
> loaded/verified server-side. The frontend never decides scope. Client-supplied
> `companyId`/`branchId`/`role` claims are **never** trusted. Default deny.

---

## 1. Roles and their authorized scope

| Role | Scope | Company | Branch | Core mandate |
|---|---|---|---|---|
| `SUPER_ADMIN` | PLATFORM | none | none | Operate the SaaS: create/suspend companies, plans, platform config, platform analytics, audited cross-company reads. **Not** a day-to-day restaurant operator. |
| `COMPANY_ADMIN` | COMPANY | exactly one | all branches of that company | Run the whole business: menus, branches, orders (read/direct), staff, WhatsApp/AI config, company analytics. |
| `BRANCH_MANAGER` | BRANCH | own company | one assigned branch | Run that branch: order board, kitchen & delivery ops (if permitted), branch staff, branch settings & analytics. |
| `KITCHEN` | BRANCH | own company | one assigned branch | Kitchen board: accept pending, start prep, and mark ready branch orders. |
| `DELIVERY` | BRANCH | own company | one assigned branch | Delivery board: start/complete branch deliveries, report delivery failure from OUT_FOR_DELIVERY. No pending-order rejection. |
| `STAFF` | BRANCH | own company | one assigned branch | General branch operator: accept or reject/cancel pending orders only; no preparation/ready transitions; no settings/staff/finance. |

**Scope invariants (must always hold, re-verified server-side per request):**

```
SUPER_ADMIN     => platform, companyId=null, branchId=null
COMPANY_ADMIN   => companyId=<X>, branchId=null  (sees all branches of X)
BRANCH_*        => companyId=<X>, branchId=<B> where B belongs to X
```

- Permission ≠ scope. **Permission** says *which action*; **scope** says *which
  rows*. **Both are evaluated** for every protected operation.
- A user has **exactly one role** in v1 (single `User.role`, engineering default D-16).
  Multi-role is a deliberate extension (role-assignment table), not the initial design.
- No self-elevation: a company/branch user **cannot** assign or grant a broader
  scope/role to themselves. The last COMPANY_ADMIN of a company cannot be
  removed/deactivated by another company-level action (keeps at least one admin).

---

## 2. Permission matrix

Capabilities (name format `domain:action[:qualifier]`). "Y" = allowed. Scope is
**always** additionally enforced (never broader than the role's scope, see §4).

| Capability | SUPER_ADMIN | COMPANY_ADMIN | BRANCH_MANAGER | KITCHEN | DELIVERY | STAFF |
|---|---|---|---|---|---|---|
| `company:create` | Y | — | — | — | — | — |
| `company:suspend/activate` | Y | — | — | — | — | — |
| `company:settings:write` | — | Y | — | — | — | — |
| `company:read` (own) | Y(audited) | Y(own) | Y(own) | Y(own) | Y(own) | Y(own) |
| `company:metrics:read` (platform cross-tenant) | Y | — | — | — | — | — |
| `company:subscribe:assign` | Y | — | — | — | — | — |
| `company:usage:read` | Y | Y(own) | — | — | — | — |
| `branch:create/deactivate` | — | Y | — | — | — | — |
| `branch:settings:write` (operational settings, own branch) | — | Y | Y(own branch) | — | — | — |
| `branch:edit` (operational settings, own branch) | — | Y | Y(own branch) | — | — | — |
| `branch:metrics:read` | — | Y(own co.) | Y(own branch) | — | — | — |
| `menu:write` | — | Y | — | — | — | — |
| `menu:read` | — | Y | Y | Y | Y | Y |
| `menu:branch-availability:write` | — | Y | Y(own branch) | — | — | — |
| `orders:read` | — | Y(own co.) | Y(own branch) | Y(own branch) | Y(ready+delivery, own branch) | Y(own branch) |
| `orders:create` (manual / via AI tool) | — | Y(own co.) | Y(own branch) | — | — | Y(own branch) |
| `orders:transition:accept` | — | — | — | Y | — | Y |
| `orders:transition:start-prep` (ACCEPTED→IN_PREPARATION) | — | — | — | Y | — | — |
| `orders:transition:ready` (IN_PREPARATION→READY_FOR_DELIVERY) | — | — | — | Y | — | — |
| `orders:transition:start-delivery` (READY→OUT_FOR_DELIVERY) | — | — | — | — | Y | — |
| `orders:transition:complete` (OUT→DELIVERED) | — | — | — | — | Y | — |
| `orders:transition:cancel` | — | Y(own co.) ¹ | Y(own branch) ¹ | Y(PENDING only) | — | Y(PENDING only) |
| `orders:transition:fail-delivery` (OUT_FOR_DELIVERY only) | — | — | Y(own branch) ¹ | — | Y | — |
| `orders:audit:read` (status history) | — | Y(own co.) | Y(own branch) | Y(own branch) | Y(own branch) | Y(own branch) |
| `kitchen:board` | — | — | Y | Y | — | Y |
| `delivery:board` | — | — | Y | — | Y | — |
| `staff:invite` (company-level roles) | — | Y | — | — | — | — |
| `staff:invite` (branch-level roles in own branch) | — | Y | Y | — | — | — |
| `staff:deactivate` (within own scope) | — | Y(own co.) | Y(own branch staff) | — | — | — |
| `staff:self:read` (own account) | Y | Y | Y | Y | Y | Y |
| `whatsapp:config:write` | — | Y | — | — | — | — |
| `whatsapp:conversations:read` | Y(audited) | Y(own) | Y(own branch) | — | — | — |
| `kb:write/read` | — | Y | Y(read) | — | — | — |
| `ai:config:write` | — | Y | — | — | — | — |
| `ai:config:read` | Y(audited, no key) | Y(own) | — | — | — | — |
| `analytics:platform` | Y | — | — | — | — | — |
| `analytics:company` | — | Y | — | — | — | — |
| `analytics:operational:read` (volume, throughput, prep/delivery durations, queue depth) | Y | Y(own co.) | Y(own branch) | Y(own branch) | Y(own branch) | Y(own branch) |
| `analytics:financial:read` (GMV, revenue, avg order value, financial loss) | Y(platform) | Y(own co.) | Y(own branch) | — | — | — |
| `audit:read` (platform log) | Y | — | — | — | — | — |
| `audit:read` (own company log) | — | Y | — | — | — | — |
| `files:upload` (menu/kb) | — | Y | — | — | — | — |

¹ **Management boundary:** `COMPANY_ADMIN` and `BRANCH_MANAGER` do not perform kitchen
or delivery operational transitions. Company Admin can cancel non-terminal orders in
their company; Branch Manager can cancel non-terminal orders in their branch and
report `FAILED_DELIVERY` from `OUT_FOR_DELIVERY`. `STAFF` can accept or cancel only
`PENDING` (no preparation or ready transitions). `DELIVERY` has no access to cancel
or reject pending orders. No role can transition a terminal order.

**Operational transition summary (canonical; provenance is tracked in `DECISIONS.md`):**
```
PENDING → ACCEPTED             KITCHEN, STAFF
ACCEPTED → IN_PREPARATION      KITCHEN
IN_PREPARATION → READY         KITCHEN
READY → OUT_FOR_DELIVERY       DELIVERY
OUT_FOR_DELIVERY → DELIVERED   DELIVERY
PENDING → CANCELLED             KITCHEN, STAFF (reason required)
PENDING/ACCEPTED/IN_PREPARATION/READY → CANCELLED  BRANCH_MANAGER, COMPANY_ADMIN (reason required)
OUT_FOR_DELIVERY → FAILED_DELIVERY  DELIVERY, BRANCH_MANAGER (reason required)
```

**Notes:**
- Reads are role-gated **and** scope-gated: e.g. `DELIVERY orders:read` = ready +
  delivery statuses **in their branch only**.
- `SUPER_ADMIN` cross-tenant read is **audited** every time and exposed through a
  dedicated, clearly-labelled "platform support" surface — it is never silently
  bundled with restaurant APIs.
- **Hiding a page/button is not authorization.** Hiding is UX only; every endpoint
  re-checks permission + scope.

### 2.1 Grantor allowlists (who may invite/assign which roles)

| Granting actor | Grantable roles |
|---|---|
| `SUPER_ADMIN` (platform path only) | Any, including `SUPER_ADMIN` |
| `COMPANY_ADMIN` | `COMPANY_ADMIN`, `BRANCH_MANAGER`, `KITCHEN`, `DELIVERY`, `STAFF` — **never** `SUPER_ADMIN` |
| `BRANCH_MANAGER` | `KITCHEN`, `DELIVERY`, `STAFF` — **own branch only** |
| Anyone else | — (forbidden) |

A DB CHECK constraint enforces the backstop: `role = 'SUPER_ADMIN'` on a new/updated
`User` or `Invitation` row requires the calling session's `app.scope = 'platform'`
(checked inside the INSERT/UPDATE trigger owned by `chatpilot_migrator`).

### 2.2 Last-admin rule

Before any deactivation or role-change that would remove the **last** active
`COMPANY_ADMIN` from a company, the service layer checks whether the post-change
state leaves at least one active admin. Applies to:
- Deactivating another admin: check remaining active admins ≥ 1 after.
- **Self-deactivation** (admin deactivates their own account): same check — last
  admin cannot self-remove without an active replacement.
- Role downgrade of the last admin: same rule applies.

If the check fails → **409 Conflict** with error code `LAST_ADMIN_CONSTRAINT`. The
path for recovery is: a `SUPER_ADMIN` assigns a new company admin (platform path),
or the remaining admin reinstates another. Self-deactivation of the last admin must
route to Super Admin re-provision.

---

## 3. Authentication architecture

### 3.1 Credential & secret handling
- **Password hashing: Argon2id** (memory ~64MB, time ~3, parallelism ~1 — tune to
  budget ~300–500ms; store in `User.passwordHash`).
- No plaintext passwords/tokens/secrets stored or logged anywhere (incl. audit `meta`).
- API keys (AI, WhatsApp) **envelope-encrypted** at rest: per-record data key
  encrypted by a KMS/master key held **outside the DB** (env/secret store). Only the
  decryption service (server) can read them; never to client/logs/tools.

### 3.2 Tokens & sessions (recommended model)
- **Access token:** stateless **JWT**, short-lived (**15 min**). Claims:
  `{ sub: userId, sid: sessionId, jti, ver: permissionsVersion, exp, iat }`.
  JWT carries **only** `{sub, sid, jti, ver}` — **no role, no companyId, no branchId,
  no scope claims in the JWT itself**. All authorization state is loaded exclusively
  from a fresh DB row on every request (§4 AuthContext-from-DB rule).
- **Session:** server-side `AuthSession` row (the durable, revocable unit). Grouped
  by `userId`; `revokedAt` for logout/revocation; `expiresAt` absolute cap.
- **Refresh token:** opaque random (≥128-bit), **stored as SHA-256 hash** in
  `RefreshToken` (never raw), tied to a session, **rotated on every use** via
  compare-and-swap (row-locked — `SELECT … FOR UPDATE` on the hash row). Reuse
  detection: if a rotated token is replayed, **revoke the whole session and write
  AuditLog** — this is the theft signal. **The refresh endpoint re-runs full auth
  checks** (user isActive + company status = ACTIVE) before issuing new tokens — a
  suspended company cannot re-mint tokens indefinitely by looping refresh.
- **Login flow:** verify password → create/attach `AuthSession` → issue access JWT (no scope claims) + refresh token (refresh in **HttpOnly Secure cookie**) → return.
- **Authz freshness (no stale scope):** the guard checks, per request:
  1. JWT signature + `exp`.
  2. Session exists, not revoked, not expired (indexed PK read on `sid`).
  3. **`User.isActive` + `Company.status = ACTIVE` + `Branch.isActive`** — all three
     checked fresh (cheap indexed point reads). A single `false`/`SUSPENDED` → 401.
  4. **Stale-token guard (PermissionVersionService):** JWT `ver` must equal current
     `User.permissionsVersion`. Any role/scope/status mutation calls
     `PermissionVersionService.bump(userId)` — the **single chokepoint** — which
     increments the version atomically. A still-unexpired JWT with a stale `ver` is
     rejected immediately → client must re-auth/refresh. This is a unit-testable
     invariant: every such mutation bumps.
- **Logout:** revoke the session (all its refresh hashes) → subsequent refresh
  fails → re-login.
- **Revocation on sensitive change:** password change, role/scope change, or
  company suspension revokes/invalidates sessions for affected users.

### 3.3 Cookie & CSRF (for the SPA)
- **Recommended: Next.js BFF pattern.** The browser talks to the **same-origin**
  Next app (route handlers / rewrites → NestJS). Session cookies (access/refresh)
  are `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to the app domain. The Nest API
  is called server-to-server with a short-lived bearer token held in the BFF.
  Same-origin ⇒ standard CSRF story; still add a custom header / origin check on
  state-changing routes as defense-in-depth.
- If the API is **directly browser-reachable** (separate origin), the refresh
  cookie must be `SameSite=None; Secure` (HTTPS required) **and** CSRF must be
  mitigated explicitly (double-submit token / origin+header). **Prefer the BFF.**
- **Socket.IO** handshake: use the session (cookie for same-origin) **or** a
  one-time short-lived handshake token obtained from an authenticated endpoint.
  Room membership is decided **server-side from the AuthContext** (§5), never from
  the client's requested room.

### 3.4 Rate limiting, enumeration, recovery
- **Rate-limit** login, password reset, and refresh (per IP + per account), with
  lockout/backoff on repeated failure.
- **Prevent user enumeration:** identical 401 for "no such user" and "bad
  password"; generic messages; no account-existence side channel on login/reset.
- **Password reset:** single-use, short-TTL token, stored hashed, one active per
  user, revokes prior; on use → force password change + revoke sessions.
- **Account:** activation email (optional verify), deactivation, company
  suspension blocks login/usage.

### 3.5 Super Admin: bootstrap, protection & RLS-safe auth lifecycle
- **First Super Admin:** created by a controlled, documented **migrator/seed** step
  (env-driven, idempotent, non-interactive in prod). **Never** hardcoded in code.
  Development-only credentials live only in a committed **dev** seed explicitly
  guarded (fails fast / refused in `PRODUCTION=true`).
- **Protect Super Admin:** Required **TOTP MFA** in v1 with 10 single-use cryptographically
  secure recovery codes generated at enrollment (stored hashed); SMS and WebAuthn are
  deferred (engineering default D-19). Privileged operations are audited, session revocation
  is supported, and no self-elevation by non-platform users is permitted. Super Admin is
  operationally isolated from restaurant operations.
- **RLS-safe authentication & session lifecycle:**
  - `SUPER_ADMIN` has `companyId = null` and `branchId = null`.
  - Self-auth lifecycle operations (login session creation, refresh token rotation, logout, and self-session revocation) execute under a dedicated `'user'` scope via `app_set_scope('user', NULL, NULL, userId)`.
  - In `'user'` scope, `app.user_id = userId` is set, allowing reads/writes to `AuthSession` and `RefreshToken` via their owner-scoped policies (`user_id = app_user_id()`), while `app_is_platform()` strictly evaluates to `FALSE`. Ordinary auth endpoints never receive platform-wide access to tenant data.
  - Administrative session revocation (e.g. revoking all sessions of a compromised user, or revoking all sessions of a company on suspension) is an audited administrative function routed exclusively through `PlatformSupportService` using `app_set_platform_scope(p_audit_reason)`, recording an `AuditLog` row in the same transaction. Ordinary auth code cannot invoke this.

### 3.6 Company onboarding lifecycle (transactional where appropriate)
```
SUPER_ADMIN create Company (status INITIATED)   [transaction + audit]
   └─ create first COMPANY_ADMIN Invitation (status PENDING, expiring)
         └─ admin accepts → sets password (Argon2id) → account active
              └─ Company → ACTIVE. Company admin self-serves rest.
```
- Company + initial admin invitation are created transactionally (atomic).
- A COMPANY_ADMIN may invite/create more **company-level** users (incl. admins).
- Branch-level staff are invited/created by COMPANY_ADMIN (any branch) or
  BRANCH_MANAGER (own branch only).

---

## 4. Trusted authorization context (per request)

Built server-side after successful auth; passed into the service layer. **Never**
built from client input:

```
AuthContext {
  userId, role, scope: PLATFORM | COMPANY | BRANCH,
  companyId?, branchId?,                       // from DB-verified identity
  capabilities: Set<Capability>,               // from role (see matrix)
  visibleCompanyIds: [companyId] | ALL,        // platform => ALL
  visibleBranchIds:  [branchId]  | ALL,        // company admin => all of co.; branch role => [branchId]
  authVersion (ver), requestCorrelationId
}
```

**Every protected operation** evaluates, in order and **fails closed**:
```
1. authenticated?                -> 401 otherwise
2. has capability(user, action)? -> 403 otherwise
3. scope check: resource owned by
   a visible company/branch?      -> 404 (not 403) for cross-tenant lookups
4. resource state business rule  -> 409/422 otherwise
5. transactional write
```
- **Default deny:** any unverified authentication/scope/permission/state ⇒ reject.
- **404 vs 403 policy:** for tenant-protected lookups, return **404** when the
  resource is outside the caller's scope (do not confirm existence of another
  tenant's resource). Return **403** for in-scope resources where permission is
  denied. Return **401** only for unauthenticated. Consistent and non-leaking.

### Scope resolution used by the data layer
- **PLATFORM** (`visibleCompanyIds=ALL`): allowed *only* for SUPER_ADMIN, and any
  cross-tenant tenant-data read is **audited** and routed via the platform-support
  service path.
- **COMPANY** (company admin): `visibleCompanyIds=[companyId]`,
  `visibleBranchIds = all branch ids of companyId`.
- **BRANCH** (branch role): `visibleCompanyIds=[companyId]`, `visibleBranchIds=[branchId]`.

---

## 5. PostgreSQL Row-Level Security strategy (defense-in-depth)

RLS is a **backstop**, not the primary control. **Primary control = the central
tenant-aware data-access layer** (every repository query is built with
`AuthContext.visibleCompanyIds/visibleBranchIds`). RLS independently re-enforces the
same bound so that any single un-scoped query still cannot leak across tenants.

### 5.1 Why RLS (and why it is not sufficient alone)
- Pro: a second, independently-configured guard at the engine; catches a forgotten
  `.where(scope)` in one query.
- Con (with Prisma): Prisma opens pooled connections as **one runtime role** and
  does not set per-tenant RLS variables by itself. So wiring is **explicit and
  owned by us** (§5.4). RLS must be configured *with* correct GUC handling or it
  either never activates (useless) or blocks legitimate access (outage).

### 5.2 Database roles (least privilege)
- `chatpilot_migrator` — owns tables, runs migrations/DDL. May (optionally) hold
  BYPASSRLS **for migrations only**. **Never used at runtime.**
- `chatpilot_app` — **runtime role.** **NO BYPASSRLS, NOT a superuser, NOT table
  owner.** Holds only the grants it needs (SELECT/INSERT/UPDATE/DELETE per table +
  `EXECUTE` on the GUC helper functions). All runtime Prisma connections use it.
  Because it is not the owner and tables are `FORCE ROW LEVEL SECURITY`, RLS applies
  to it even if an app bug reaches a table.
- `chatpilot_ro` (optional) — a readonly analytics role (SELECT only) for the
  read path if we separate read replicas later.

**Runtime role never has BYPASSRLS** (spec requirement) ⇒ platform-wide access is
**not** a superuser bypass; it is an explicit, audited, GUC-driven policy (§5.5).

### 5.3 Tables that get RLS policies
RLS is enabled **and forced** on every table below. The migration must contain a
policy (or an explicitly documented owner-only policy) for each table; omission is
a migration-test failure:

- Identity and tenant roots: `Company`, `Branch`, `User`, `Invitation`,
  `AuthSession`, `RefreshToken`, `PasswordResetToken`.
- Company/branch data: `CompanySettings`, `MenuCategory`, `MenuItem`,
  `MenuItemAvailability`, `File`, `Order`, `OrderItem`, `OrderStatusHistory`,
  `Customer`, `Conversation`, `Message`, `WhatsAppConnection`,
  `WhatsAppEventDedup`, `KnowledgeBaseDocument`, `KnowledgeChunk`,
  `AiConfiguration`, `Subscription`, `UsageEvent`, `Notification`,
  `IdempotencyKey`, `PendingOrder`, and `OrderTransitionToken`.
- Audit and rollups: `AuditLog`, `CompanyDailyStats`, and `BranchDailyStats`
  use company/branch policies. `PlatformDailyStats` is writable only by the
  analytics role and readable only through the platform analytics service.

`Plan` and other non-tenant reference tables are not tenant data and may omit RLS
only when their grants are read-only or their policy is structurally public.
Every exception must be listed in the migration coverage test.

### 5.4 GUC scheme + Prisma wiring (the critical part)

Set **transaction-local** GUCs, reset automatically on end of transaction — this
directly solves the spec's "never depend on pooled connections preserving a tenant
context."

Helper functions (owned by migrator, granted to app):
```sql
CREATE OR REPLACE FUNCTION app_company_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION app_branch_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.branch_id', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION app_scope() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.scope', true), '')
$$;
CREATE OR REPLACE FUNCTION app_is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.scope', true), ''), '') = 'platform'
$$;
```

**All tenant-scoped Prisma work runs through a `ScopedPrisma` service** that, on
every transaction, first sets the GUCs **locally** via the migrator-owned
`app_set_scope()` function, then runs the operation on that same transaction client.

`app_set_scope()` is a SQL function owned by `chatpilot_migrator` and granted
`EXECUTE` to `chatpilot_app`. It uses `set_config(key, val, true)` (LOCAL) and
accepts only typed parameters — **never string interpolation**:

```sql
-- Migration-owned function (never called with $executeRawUnsafe + interpolation)
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
-- Platform scope is intentionally not accepted by the ordinary setter. A
-- separate PlatformSupportService-only function must validate an active
-- SUPER_ADMIN and set platform scope inside the audited transaction.
```

Called from the wrapper via **parameterized** `$executeRaw` (never `$executeRawUnsafe`
with template literals — that is the banned pattern caught by CI lint gate #3):

```typescript
// ScopedPrisma wrapper — the ONLY legal DB entry point
// Invariant check: ScopedPrisma validates that ctx cannot pair an authenticated
// user with another company's or branch's scope before executing GUC setup.
if (ctx.userId && ctx.role !== 'SUPER_ADMIN') {
  if (ctx.userCompanyId !== ctx.companyId) {
    throw new InvalidTenantContextException('User company mismatch with requested scope');
  }
  if (ctx.branchId && ctx.userBranchId && ctx.userBranchId !== ctx.branchId) {
    throw new InvalidTenantContextException('User branch mismatch with requested scope');
  }
}

await prisma.$transaction(async (tx) => {
  // Parameterized call — no string interpolation, no injection surface
  await tx.$executeRaw`SELECT app_set_scope(${scope}, ${companyId}::uuid, ${branchId}::uuid, ${userId}::uuid)`;
  // All repository calls happen on this same `tx` (passed down as the DB client)
});
```

- `set_config(key, val, true)` = **LOCAL** (transaction-scoped): auto-cleared on
  COMMIT/ROLLBACK ⇒ **a pooled connection reverts to no-tenant-context** and the
  next request must set its own. **Connection-pool reuse cannot leak a tenant
  context**, and **rollback clears it** (both required by the spec).
- Read operations also go through this wrapper (a read transaction) so they get the
  same GUCs; batching related ops in one transaction is the scale optimization.
- If the app forgets to set a GUC: `app_company_id()` returns null, `app_is_platform()`
  returns false ⇒ policies deny **everything** ⇒ **fail closed** (0 rows / write denied,
  never 500).

**`service` scope** (for workers/webhooks — non-interactive jobs):
- GUCs derived **only from a DB-verified binding** (e.g. Cloud API webhook or Baileys
  socket event in `whatsapp-worker`: pre-auth read of `WhatsAppConnection` by the receiving
  `businessConnectionId` → resolves company_id/branch_id; BullMQ job payload carries only IDs,
  never tenant secrets or scope strings).
- Scope string is `'service'`; policies treat it identically to `'branch'` for data
  access (same company_id + branch_id filtering).
- **No non-interactive job may use `scope='platform'`** — CI lint gate #2 catches
  any such call outside `PlatformSupportService`. Test asserts this path is unreachable.

**`preauth` scope** (for login/invite-accept/password-reset and webhook connection
resolution before tenant context exists):
- SELECT-only and narrow: login may fetch a user by normalized email; invitation
  acceptance may fetch a pending invitation by a hash; password reset may fetch a
  token by hash; webhook ingress may fetch one active connection by provider and
  receiving business connection ID. No list/read-by-tenant endpoint is permitted.
- Preauth policies expose only the minimum columns needed for those lookups and
  never expose password hashes, encrypted credentials, or unrelated tenant rows.
- After identity or connection verification succeeds, the same transaction switches
  to the verified user/company/branch service context to write or process data.
  No writes happen under `preauth`.

The migration must implement dedicated lookup policies or security-definer lookup
functions for these four keys; a generic “preauth can select the table” policy is
forbidden. For example, the connection lookup function accepts only
`provider` + `business_connection_id`, returns the minimum routing fields, and
never returns encrypted credentials. The login/invitation/reset functions return
only the minimum verification fields. Each function is `SECURITY DEFINER`, fixes
`search_path`, is granted only to `chatpilot_app`, and is covered by negative
tests for list queries and writes.

> CI lint gate: a raw `prisma.<model>` call outside `ScopedPrismaModule` fails the
> build (ESLint custom rule). `$executeRawUnsafe` with a template literal in any GUC
> path also fails the build (AST regex rule).

### 5.5 Policy templates (owner = migrator; applied with `FORCE ROW LEVEL SECURITY`)

**Company-scoped table** (e.g. `menu_items`, `knowledge_base_documents` when
company-level, `company_settings`, `subscription`, `ai_configuration`, `customer`…):
```sql
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_co ON menu_items
  FOR ALL TO chatpilot_app
  USING ( app_is_platform() OR company_id = app_company_id() )
  WITH CHECK ( app_is_platform() OR company_id = app_company_id() );
```
(Company admin and branch roles both carry the same `company_id`, so company-scoped
reads/writes are uniformly allowed within the company; the permission matrix still
gates *which* roles may write.)

**Branch-scoped table** (e.g. `orders`, `order_items`(via order), `order_status_history`
(via order), `conversation`(via), `branch`(its own row), `notification`):
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_branch ON orders
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR ( company_id = app_company_id()
         AND ( app_scope() = 'company'          -- company admin: any branch of co.
               OR branch_id = app_branch_id() )  -- branch role: own branch
         )
  )
  WITH CHECK (
    app_is_platform()
    OR (company_id = app_company_id()
        AND (app_scope() = 'company' OR branch_id = app_branch_id()))
  );
```
- A **branch role** (scope `branch`) sets company_id + branch_id ⇒ sees only its
  branch's orders.
- A **company admin** (scope `company`) sets company_id ⇒ sees **all** branches
  of the company.
- **Platform** (scope `platform`) ⇒ all rows — but only reachable after the guard
  has verified SUPER_ADMIN, and every cross-tenant read is **audited**.

**Owner-only tables** (`refresh_token`, `auth_session`, `password_reset_token`):
```sql
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY refresh_token_owner_only ON "RefreshToken"
  FOR ALL TO chatpilot_app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());
```
(`app.user_id` GUC set to the authenticated user per transaction alongside scope.)

**System columns on multi-role tables (`User`):**
```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_scope ON "User"
  FOR ALL TO chatpilot_app
  USING (
  app_is_platform()
  OR (app_scope() = 'company' AND company_id = app_company_id())
  OR (app_scope() IN ('branch', 'service') AND branch_id = app_branch_id())
  OR (id = app_user_id())
  )
  WITH CHECK (
    app_is_platform()
    OR (app_scope() = 'company' AND company_id = app_company_id())
    OR (app_scope() IN ('branch', 'service') AND branch_id = app_branch_id())
  );
```
(Platform admin sees all; a company user can manage users within their company; a
branch role only within their branch. Deactivation/role change flows also respect
the "last admin" rule at the service layer.)

**WITH CHECK** mirrors `USING` on the same policies for INSERT/UPDATE so a row can
never be *written* outside the current scope (ownership checks on INSERT/UPDATE).

### 5.6 Platform-level access — explicit & audited (never a bypass)
- There is **no** generic bypass controlled by request body / header / untrusted JWT
  field. Platform access is only set by the app *after* server-side verification the
  actor is a SUPER_ADMIN; it is a **server-set GUC**, and any tenant-data read under
  `scope='platform'` is recorded in `AuditLog` (actor, target company, action).
- The cross-tenant "support view" is a distinct, clearly-labelled code path, so it
  is reviewable and auditable.

### 5.7 RLS testing requirements (real PostgreSQL only — no in-memory)
Prove with actual PostgreSQL (see `IMPLEMENTATION_PLAN` phase acceptance):
1. With `scope=branch` (co X, branch B): reads/writes on other branches of X and any
   other company ⇒ **0 rows / denied**.
2. With `scope=company` (co X): all branches of X visible; another company denied.
3. With **no GUC set** (missing tenant context): **0 rows returned, writes denied**
   (fail closed).
4. INSERT/UPDATE with an out-of-scope `companyId`/`branchId` ⇒ **violated by WITH
   CHECK**, not just filtered out on read.
5. After a transaction rollback, a subsequent same-connection transaction **cannot**
   see the rolled-back tenant context (LOCAL GUC cleared).
6. A **pooled** connection reused across two different tenants: second request's
   queries only see the second tenant's rows.
7. The runtime role `chatpilot_app` **cannot** bypass RLS (no BYPASSRLS); a
   `SELECT` with `app_scope` unset returns nothing.
8. Platform-scope audit rows are written for cross-tenant reads.

These run in the integration suite against a real Postgres (docker service), using
raw `set_config` to simulate each context, then asserting row counts.

### 5.8 Additional RLS shapes

**Company self-policy** — the `Company` table's `id` IS the tenant root; the
policy reads `id = app_company_id()`, **not** `company_id = app_company_id()`:
```sql
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_self ON "Company"
  FOR ALL TO chatpilot_app
  USING ( app_is_platform() OR id = app_company_id() )
  WITH CHECK ( app_is_platform() OR id = app_company_id() );
```

**Nullable-branch tables** — e.g. `KnowledgeBaseDocument` which may be company-wide
(`branch_id IS NULL`) or branch-specific (`branch_id = <B>`):
```sql
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY kb_doc_scope ON knowledge_base_documents
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR (
      company_id = app_company_id()
      AND (
        app_scope() = 'company'          -- company admin: all docs (any branch)
        OR branch_id IS NULL             -- branch role: sees company-wide docs
        OR branch_id = app_branch_id()  -- branch role: sees own-branch docs
      )
    )
  )
  WITH CHECK (
    app_is_platform()
    OR (
      company_id = app_company_id()
      AND (app_scope() = 'company' OR branch_id IS NULL OR branch_id = app_branch_id())
    )
  );
```
`KnowledgeChunk` inherits tenant scope transitively via its parent document's
`company_id`/`branch_id` (JOIN-based policy or denormalized columns — Phase 7 detail).

**AuditLog** — platform rows visible to SUPER_ADMIN only; company rows visible to
the company:
```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_scope ON audit_log
  FOR ALL TO chatpilot_app
  USING (
    app_is_platform()
    OR (company_id = app_company_id() AND company_id IS NOT NULL)
  )
  WITH CHECK (
    app_is_platform()
    OR (company_id = app_company_id() AND company_id IS NOT NULL)
  );
-- INSERT only: platform-scoped writes (actor=SUPER_ADMIN) come via the
-- PlatformSupportService and explicitly set scope='platform'.
```

**User table — nullable-branch admin rows:**
Branch roles have a non-null `branch_id`. Company-level users (COMPANY_ADMIN,
BRANCH_MANAGER assigned company-wide) have `branch_id = NULL`. A branch-scope user
(`app_scope='branch'`) must be **blind to** null-branch admin rows of their company
(they can read their own row via the `owner_only` or `user_scope` policy's `app.user_id`
clause, not via the company-wide scan). The `user_scope` policy already handles this:
```sql
-- Branch-scope session: app_scope()='branch', app_branch_id()=<B>
-- Policy "branch" arm: branch_id = app_branch_id() → never matches null-branch rows.
-- Result: company admins' rows are invisible to branch staff.  ✓
```

**WITH CHECK for INSERT/UPDATE** mirrors `USING` on all policies so an app bug that
tries to write a row outside the current scope is **rejected at the DB level**, not
silently filtered on read.

---

## 5.9 File capability → purpose mapping

File access is gated first by the calling user's **capability** (from the permission
matrix) and then the file's **purpose tag** (set at upload time). The purpose tag
determines the allowed capability.

| Purpose tag | Required capability | Who can upload | Signed URL TTL |
|---|---|---|---|
| `menu-image` | `menu:read` | `menu:write` (COMPANY_ADMIN) | ≤ 5 min |
| `kb-document` | `kb:read` | `kb:write` (COMPANY_ADMIN) | ≤ 5 min |
| `receipt` | `orders:read` | — (system-generated) | ≤ 5 min |
| `avatar` | `staff:self:read` | Self only | ≤ 5 min |

Rules:
- Files live in a **private S3 bucket** (no public ACL). Access only via short-lived
  presigned `GET` URLs generated by the server.
- Signed URL generation checks the caller's capability against the file's purpose tag.
  Calling `GET /files/:id/url` with the wrong capability → 403.
- Upload validates magic bytes + declared MIME type + size cap (per purpose).
- Purpose tag is **server-assigned** at upload (client-provided MIME only as hint,
  never trusted as the purpose).

---

## 5.10 Socket.IO authorization contract

Socket.IO handshake is authenticated. Two handshake flows:
- **Type A (same-origin cookie):** BFF cookie containing the access JWT is forwarded;
  the Socket.IO server validates the JWT signature, expiry, and session freshness (§3.2
  step 1–3) on every new connection.
- **Type B (one-time token):** a short-lived (≤60 s), single-use handshake token issued
  by an authenticated REST endpoint (`POST /socket-tokens`); stored as SHA-256 hash,
  consumed atomically; connection established using this token; subsequent messages
  authenticated from the resulting session.

**Server-decided rooms — invariant:**
The server calls `socket.join(room)` **only from the AuthContext** derived from the
authenticated identity. `socket.join(...)` calls originating from the **client** are
intercepted, logged (with actor), and dropped — they do not join the room.

Room naming convention:
- `branch:{branchId}` — joined by BRANCH_MANAGER, KITCHEN, DELIVERY, STAFF of that branch; also COMPANY_ADMIN (all branches of company) and SUPER_ADMIN (platform support only)
- `company:{companyId}` — joined by COMPANY_ADMIN for company-level events
- `order:{orderId}` — not used (order events are emitted to the branch room)

**Re-validation cadence:**
- The `ver` claim in the authenticated JWT is re-checked on a cadence ≤ the access-token
  TTL (15 min). If `User.permissionsVersion` has advanced beyond JWT `ver` → connection
  forcibly disconnected with code `4003` (stale permissions).
- **Session revocation:** the server subscribes to Redis `session:revoked` channel.
  On publish (logout, password-change, suspension), the server looks up all open
  Socket.IO connections for `sid` and **immediately disconnects** them.

**Event payloads carry minimal PII:** `{orderId, orderNumber, status, branchId}`.
Detailed data fetched via REST after the push event.

---

## 5.11 Delivery-portal status-filter invariant

The delivery-role order list (`orders:read` for DELIVERY) **must** filter:
```
status IN ('READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY')
```
This is an **application-layer obligation** — RLS cannot express status filters.
It is a tested invariant (order-workflow suite): a delivery-role session never
receives orders with other statuses in its list response. BRANCH_MANAGER board
shows all non-terminal statuses for operational oversight.

---

## 5.12 Webhook verification, dedup, and quarantine

All inbound webhook handling (WhatsApp gateway, future providers) follows this flow:

1. **Signature verification (first line of defense):** every inbound Cloud API
   webhook request is verified against the provider/app or per-connection secret
   (envelope-encrypted in DB, loaded server-side; never in logs). The setup
   verification challenge is handled separately from signed event delivery.
   Request without valid signature → **401** (logged, not quarantined).

2. **Business-connection mapping:** before touching any tenant data, the ingress
   resolves `(provider, businessConnectionId)` → `(companyId, branchId)` from
   `WhatsAppConnection`. The customer's sender number is never used for routing.
   If no mapping found → **ack 200** (provider sees success, retries suppressed) +
   write to **quarantine log** + `AuditLog` (actor=system, action=UNMAPPED_NUMBER).
   A worker processes the quarantine queue for operator review.

3. **Freshness window:** watermark/timestamp on the webhook payload must be within
   **5 minutes** of server time (configurable per provider). Stale delivery → ack 200
   (provider doesn't need to retry) + `AuditLog` (action=STALE_WEBHOOK, for debugging).

4. **Idempotency / dedup:** `WhatsAppEventDedup` unique key = `(provider, providerMessageId)`.
   Two-phase: the ingress worker does `INSERT … ON CONFLICT DO NOTHING` to claim the
   event; if 0 rows inserted → already processed → ack 200 silently (duplicate delivery).

5. **Ack within two seconds:** the webhook endpoint enqueues to `webhook-ingest`
   BullMQ and returns **200** with a minimal payload immediately. All actual
   processing is async. The queue's deterministic idempotency key prevents double
   processing if the enqueue itself is retried.

6. **Two-phase outbound:** outbound messages start as `QUEUED` rows; updated to
   `ACCEPTED` (+ `providerWamid`) or `FAILED` after the provider call. The `dedup-sweeper`
   re-queues stale `QUEUED` rows (no provider response within threshold).

7. **Unknown/unexpected events:** any event that passes verification but has no handler
   → ack 200 + warn log (no quarantine needed — not a threat signal).

## 6. Fail-closed & default-deny summary

- Unauthenticated → 401. No token / invalid / expired → 401.
- Authenticated but no capability → 403.
- In-scope resource, wrong permission tier → 403.
- Cross-tenant lookup → **404** (non-leaking).
- Scope/ownership/permission/state unprovable → **deny** (never allow on ambiguity).
- Every route (incl. admin, webhooks, health) is audited; unauthenticated admin →
  401; webhooks use signature verification + idempotency (§5.12).
- Missing GUC / no-scope connection → 0 rows from every tenant table (fail closed,
  not 500). Startup RLS self-test in `/readyz` catches wrong DSN at deploy.
- Socket.IO client-requested room join → dropped + logged (never joined).
- File request with wrong capability for purpose tag → 403.

---

## 7. Architecture sign-off items (tracked in `DECISIONS.md`)

- **D-16:** Single role per user in v1 (`User.role`); multi-role deferred post-v1.
- **D-19:** Required TOTP MFA for Super Admin in v1 with 10 single-use recovery codes; SMS and WebAuthn deferred.
- Any change to the permission matrix produces a corresponding test (spec rule:
  decisions affecting security get tests that enforce them).

The order rules above are specification requirements/defaults, not historical
product-owner confirmations. Any later change must update `DECISIONS.md` and the
order-workflow tests together.