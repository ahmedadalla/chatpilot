# ChatPilot — Backend Implementation Audit

**Date:** 2026-11-08  
**Auditor:** Principal Full-Stack Engineer, Senior Next.js Architect & Application Security Engineer  
**Scope:** `apps/api`, `packages/database`, `packages/contracts`, `prisma/migrations`

---

## 1. Executive Summary

A comprehensive architectural and source code audit was conducted on the ChatPilot backend. Contrary to `docs/FEATURE_STATUS.md` which labeled all features as `PLANNED`, the repository contains substantial, high-integrity architectural components:

- Robust multi-tenant schema with PostgreSQL Row-Level Security (RLS) migrations and GUC helper functions (`001_guc_helpers.sql`, `002_preauth_lookups.sql`, `003_rls_policies.sql`, `004_pgvector_hnsw.sql`).
- Argon2id password hashing, JWT token services, permission versioning, session tracking, and TOTP MFA services.
- 14 NestJS controllers and domain services for companies, branches, menu, orders, staff, files, KB, WhatsApp, AI orchestration, billing, and analytics.
- Realtime WebSocket gateway (`OrderEventsGateway`) with server-decided room authorization and single-use handshake token generation.

However, several critical integration blockers, security edge-cases, and missing API endpoints were uncovered that must be resolved prior to seamless frontend integration.

---

## 2. Component Inventory & Classification

Each component is classified as:

- **IMPLEMENTED_AND_VERIFIED**: Code exists, logic is complete, contracts match, authorization verified.
- **IMPLEMENTED_BUT_UNVERIFIED**: Code exists but relies on synthetic/untested paths.
- **PARTIALLY_IMPLEMENTED**: Core logic exists, but key methods or error handling are missing.
- **SIMULATED_OR_MOCKED**: Implemented as mock/placeholder (e.g. AI responses, hardcoded metrics).
- **MISSING**: Documented requirements with no corresponding backend implementation.

### 2.1 Authentication & Session Handling

| Component                                    | Classification           | Findings & Required Remediation                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthService.login`                          | IMPLEMENTED_AND_VERIFIED | Constant-time password check, timing dummy verify, company/branch status checks.                                                                                                                                                 |
| `Super Admin MFA Gate`                       | PARTIALLY_IMPLEMENTED    | In `auth.service.ts:89`, login requires `totpCode` for `SUPER_ADMIN`. However, bootstrapped initial super admin has `totpSecret = null`, causing an initial login deadlock. Must allow enrollment state if `totpSecret` is null. |
| `MFA Verify Endpoint`                        | MISSING                  | `auth.controller.ts` has `mfa/setup` but lacks `mfa/verify` to confirm setup before enabling TOTP.                                                                                                                               |
| `GET /auth/me`                               | MISSING                  | Critical contract required by frontend shell to retrieve server-verified identity, role, scope, capabilities, and company/branch status.                                                                                         |
| `POST /auth/logout`                          | PARTIALLY_IMPLEMENTED    | Clears `cp_rft` cookie but omits calling `sessionService.revokeSession(sessionId)`. Server-side session remains valid in database until expiration.                                                                              |
| `SessionService` & Token Rotation            | IMPLEMENTED_AND_VERIFIED | Refresh token rotation, reuse detection via SHA-256 tokenHash, cascading revocation.                                                                                                                                             |
| `PasswordResetService` & `InvitationService` | IMPLEMENTED_AND_VERIFIED | Timing-safe tokens, Argon2id hashing, company activation on initial admin acceptance.                                                                                                                                            |

### 2.2 PostgreSQL RLS & Database Isolation

| Component                    | Classification           | Findings & Required Remediation                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TenantScopeService`         | IMPLEMENTED_AND_VERIFIED | Parameterized `app_set_scope()` calls in transactions. Gate B strictly rejects `platform` scope. Context binding validates user-tenant consistency.                                                                                                                       |
| `PlatformSupportService`     | IMPLEMENTED_AND_VERIFIED | Dedicated audited support path via `app_set_platform_scope(reason)`. Transactional `AuditLog` row generation.                                                                                                                                                             |
| Direct `PrismaService` usage | PARTIALLY_IMPLEMENTED    | While `PlatformSupportService` uses `TenantScopeService`, several domain services query `PrismaService` directly. While queries include explicit `where: { companyId, branchId }`, full RLS enforcement relies on GUCs when executing under runtime role `chatpilot_app`. |

### 2.3 Company, Branch & Staff Management

| Component                              | Classification           | Findings & Required Remediation                                                                                                                 |
| -------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `CompanyController` & `CompanyService` | IMPLEMENTED_AND_VERIFIED | Atomic company creation with Egypt defaults, company suspend/activate with cascading session revocation and permissionsVersion increment.       |
| `BranchController` & `BranchService`   | IMPLEMENTED_AND_VERIFIED | Branch CRUD, timezone updates, delivery fee, operational settings, last-admin checks.                                                           |
| `StaffController`                      | PARTIALLY_IMPLEMENTED    | Has `POST /staff/invite`, `DELETE /staff/:id`, `PATCH /staff/:id/role`. Lacks `GET /staff` endpoint for listing company/branch staff directory. |

### 2.4 Menu Management

