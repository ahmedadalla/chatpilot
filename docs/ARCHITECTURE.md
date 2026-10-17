# ARCHITECTURE.md — ChatPilot System Architecture

**Status:** Canonical (supersedes pre-review drafts)
**Related:** `DATA_OWNERSHIP.md` (entities & ownership) · `AUTHORIZATION_MODEL.md` (roles, auth, RLS) · `IMPLEMENTATION_PLAN.md` (phase gates) · `DECISIONS.md` (decision provenance) · `SPECIFICATION_REVIEW_REPORT.md`

---

## 1. System overview

ChatPilot is a multi-tenant SaaS. Tenancy hierarchy is the spine of the whole system:

```
Platform (ChatPilot company)
└── Company (restaurant tenant) ──────────── tenant boundary (RLS "company")
    ├── Company-wide: menu catalog, company KB, AI config, settings, subscription
    └── Branch (physical location) ───────── operational boundary (RLS "branch")
        └── Operational: orders, kitchen, delivery, conversations, staff
```

**Core invariants (enforced at three layers: services → ScopedPrisma → PostgreSQL RLS):**
1. Scope always derives from server-verified identity (or, for non-interactive paths, from DB-verified bindings). Never from client input.
2. Every tenant-protected query/filter/mutation is scope-intersected: requested filter ∧ visible scope. No scope-widening by construction.
3. Fail closed: missing/ambiguous context ⇒ 0 rows / denied, never a crash and never a default-allow.
4. The model (AI) and the frontend are **untrusted inputs**, not enforcement points.

### Stack (pinned in PHASE 0, per `IMPLEMENTATION_PLAN.md`)
| Concern | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo; TypeScript strict |
| Frontend | Next.js (App Router) + React, Tailwind CSS, shadcn/ui, Lucide, TanStack Query + Table, Recharts, `next-intl` (Arabic `ar-EG` default + English `en-US`, full RTL) |
| Localization & Phone | `libphonenumber-js` (Egypt `+20` default, international supported), default country `EG`, default currency `EGP`, default timezone `Africa/Cairo` (configurable per company, never hardcoded, Q-REQ-6) |
| Backend | NestJS (Express adapter) modular monolith; `@nestjs/swagger`; class-validator/class-transformer DTOs |
| ORM / DB | Prisma ORM (current stable) over **PostgreSQL 17** (+ pgvector ≥ 0.8 for embeddings, owned by raw migrations) |
| Queue | Redis 7 + BullMQ (dedicated worker process, same codebase) |
| Realtime | Socket.IO (Nest gateway) |
| Files | S3-compatible object storage (private bucket, signed URLs) |
| AI | Provider adapters: Gemini, OpenAI, OpenRouter-compatible |
| WhatsApp | Provider adapters: **Meta Cloud API (official default)**, **WhatsApp Business Coexistence**, and **regular WhatsApp QR/device-pairing** via embedded Baileys in `apps/whatsapp-worker` (customer-selectable in wizard, not disabled by default, D-17, D-21) |
| Auth | Argon2id; stateless access JWT (15 min) + server-side sessions + rotating hashed refresh tokens; required TOTP MFA for Super Admins with secure recovery codes (D-19); single role per user in v1 (D-16) |
| Observability | pino (JSON), OpenTelemetry (traces/metrics), Prometheus endpoint |

---

## 2. Repository layout

```
chatpilot/
├── apps/
│   ├── web/            # Next.js (auth UI, role portals, BFF route handlers, i18n ar-EG/en-US)
│   ├── api/            # NestJS: HTTP + Socket.IO gateway + webhook endpoints
│   ├── worker/         # BullMQ consumer process (background jobs: analytics, notifications, purge)
│   └── whatsapp-worker/# Dedicated Baileys multi-device process (long-lived sockets isolated from API, D-21)
├── packages/
│   ├── contracts/      # OpenAPI-generated TS client + shared DTO/Zod schemas + capability/enum constants
│   ├── config/         # Shared TS/ESLint/Prettier config (incl. the security lint gates, §11)
│   └── ui/             # Shared UI primitives (tables, forms, status indicators, toasts, RTL support)
├── prisma/             # schema.prisma + migrations (incl. raw SQL migrations for RLS & vector)
├── tests/
│   ├── integration/    # API + DB integration (real Postgres via compose)
│   ├── security/       # isolation / RLS / injection red-team suites (real Postgres, mandatory)
│   └── e2e/            # Playwright (real browsers → real API → real Postgres)
├── compose/            # docker-compose (dev) + production compose snippets, Dockerfiles
└── docs/
```

**Module dependency rule:** controllers never touch Prisma; only the `ScopedPrisma` wrapper
module exposes the DB client. Modules expose services via DI; cross-module reads go through
the owning module's published service (e.g. `OrdersService.readScoped`) so business rules
live in one place. Frontend imports only `packages/contracts` (types) + `packages/ui`.

---

## 3. Request pipeline & trusted context

```
HTTP / WebSocket / Webhook
      │
      ▼
[1] Authentication
      API+BFF cookie (session sid) → access JWT (15 min, in-memory at BFF)
      Webhook: provider signature verification (per-connection secret)
      │
      ▼
[2] Context resolution  (see AUTHORIZATION_MODEL §4 for the exact read sequence)
      Interactive: AuthContext from fresh DB rows (user → company → branch),
                   session + status + permissionsVersion checks
      Webhook/Job: ServiceScope from DB-verified binding only (never from payload)
      │
      ▼
[3] Capability check      (domain:action, server-side, role table)
[4] Scope intersect       (requested ids/filters ∧ visibleCompanyIds/visibleBranchIds)
      │
      ▼
[5] Controller → Business Service (validation, state rules, transactions)
      │
      ▼
[6] ScopedPrisma          (transaction ⇒ app_set_scope(...) LOCAL GUCs ⇒ Prisma tx calls)
      │
      ▼
[7] PostgreSQL            (FK + composite-FK backstops, CHECKs, RLS fail-closed)
```

**`ScopedPrisma` contract (the single DB door):**

```ts
await scoped.run(ctx, async (tx) => {
  // ctx: { viewer }            → scope from interactive AuthContext (server-validated)
  // ctx: { serviceBinding }    → scope from DB-verified binding (webhooks, jobs)
  // ctx: { preauth: 'read' }   → SELECT-only, no tenant context (login lookup, webhook binding lookup)
  // Invariant: ScopedPrisma validates that an authenticated user cannot be paired with
  // another company's or branch's scope; any mismatched pairing aborts with InvalidTenantContextException.
  // every call in the closure goes through `tx`; GUCs are set locally and cleared on commit/rollback
});
```

- An ESLint gate **fails the build** for any direct `prismaClient.model` access outside the wrapper module, and for any string-interpolated SQL in scope paths (§11).
- Raw SQL (e.g. the pgvector search) is allowed only inside the wrapper via parameterized `$queryRaw`/`$executeRaw`.
- A **startup RLS self-test** runs at `/readyz` (and at worker boot): as the `chatpilot_app` role, open a transaction with no GUCs, run a scoped `SELECT count(*)` on a tenant table, assert 0 rows. If it fails, the instance reports *not ready* (catches a migrator-DSN-in-production mistake without leaking data). Non-fatal for the process, fatal for deployment.

**Interactive auth chain (details in `AUTHORIZATION_MODEL.md` §3):** cookie `cp_sid` (session) + `cp_rft` (rotating refresh, both HttpOnly/Secure/SameSite=Lax) → BFF routes validate the session against the DB (session row + user + company + branch + `permissionsVersion`) and forward to the internal API with a 15-minute access JWT cached in BFF memory (rebuilt on expiry via the internal refresh path). **The API host is not browser-reachable** — only reachable via the BFF on the same origin (dev) / internal network (prod). SameSite=Lax reduces cross-site exposure, but every state-changing BFF route still enforces an Origin/Referer check and a server-generated CSRF token; a one-time handshake token path exists for non-browser Socket clients.

**Cross-tenant lookup policy:** out-of-scope resource ⇒ **404** (do not confirm existence). In-scope but no permission ⇒ **403**. Unauthenticated ⇒ **401**. Business-state failures ⇒ **409/422** with typed error codes. Consistent error envelope `{code, message, details?, requestId}`; messages localized; error codes never change per locale.

---

## 4. Frontend architecture

### 4.1 Route groups by role (server-decided, capability-driven)

Navigation comes from the server (`GET /me` → capabilities + scope), and **every** page is a thin client over real endpoints. Route groups (App Router):

```
/login  /reset-password  /invitations/[token]  /mfa  /access-denied
/(platform)/admin/         SUPER_ADMIN        dashboard, companies, companies/[id],
                                              subscriptions, audit, platform-settings
/(company)/company/        COMPANY_ADMIN      dashboard, branches, branches/[id], orders,
                                              menu (categories/items), staff, whatsapp,
                                              knowledge, ai-settings, analytics,
                                              settings, usage
/(branch)/branch/          BRANCH_MANAGER+    dashboard, orders, kitchen, delivery,
                                              staff, analytics, settings
/kitchen/                  KITCHEN, STAFF     board, orders/[id], history
/delivery/                 DELIVERY           board, deliveries/[id], history
```

A Branch Manager sees `/(branch)` (their branch's operational portal **including**
kitchen and delivery boards, but without operational transition actions); KITCHEN
and STAFF get `/kitchen`, while DELIVERY gets `/delivery`. On `/kitchen`, KITCHEN
can view the board and execute accept, start-prep, and mark-ready transitions; STAFF
views the intake board to accept or reject/cancel PENDING orders only (prep/ready action
controls are disabled/hidden and backend API rejects them with 403). DELIVERY has no
delivery transition portal on `/kitchen` and no access to pending rejection.
There is no nested "admin portal" for operational staff.

### 4.2 Data & realtime
- TanStack Query for reads + mutations (`packages/contracts` typed client); invalidation keyed by resource + scope.
- TanStack Table for all data-heavy screens (orders, staff, companies): server-side pagination/sort/filter (filter params are scope-intersected server-side; the client can request *narrower*, never wider).
- Live boards subscribe to Socket.IO; board state = REST snapshot + socket deltas (authoritative state always re-fetchable; optimistic UI only where failure-reversible).
- Loading / empty / error / unauthorized states are part of each screen's definition of done; empty states state the next action ("No branches yet — create your first branch").