| Component                        | Classification           | Findings & Required Remediation                     |
| -------------------------------- | ------------------------ | --------------------------------------------------- |
| `MenuController` & `MenuService` | IMPLEMENTED_AND_VERIFIED | Category and Item CRUD, soft archiving.             |
| `BranchAvailabilityService`      | IMPLEMENTED_AND_VERIFIED | Branch price overrides and availability toggling.   |
| `AvailabilityResolutionService`  | IMPLEMENTED_AND_VERIFIED | Authoritative resolution of active menu per branch. |

### 2.5 Orders & State Machine

| Component              | Classification           | Findings & Required Remediation                                                                                                                                                                                                         |
| ---------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OrderWorkflowService` | IMPLEMENTED_AND_VERIFIED | Full state machine (`PENDING`, `ACCEPTED`, `IN_PREPARATION`, `READY_FOR_DELIVERY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `FAILED_DELIVERY`). Idempotency key handling, sequential daily order numbering via `BranchDayCounter`. |
| `OrderBoardService`    | PARTIALLY_IMPLEMENTED    | Has `listOrders`, `getKitchenBoard`, `getDeliveryBoard`. Lacks `GET /orders/:id` for full order detail snapshot and audit history.                                                                                                      |

### 2.6 WhatsApp Integration

| Component                                             | Classification        | Findings & Required Remediation                                                                                                                                                                                                       |
| ----------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WhatsAppController`                                  | PARTIALLY_IMPLEMENTED | Has public HMAC-verified webhook and `POST /whatsapp/connections`. Lacks `GET /whatsapp/connections`, `DELETE /whatsapp/connections/:id`, and `POST /whatsapp/connections/:id/refresh-qr`.                                            |
| Adapters (`MetaCloudApi`, `Coexistence`, `BaileysQr`) | SIMULATED_OR_MOCKED   | Provide synthetic pairing codes and simulated message receipts. The UI must represent these states truthfully (e.g., "Not Configured" / "Setup Required" / "Pairing Required") rather than falsely claiming active live connectivity. |

### 2.7 AI Orchestrator & Knowledge Base

| Component                                      | Classification           | Findings & Required Remediation                                                                                                                                           |
| ---------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KbController` & Services                      | IMPLEMENTED_AND_VERIFIED | Document upload, text extraction, chunking, pgvector HNSW search, branch vs company scoping.                                                                              |
| `AiModule` & `AiOrchestratorService`           | PARTIALLY_IMPLEMENTED    | Tools for pending order confirmation and menu retrieval are built. Lacks `AiController` exposing `GET /ai/config` and `PATCH /ai/config` for company admin configuration. |
| AI Adapters (`Gemini`, `OpenAI`, `OpenRouter`) | SIMULATED_OR_MOCKED      | Default adapter returns static Arabic greeting. Must accept real API keys or indicate "API key required".                                                                 |

### 2.8 Analytics & Billing

| Component                                   | Classification           | Findings & Required Remediation                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnalyticsService`                          | PARTIALLY_IMPLEMENTED    | Real order count aggregations, GMV aggregations, and currency separation. However, average prep duration (18/19 min) and delivery duration (24/25 min) are hardcoded literals. AI token usage (12500) and SaaS MRR multiplier (`activeCompanies * 2500`) are placeholder formulas. Must calculate real stats from `OrderStatusHistory` or return null/unmeasured. |
| `BillingController` & `SubscriptionService` | IMPLEMENTED_AND_VERIFIED | Plan creation, company subscription assignment, and usage limits tracking.                                                                                                                                                                                                                                                                                        |

### 2.9 Realtime & Sockets

| Component            | Classification           | Findings & Required Remediation                                                                                                                                                |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OrderEventsGateway` | IMPLEMENTED_AND_VERIFIED | Server-decided room joins: `platform`, `co:<id>`, `co:<id>:br:<id>`, `:kitchen`, `:delivery`. Rejects client join attempts. Broadcasts `order:new` and `order:status_changed`. |
| `SocketTokenService` | PARTIALLY_IMPLEMENTED    | Implements atomic 60-second one-time token generation and consumption, but lacks an HTTP controller endpoint (`POST /socket/ticket`) for client consumption.                   |

---

## 3. Critical Backend Fixes Required

1. **Authentication:**
   - Implement `GET /auth/me` returning trusted `MeResponse` (identity, role, scope, capabilities, company/branch status).
   - Fix `POST /auth/logout` to revoke the database session via `sessionService.revokeSession()`.
   - Resolve Super Admin initial login deadlock by permitting initial MFA setup when `totpSecret` is not yet configured.
   - Add `POST /auth/mfa/verify` to complete TOTP enrollment.
2. **Missing Endpoints:**
   - `GET /staff`: Staff listing for company and branch scopes.
   - `GET /orders/:id`: Full order detail with items snapshot and complete status history.
   - `GET /whatsapp/connections`, `DELETE /whatsapp/connections/:id`, `POST /whatsapp/connections/:id/refresh-qr`.
   - `GET /ai/config` and `PATCH /ai/config`: AI provider and prompt template management.
   - `GET /platform/audit-logs`: Platform audit log viewer for Super Admin.
   - `POST /socket/ticket`: Authenticated endpoint to issue WebSocket handshake ticket.
3. **Analytics Correctness:**
   - Compute real average durations from `OrderStatusHistory` transition timestamps; return null if uncalculated.
   - Compute SaaS MRR dynamically from active subscription plans.
4. **Adapter Truthfulness:**
   - Clearly report unconfigured provider states rather than simulated success.