### 4.3 i18n & RTL (Egypt initial defaults + international expansion, Q-REQ-6)
- `next-intl`: Default locale is Arabic (`ar-EG`) with immediate switch to English (`en-US`). Message catalogs `ar.json` / `en.json`.
- `dir="rtl"` set dynamically on `<html>` for Arabic; logical CSS properties for all layouts; tables/forms/charts (Recharts: mirrored axes) designed RTL-first.
- Phone numbers: normalized and validated via `libphonenumber-js` with Egypt `+20` default while fully supporting international formats.
- Localization configurability: country (`EG`), currency (`EGP`), timezone (`Africa/Cairo`), and locale (`ar-EG`) are configurable per company via `CompanySettings`, avoiding hardcoded logic.
- Currencies: currency code is kept explicit in every transaction and UI component (EGP default); multi-currency segregation preserved without arbitrary aggregation.
- Dates & timezones: timestamps stored as UTC (`timestamptz`) and displayed according to the company's or branch's configured IANA timezone (`Africa/Cairo` default).
- AI & product localization: Arabic and English product names, descriptions, customer messages, and AI responses are supported natively. Both locales tested in Phase 9.

---

## 5. Order state machine (canonical)

### 5.1 States

```
PENDING
  ├─ ACCEPT ──────────────▶ ACCEPTED
  │                           │ START_PREPARATION
  │                           ▼
  │                        IN_PREPARATION
  │                           │ MARK_READY
  │                           ▼
  │                        READY_FOR_DELIVERY
  │                           │ START_DELIVERY
  │                           ▼
  │                        OUT_FOR_DELIVERY
  │                           ├─ MARK_DELIVERED (DELIVERY)
  │                           │      ▼
  │                           │   DELIVERED (terminal)
  │                           └─ REPORT_DELIVERY_FAILURE (DELIVERY, BRANCH_MANAGER; reason required)
  │                                  ▼
  │                           FAILED_DELIVERY (terminal)
  │
  └─ CANCEL (reason required, see 5.2) ▼ from PENDING / ACCEPTED / IN_PREPARATION / READY_FOR_DELIVERY
                                     CANCELLED  (terminal)
```

Statuses (DB enum, API values, UI, analytics, tests all use these exact names):
`PENDING, ACCEPTED, IN_PREPARATION, READY_FOR_DELIVERY, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, FAILED_DELIVERY`.
"Ready for delivery" (kitchen done) and "out for delivery" (driver en route) are **distinct states**; the canonical kitchen intake keeps Accept and Start-Preparation as separate transitions.

### 5.2 Transition table (canonical role permissions)

| Action | From → To | Allowed roles (own scope) | Reason code (stored) | Notes |
|---|---|---|---|---|
| `accept` | PENDING → ACCEPTED | KITCHEN, STAFF | — | Kitchen reviews order |
| `reject_pending` | PENDING → CANCELLED | KITCHEN, STAFF | `KITCHEN_REJECT` | Required reason text; DELIVERY has no access to pending rejection |
| `customer_cancel` | PENDING → CANCELLED | (AI confirmation path, customer) | `CUSTOMER` | Bot flow, §7; also exposed to COMPANY admin as manual action? **No** — customers only via bot; admin cancel below |
| `admin_cancel` | (PENDING, ACCEPTED, IN_PREPARATION, READY_FOR_DELIVERY) → CANCELLED | COMPANY_ADMIN (own company), BRANCH_MANAGER (own branch) | `ADMIN` | Required reason; not allowed from OUT_FOR_DELIVERY or any terminal state |
| `start_preparation` | ACCEPTED → IN_PREPARATION | KITCHEN | — | Kitchen only; STAFF has no prep rights |
| `mark_ready` | IN_PREPARATION → READY_FOR_DELIVERY | KITCHEN | — | Kitchen only; order becomes visible to delivery portal |
| `start_delivery` | READY_FOR_DELIVERY → OUT_FOR_DELIVERY | DELIVERY | — | Delivery portal only |
| `mark_delivered` | OUT_FOR_DELIVERY → DELIVERED | DELIVERY | — | **Never** via kitchen path, never via frontend-only state |
| `report_delivery_failure` | OUT_FOR_DELIVERY → FAILED_DELIVERY | DELIVERY, BRANCH_MANAGER | reason enum `CUSTOMER_UNREACHABLE / ADDRESS_PROBLEM / ACCIDENT / ITEM_MISSING / OTHER` + text | Distinct terminal; never from DELIVERED; replacement = a new order (optionally `replacesOrderId` ref) |
| `auto_timeout_cancel` | PENDING → CANCELLED | SYSTEM (sweeper) | `AUTO_TIMEOUT` | Default 15 min `branch.pendingOrderTimeoutMinutes` (5–120) |

**COMPANY_ADMIN performs no operational transitions** — they manage the business and can cancel with reason. BRANCH_MANAGER is the branch-level exception handler (admin_cancel + report_delivery_failure) but does not run kitchen/delivery moves. STAFF can accept and reject/cancel PENDING orders only (no preparation or ready transitions). KITCHEN executes preparation transitions (`start_preparation`, `mark_ready`). DELIVERY executes delivery moves (`start_delivery`, `mark_delivered`, `report_delivery_failure`) and has no pending-order rejection access. `DELIVERED`, `CANCELLED`, and `FAILED_DELIVERY` are terminal; no transition may originate from a terminal state.

### 5.3 Concurrency, idempotency, side effects (enforced in `OrderWorkflowService`)

Single transaction per transition with single-winner conditional update:
1. **Idempotency check / token lookup:** Query `order_transition_tokens` for `(order_id, action, actor_user_id)`. If an entry already exists for this actor, return the **stored result** immediately (200 OK, idempotent replay without re-triggering side effects).
2. **Conditional state transition (single winner guarantee):**
   `UPDATE orders SET status = $to, updated_at = NOW() WHERE id = $id AND status IN ($allowedFrom...) RETURNING *`
   Because a uniqueness constraint on `(order_id, action, actor_user_id)` does not collide across different actors, the **atomic conditional UPDATE is the sole mechanism guaranteeing a single winner under concurrency**.
   - If 0 rows updated: inspect current order status. If already transitioned (or in a conflicting state), abort and return **409 Conflict** (competing actor won the race, client must refresh board). If order does not exist or transition is invalid, return 422 Unprocessable Entity.
3. **Record transition claim:** `INSERT INTO order_transition_tokens (order_id, action, actor_user_id, status, result) VALUES (...)`.
4. **Append status history:** INSERT `order_status_history` (append-only, `occurredAt` server clock).
5. **COMMIT** — then enqueue side effects with **deterministic job ids** (`order:{orderId}:transition:{to}`) to BullMQ (notify socket event, notify WhatsApp customer, usage events, analytics delta) ⇒ post-commit crash + retry never double-notifies or duplicates side effects.

Duplicate creation: `orders.idempotency_key = sha256(companyId | conversationId | pendingOrderId or manualRef)` is `@unique`; a **23505/P2002 on that column returns the existing order with 200**, never a 500 (webhook retries, double-tapped confirmations).

Numbering (per branch, per day): `branch_day_counters (branch_id, day Date, seq int)` allocated inside the create transaction via `INSERT ... ON CONFLICT (branch_id, day) DO UPDATE SET seq = seq + 1 RETURNING seq`. `order_number` = `BR-<code>-<YYYYMMDD>-<seq zero-padded 4>` (display string; **never** an authorization or sole locator). `sequence_day` is a `Date` in the **branch's IANA timezone** (computed once at create). Gaps are acceptable (crashed allocate), collisions are impossible.

Totals: computed server-side in Decimal: `subtotal` (Σ snapshot line totals) + `delivery_fee` (branch setting, at order time) − `discount` (reserved, 0 in v1) = `total`. Item lines snapshot `name`, `unit_price` (authoritative menu record at order time), `quantity`, `line_total`. `total >= 0` CHECK. Minimum-order check at create (branch `minOrder` if set).

`order_status_history` / `orders` are immutable against deletes; cancellation is a status.

---

## 6. WhatsApp integration (multi-adapter: Cloud API, Coexistence, QR)

### 6.1 Provider abstraction & onboarding choices

```ts
interface WhatsAppProvider {
  initConnection(connId): PairingHandle | CloudApiSetup     // QR: {qrDataUri, pairingCode, statusEvents}; CloudAPI: token exchange
  onStatus(stream: StatusEvent)                             // session_up / session_down / reconnecting
  sendMessage(connId, toPhone, content: MessageContent): Promise<SendReceipt>
  events(): AsyncIterable<IncomingEvent>                    // normalized: message_in(type, text/media ref, externalId, timestamp, watermark?)
}
```

The system provides **three customer-selectable WhatsApp onboarding options** in the connection wizard (Q-REQ-4):
- **Standard Meta Cloud API adapter (official default):** Direct official Meta WhatsApp Business Platform onboarding via Meta Embedded Signup / System User token, verification challenge, business connection/phone-number binding, and `X-Hub-Signature-256` verification with timing-safe comparison. Hosted on Meta Cloud API infrastructure.
- **Official WhatsApp Business Coexistence adapter (eligible accounts):** Official Meta capability enabling eligible businesses to run the WhatsApp Business mobile app concurrently with Cloud API on the same phone number. Utilizes official Meta Cloud API webhook ingress and infrastructure, honoring Meta's coexistence eligibility, messaging limits, and synchronization semantics.
- **Regular WhatsApp QR/device-pairing adapter (enabled option, D-21):** Multi-device pairing protocol adapter using the chosen library (`@whiskeysockets/baileys`). **Available as a standard selectable option in the connection wizard and not disabled by default**, specifically serving the significant client segment that lacks a Meta Business Account.
  - *Engine & Process Isolation:* Embedded `@whiskeysockets/baileys` running in a dedicated `apps/whatsapp-worker` container/process. Long-lived multi-device WebSocket connections are isolated from the main NestJS API (`apps/api`) to ensure socket crashes or memory spikes cannot compromise REST or web services.
  - *Session Persistence & Encryption:* Session credentials (`creds.json`, app keys) are envelope-encrypted via `SecretsService` into PostgreSQL table `whatsapp_connections.encrypted_credentials`.
  - *Proof of Concept Gate (Phase 6):* Time-boxed POC verifies QR generation/refresh, session persistence, worker restart reconnection, disconnect detection, incoming/outgoing text and media handling, and duplicate-event protection. Evolution API is retained as an evaluated fallback if operational burden proves lower; WPPConnect is excluded due to heavy Chromium browser overhead (350–600 MB RAM per session).
  - *Distinction & Customer Acknowledgement:* The connection wizard clearly distinguishes unofficial device pairing from official Meta integrations, explicitly disclaiming Meta affiliation. An explicit customer acknowledgement checkbox is required before pairing begins, confirming acceptance of operational trade-offs: session disconnects, dependency on the physical phone remaining powered/connected, and provider terms risks.
  - *Messaging Compliance:* Designed strictly for authorized customer conversational ordering and support; no unsolicited or abusive bulk messaging.
- **Common pipeline invariants (all three adapters):** Credentials and session keys are envelope-encrypted at rest and never returned in API responses, logs, or AI context; all adapters normalize inbound events into the same event schema (`message_in`); messages flow into the common conversation/order pipeline; the receiving business connection→tenant mapping is the single source of routing; sending is always via the `whatsapp-out` queue (rate-limited, retried with backoff respecting provider limits, delivery-status receipts stored).

### 6.2 Mapping & hybrid branch routing (Q-REQ-5)

`whatsapp_connections(provider, business_connection_id, phone_number, company_id, branch_id NULL, status, encrypted_credentials, webhook_secret_ref)`.
- A receiving business connection maps to **exactly one company** globally (unique on `(provider, business_connection_id)` and, where supplied, `(provider, phone_number)`). Multiple connections per company are fully supported across all adapters (D-17). The customer's sender number is never used for tenant routing.
- **Confirmed hybrid branch-routing rule (Q-REQ-5):**
  1. *Direct branch mapping:* If the connection has an explicit `branch_id`, messages route directly to that branch.
  2. *Single active branch:* If `branch_id` is null and the company has exactly one active branch (`Branch.isActive = true`), the system automatically routes to and uses that branch.
  3. *Multiple active branches:* If `branch_id` is null and the company has more than one active branch, **customer branch selection is strictly required before ordering**. The bot prompts the customer to choose their branch (via interactive list message or branch code).
  4. *Persistence:* Once selected, the chosen branch is persisted for the conversation (`Conversation.branchId = selectedBranchId`).
  5. *Validation:* The system validates that the selected branch is active (`Branch.isActive = true`) and belongs to the company associated with the receiving connection (`Branch.companyId = Connection.companyId`).
  6. *Order gating:* **No order can be created while branch resolution is incomplete.** The `create_order` tool fails closed with a structured `BRANCH_NOT_RESOLVED` error if `Conversation.branchId` is null.
- Unknown/unmapped connection ⇒ `200` ack + quarantine queue + `AuditLog` (no error echo to the sender).

### 6.3 Webhook lifecycle (external Cloud API ingress)

```
POST /api/v1/webhooks/whatsapp
  1. Read connection by the receiving business connection identifier under a narrow preauth (SELECT-only, pre-tenant).
  2. Verify the provider challenge for setup or the per-connection/app HMAC over the raw body (timing-safe).
     Apply a 5-minute event freshness window; the customer's sender number is not a tenant key.
         → failure: 401 + rate-limit + audit (never reveal why).
  3. Resolve company/branch (6.2) → ServiceScope from the DB row.
  4. Dedup: INSERT whatsapp_event_dedup (key: provider+provider_message_id UNIQUE; watermark plain column)
     ON CONFLICT DO NOTHING → 0 rows: duplicate ⇒ ack 200 immediately (no reprocess).
     Watermark regression (new ≤ last accepted for connection) ⇒ ack + audit (replay/attack).
  5. Mark QUEUED → enqueue webhook-ingest job → ack 200 within 2 seconds.
  6. Worker (service scope): upsert conversation (connection+phone), persist Message IN (two-phase:
     message row committed with status RECEIVED before AI runs), enqueue ai-process.
  7. Outbound: ai-process enqueues whatsapp-out (idempotent job id = conversation+intent+turn) →
     provider → receipt Message OUT with delivery status.
```

Crash window (dedup committed, job lost): `dedup-sweeper` job marks `QUEUED` rows older than 2× expected job time → re-enqueue; processing is idempotent (dedup row + `order_transition_tokens` + `idempotency_key` make reprocessing a no-op or return the existing order). Delivery guarantee: **at-least-once delivery, exactly-once business effect.**

### 6.4 Invariants & limits

- Outbound sending respects provider rate limits (per-connection token bucket; backpressure returns the job to the queue with backoff, never drops).
- Conversation context is loaded **tenant-scoped only** (see §7.5) — a webhook for connection A can never load conversation/knowledge rows of company B (RLS + query filter; both required).
- A disconnected company or branch → inbound messages acknowledged, conversation stored (status `PARKED`), customer gets a templated "we are not taking orders right now" reply; no AI processing.
- Message content policy: text stored as-is (this is the tenant's own business data, stored encrypted at rest by Postgres TDE/deployment); media references stored as S3 keys (never raw base64 in PG).

---

## 7. AI providers & ordering engine

### 7.1 Provider abstraction

```ts
interface AiProvider {
  id: 'gemini' | 'openai' | 'openrouter'
  complete(req: { system: string; messages: Msg[]; tools?: ToolSpec[];
                  maxOutputTokens: number; temperature: number; timeoutMs: number })
      : Promise<{ text: string; toolCalls?: ToolCall[]; usage?: {in,out,total} }>
  embed?(texts: string[], model: string): Promise<number[][]>   // provider-selected embedding model; model choice is not an authorization decision
}
```

Provider SDKs live **only inside adapter modules** (`ai/providers/{gemini,openai,openrouter}`); business code depends on the interface, never provider shapes. Every call: request timeout (default 30 s, per-provider caps), bounded retry (transient only: 5xx/timeout, exponential backoff, max 2), usage capture in `usage_events(metric='ai_tokens')` when the provider reports usage (model-estimated usage is tagged `usageSource='estimate'` and **never** used for billing/caps — provider-reported only), per-company rate limits + daily token cap (from `ai_configuration.usage_caps`; exceeded → bot politely declines and notifies company admin; never silently burns through).

Config resolution order: company `AiConfiguration` → platform default; model/provider must be within the plan's allowed set (usage enforcement, §11).

### 7.2 Credential handling (envelope encryption)

- **Master key**: KMS (AWS KMS / Cloudflare / Vault, deployment-dependent) or an operator-held key file injected via secret store — **never in the DB, never in repo, never in logs**.
- Per-record **data key**: random 256-bit, AES-GCM-encrypts the API key/session credential; data key wrapped (encrypted) by master key; store `{wrappedDataKey, nonce, ciphertext, tag}`.
- Decryption only in `SecretsService` (api/worker), which masks the value in any logged context. Keys on `AiConfiguration`, `whatsapp_connections`, and WhatsApp session state all use the same `SecretsService`. Rotation: re-wrap campaign job; decrypt tolerates `cryptoVersion`.

### 7.3 Ordering engine (anti-injection contract — mandatory)

The bot is a **state machine the server owns**; the LLM is a language layer, not an authority.

Tools (the complete allowlist; strict parameter types, server-side re-validated):
```
list_categories(branchRef)        → category titles only
list_items(categoryRef, branchRef)→ [{itemId, name, description, price, currency}] (authoritative DB values)
get_item(itemId, branchRef)       → full item incl. availability for the branch (branch override applied)
build_cart(branchRef, lines:[{itemId, qty}])
                                   → server resolves **authoritative** prices/availability/branch min-order,
                                     computes subtotal + delivery fee + total in Decimal,
                                     returns {pendingCartId, linesWithPrices, total, ttlSec:600}
create_order(pendingCartId)       → allowed ONLY if the conversation's latest customer message contains
                                     this pendingCartId's confirmation token (menu button prefill, or the
                                     bot sends "Reply CONFIRM-<token7> to confirm" — server extracts/matches
                                     it from the raw inbound text; the LLM never reports "user confirmed")
cancel_pending_order(pendingCartId)→ drops the pending cart
search_knowledge(query, branchRef) → [{chunk, score}] (tenant-scoped vector search, company_id filter applied server-side before ANN; RLS backstop on knowledge_chunk)
```

**No tool may accept** `companyId`, `branchId`, `price`, `total`, or `discount` as a parameter — these are injected server-side from the verified conversation binding.

**Untrusted-input handling:** all inbound messages, KB retrieved chunks, and tool results are wrapped in `<data>...</data>` delimiters in the context; the system prompt explicitly states these blocks are data, not instructions. Per-turn tool-call cap (default 8) and token cap (configurable per company) prevent infinite loops. Output is checked for system-prompt–shaped strings before sending (last-resort; structural controls above are primary).

### 7.4 Pending order lifecycle

```
build_cart → PendingOrder row (company, branch, lines, prices, total, confirmToken, expiresAt=now()+10min)
           → bot sends summary + "reply CONFIRM-<token7>"
customer sends "CONFIRM-abc1234"
           → server matches token against open PendingOrder for this conversation
           → create_order(pendingCartId) succeeds → Order row + idempotencyKey
           → PendingOrder soft-deleted (or status=CONSUMED, TTL sweep cleans up)
expired PendingOrder (TTL sweep) → status=EXPIRED; next tool call gets a fresh one
```

A customer's raw text is never trusted as confirmation — only the structured token match.

### 7.5 Tenant-scoped RAG

```sql
-- vector search (executed inside ScopedPrisma via $queryRaw with params)
SELECT kc.content, kc.embedding <=> $embedding AS score
FROM knowledge_chunks kc
JOIN knowledge_base_documents kd ON kd.id = kc.document_id
WHERE kd.company_id = $companyId          -- company filter ALWAYS first
  AND ($branchId IS NULL OR kd.branch_id IS NULL OR kd.branch_id = $branchId)
ORDER BY score LIMIT 5;
```

Plus RLS on `knowledge_chunks` mirrors this filter as a backstop. Both the vector column `embedding vector(1536)` and the HNSW index `kb_hnsw` (`USING hnsw (embedding vector_cosine_ops)`) are defined directly on `knowledge_chunks` (not `knowledge_base_documents`). Retrieval uses tenant-filtered ANN search with tuned `hnsw.ef_search` (PG17) rather than table partitioning.

---

## 8. Background job catalog

All jobs run in the `worker` process (same NestJS modules, worker bootstrap) consuming BullMQ queues. Each job receives a **minimal, non-tenant-identifying payload** and derives its scope from a DB-verified binding (never from the payload itself).

| Queue | Purpose | Idempotency key | Scope source | Retry policy |
|---|---|---|---|---|
| `webhook-ingest` | Process a verified+deduped inbound event | `dedup_row_id` | `whatsapp_connection_id` → company/branch | 3× exp backoff 30 s/2 min/10 min; dead-letter after 3 |
| `ai-process` | Run AI turn, enqueue outbound reply | `conversation_id + turn_number` | `conversation.company_id/branch_id` | 2× 1 min/5 min; dead-letter; alert |
| `whatsapp-out` | Send outbound message via provider | `message_id` | `whatsapp_connection_id` | 5× exp backoff respecting provider rate limits |
| `kb-ingest` | Extract text, chunk, embed, upsert | `document_id` | `document.company_id` | 3× 2 min; alert on final fail; `status=FAILED` |
| `notify` | Emit Socket.IO event + in-app notification | `(order_id, action)` | `order.company_id/branch_id` | 3× 10 s; non-critical (idempotent emit) |
| `order-timeout-purge` | Cancel PENDING orders past branch timeout | `(branch_id, day)` | scheduled; reads branch list | Scheduled every 2 min; single `UPDATE RETURNING` (idempotent) |
| `analytics-aggregate` | Write company/branch rollups and an aggregate-only platform rollup | `(scope, day, currency)` | company/branch binding; platform reads only approved aggregate views | Scheduled hourly; idempotent upsert; never general platform scope |
| `subscription-check` | Enforce plan caps, suspend over-limit companies | `(company_id, hour)` | DB-verified company binding and subscription snapshot | Scheduled hourly; idempotent; audit on status change |
| `dedup-sweeper` | Re-queue stuck QUEUED dedup rows | `(queue, shard, window)` | dedicated maintenance binding; no tenant payload access | Scheduled every 5 min |
| `connection-health` | Detect expired Cloud API tokens/subscriptions, alert admins | `connection_id` | `whatsapp_connection.company_id` | Scheduled every 10 min |

Dead-lettered jobs land in `{queue}:dead` (BullMQ DL queue), trigger a metric alert, and write an `AuditLog` (type `JOB_FAILED`). Secrets (decrypted credentials) are **never** stored in job data — the job fetches them from `SecretsService` at runtime using the IDs from its payload.

---

## 9. Socket.IO — real-time events

### 9.1 Authentication & room membership

```
Handshake options (pick applicable):
  A) Browser: same-origin cookie cp_sid → BFF validates → passes user context to Nest gateway
  B) Non-browser: one-time handshake token (OTP-like, hash stored, ≤60 s TTL, single-use atomic consume, bound to session sid)

On connect:
  Gateway loads AuthContext (same §3 pipeline)
  Gateway assigns server-decided rooms:
    COMPANY_ADMIN   → rooms: `co:{companyId}` + `co:{companyId}:br:{branchId}` for each visible branch
    BRANCH_MANAGER  → rooms: `co:{companyId}:br:{branchId}`
    KITCHEN/STAFF   → rooms: `co:{companyId}:br:{branchId}:kitchen`
    DELIVERY         → rooms: `co:{companyId}:br:{branchId}:delivery`
    SUPER_ADMIN     → rooms: `platform` (admin events only; no tenant order rooms)

Client-emitted join requests → silently discarded + logged (never honored)
```

Re-validation: every 5 minutes and on `session:revoked` Redis pub/sub → `user.isActive`, `company.status`, `branch.isActive`, `permissionsVersion`; fail → `disconnect('session_expired')`.

### 9.2 Event contracts

| Event name | Payload | Emitted to room | Auth check |
|---|---|---|---|
| `order:new` | `{orderId, orderNumber, branchId, status, createdAt}` | branch + company rooms | room membership = auth |
| `order:status_changed` | `{orderId, orderNumber, fromStatus, toStatus, branchId, occurredAt}` | branch + company rooms | same |
| `order:assigned` | `{orderId, branchId}` | branch room | same |
| `kitchen:order_ready` | `{orderId, orderNumber}` | kitchen room | same |
| `delivery:order_ready` | `{orderId, orderNumber, branchId}` | delivery room | same |
| `whatsapp:connection_status` | `{connectionId, status}` | company room | same |
| `platform:company_suspended` | `{companyId}` | platform room | SUPER_ADMIN only |

Payloads carry **minimal data** — clients fetch full details via REST (scoped endpoint). This limits PII exposure on the socket channel and keeps payload sizes small.

---

## 10. Analytics & usage

### 10.1 Rollup tables (GMV vs SaaS structurally separate)

```sql
-- Written by analytics-aggregate worker; chatpilot_analytics may read only approved
-- aggregate source views and may INSERT/UPDATE rollups, never arbitrary tenant tables.
platform_daily_stats (day Date PRIMARY KEY,
  total_companies INT, active_companies INT, total_branches INT,
  total_orders INT, delivered_orders INT, cancelled_orders INT, failed_delivery_orders INT,
  gmv_by_currency JSONB,                                     -- per-currency restaurant GMV; never summed across currencies
  saas_mrr_active_companies INT                               -- subscription metrics (NOT summed with GMV)
)

company_daily_stats (company_id UUID, day Date, PRIMARY KEY(company_id, day),
  total_orders INT, delivered_orders INT, cancelled_orders INT, failed_delivery_orders INT,
  gmv_subtotal DECIMAL(16,2), gmv_delivery DECIMAL(16,2), gmv_total DECIMAL(16,2),
  avg_order_value DECIMAL(12,2), currency VARCHAR(3),
  total_messages INT, ai_tokens_used BIGINT
)

branch_daily_stats (company_id UUID, branch_id UUID, day Date, PRIMARY KEY(branch_id, day),
  -- same metrics as company_daily_stats scoped to branch
  total_orders INT, delivered_orders INT, cancelled_orders INT, failed_delivery_orders INT,
  gmv_total DECIMAL(16,2), avg_order_value DECIMAL(12,2), currency VARCHAR(3)
)
```

GMV (`Order.subtotal/total`) and SaaS subscription revenue are **separate columns,
never summed together**. Company and branch rows are currency-specific. Platform
analytics show currency-specific totals by default (D-20); unified reporting currency
conversion remains deferred until an explicit reporting currency and reliable FX rate
source are approved. Branch IANA timezone corrections by Company Admin (D-18) are audited
and strictly preserve already stored historical timestamps and `sequenceDay` dates on past orders;
corrections apply prospectively to future order sequences and analytics rollups. Dashboards query
rollup tables (O(1)); heavy date-range drilldowns query raw orders with index
`(company_id, branch_id, status, created_at DESC)`.

**Operational vs Financial Analytics RBAC (D-14):**
Rollup records store both operational throughput and monetary figures, but API presentation and access are strictly separated:
- **Operational metrics:** (`total_orders`, `delivered_orders`, `cancelled_orders`, `failed_delivery_orders`, order velocities, prep and delivery durations) are accessible to operational branch roles (`BRANCH_MANAGER`, `KITCHEN`, `DELIVERY`, `STAFF`) for their assigned branch via `analytics:operational:read`.
- **Financial metrics:** (`gmv_subtotal`, `gmv_delivery`, `gmv_total`, `avg_order_value`, currency breakdowns, monetary loss from cancellations) are strictly restricted to `SUPER_ADMIN` (platform), `COMPANY_ADMIN` (company), and authorized `BRANCH_MANAGER` (own branch) via `analytics:financial:read`. Operational staff (`KITCHEN`, `DELIVERY`, `STAFF`) are denied financial metrics; operational endpoints omit all monetary fields.

### 10.2 Usage enforcement

Checked **before** the action that consumes quota:
- `order_created`: before `create_order` tool call → read `plan.limits.ordersPerMonth` vs `UsageEvent` aggregate for the month; if exceeded → 422 with `PLAN_LIMIT_EXCEEDED`, company admin notified.
- `ai_tokens`: per-turn check against `ai_configuration.usage_caps.tokensPerDay`.
- `subscription-check` job: hourly recalculates; if company is over-limit for a grace period → triggers company suspension (status `SUSPENDED`, all logins blocked, webhook acks but queues a "service suspended" bot reply). Reactivation = Super Admin sets back to `ACTIVE`.
- Cancelled orders do **not** credit back usage (D-15: the attempt consumed capacity). `UsageEvent` rows are append-only.

---

## 11. Deployment & operations

### 11.1 Local development (docker-compose)

```yaml
services:
  postgres:  image: pgvector/pgvector:pg17  # includes pg17 + pgvector
  redis:     image: redis:7-alpine
  api:       build: apps/api   env_file: .env.local   ports: ["3001:3001"]
  worker:    build: apps/worker env_file: .env.local
  web:       build: apps/web   env_file: .env.local   ports: ["3000:3000"]
```

Two DSNs: `DATABASE_URL` (chatpilot_app, runtime) and `DATABASE_MIGRATOR_URL` (chatpilot_migrator, migrations only). Both enforced at boot: api checks `DATABASE_URL` role is not a superuser and does not have BYPASSRLS.

### 11.2 Production (Dokploy)

Three containers: `api`, `worker`, `web`. Postgres 17 + Redis 7 on private network (not publicly exposed). Object storage: S3/R2 (private bucket, no public ACL). Env secrets via Dokploy secrets (or external Vault/KMS reference). HTTPS at the ingress layer (not in containers). Health checks: `GET /healthz` (liveness, cheap), `GET /readyz` (readiness, incl. DB ping + RLS self-test).

Migration strategy: `prisma migrate deploy` runs as an init-container or pre-deploy hook using `DATABASE_MIGRATOR_URL`; api/worker containers use `DATABASE_URL` only. Zero-downtime: additive migrations only in normal flow; breaking changes get a multi-step deploy (expand → migrate → contract).

Backup: `pg_dump` daily to S3 with a tested restore runbook. Restore drill is a P9 gate item (a backup that has never been restored is not a backup).

### 11.3 Security headers & cross-cutting controls

- Helmet (NestJS): `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`.
- CORS: `allowedOrigins` from env (Next origin only; never `*`).
- Rate limits: login (5/min per IP + 10/min per email), password reset (3/15min per email), API generally (300/min per user, configurable); provider-specific outbound limits enforced by job queues.
- Request/correlation IDs: `X-Request-Id` header (generated if absent); propagated in logs, error responses, and BullMQ job metadata.
- **CI lint gates (build-breakers):**
  1. No `prismaClient.<model>` direct access outside `ScopedPrismaModule` (ESLint custom rule).
  2. No `app.scope='platform'` outside `PlatformSupportService` (regex AST rule).
  3. No raw string template in GUC-setting paths (regex AST rule).

### 11.4 Observability

- **pino** (JSON) + correlation IDs in async-local-storage context.
- **OpenTelemetry** SDK: traces across api → worker (propagated via BullMQ job headers), spans for DB queries (Prisma instrumentation), AI calls, outbound WhatsApp.
- **Prometheus** metrics endpoint (`/metrics`, internal only): queue depth per queue, job failure rate, webhook P99 latency, AI latency + token rate, order transition rate, active WebSocket connections.
- Alert conditions: dead-letter queue non-empty for >5 min, AI error rate >5% in 5 min, Cloud API connection/token failure, DB connection pool exhausted.

---

*End of ARCHITECTURE.md. Cross-reference: `DATA_OWNERSHIP.md` (entities), `AUTHORIZATION_MODEL.md` (roles/RLS), `IMPLEMENTATION_PLAN.md` (phase gates), `DECISIONS.md` (Q/D/A registers).*