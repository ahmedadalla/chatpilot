# ChatPilot Threat Model & OWASP Top 10 Verification Report

**Status:** Security Verification Standard  
**Related:** `ARCHITECTURE.md` §11.3, `AUTHORIZATION_MODEL.md`, `IMPLEMENTATION_PLAN.md` Phase P9

---

## 1. Threat Mitigation Matrix

| Vulnerability / Attack Vector | Mitigation in ChatPilot Architecture | Automated CI / Test Verification Gate |
|---|---|---|
| **A01: Broken Access Control (Cross-Tenant Data Leakage)** | Defense-in-depth: (1) Application `ScopedPrisma` wrapper context validation (`InvalidTenantContextException`), (2) Database-enforced `FORCE ROW LEVEL SECURITY` with transaction-local GUCs (`app_set_scope`), (3) Non-leaking `404 Not Found` error policy. | `test:integration --suite=rls`, `test:integration --suite=isolation`, ESLint Gate A (`no-raw-prisma`) |
| **A02: Cryptographic Failures** | Argon2id for password hashing (`m=64MB, t=3, p=1`). Envelope encryption (`SecretsService`) with AES-256-GCM for API keys, WhatsApp session tokens, and webhook secrets. TLS in transit. | `test:integration --suite=auth`, Semgrep secret sniffing |
| **A03: Injection (SQL & Prompt Injection)** | **SQL:** Parameterized Prisma queries and `$executeRaw` only; template strings in raw SQL prohibited by ESLint Gate C. **AI Prompt Injection:** Delimiting all untrusted customer input and KB chunks in `<data>...</data>` tags; server-owned state machine where model has zero pricing/order placement authority. | `test:integration --suite=ai-prompt-injection`, ESLint Gate C (`no-raw-sql-templates`) |
| **A04: Insecure Design** | Separation of operational analytics from financial analytics (D-14); least-privilege database roles (`chatpilot_app` has no `BYPASSRLS`); two-phase confirmation gate with random 7-character tokens (`PendingOrder`). | `test:integration --suite=analytics`, `test:integration --suite=whatsapp` |
| **A05: Security Misconfiguration** | Helmet security headers (strict CSP, HSTS, no-sniff, frame denial); two-DSN enforcement at boot; `/readyz` startup RLS self-test fails deployment if non-zero rows returned without GUC context. | `apps/api/src/health/health.controller.ts` self-test, Dockerfile non-root runner |
| **A06: Vulnerable and Outdated Components** | Pinned dependencies in pnpm lockfile; automated vulnerability scanning with `pnpm audit` and Dependabot weekly updates. | GitHub Actions CI `pnpm audit` |
| **A07: Identification & Authentication Failures** | Stateless 15-minute access JWTs (`{sub, sid, jti, ver}`); CAS refresh token rotation with reuse/theft detection; centralized `permissionsVersion` stale-token invalidation; required TOTP MFA for Super Admins with single-use recovery codes. | `test:integration --suite=auth` (15 cases) |
| **A08: Software and Data Integrity Failures** | Magic-byte header sniffing for file uploads (415 on mismatch); deterministic BullMQ job IDs (`order:{id}:transition:{to}`) preventing duplicate side effects. | `test:integration --suite=isolation` (Test 29), `order-workflow.spec.ts` |
| **A09: Security Logging and Monitoring Failures** | JSON structured logging with Pino; request correlation IDs (`X-Request-Id`) propagated across HTTP, BullMQ jobs, and Redis events; mandatory `AuditLog` rows for sensitive operations (company suspension, timezone correction, platform support read). | `test:integration --suite=isolation` (Test 22, 24) |
| **A10: Server-Side Request Forgery (SSRF)** | Private S3 bucket with no public ACL; pre-signed URLs generated server-side with capability-to-purpose checks; webhook routing bound to receiving business connection ID (never caller-supplied URL). | `test:integration --suite=isolation` (Test 28), `whatsapp.spec.ts` (Test 11) |

---

## 2. Multi-Tenant RLS Attack Surface Audit

1. **Connection Pool State Pollution:**
   - *Threat:* A pooled PostgreSQL connection retains tenant GUCs from a previous request.
   - *Mitigation:* Scope is established via `set_config(..., true)` which is strictly transaction-local. On `COMMIT` or `ROLLBACK`, GUCs auto-clear.
   - *Verification:* Verified by Test 6 and 7 in `rls.spec.ts`.

2. **Privilege Escalation to Platform Scope:**
   - *Threat:* An attacker injects `scope='platform'` in an API request or background worker.
   - *Mitigation:* `app_set_scope` plpgsql function rejects `'platform'` scope. Platform scope can be established ONLY by `app_set_platform_scope` in `PlatformSupportService` with a non-empty audit reason.
   - *Verification:* Verified by Test 4 and 15 in `rls.spec.ts`, and ESLint/Semgrep Gate B.

3. **Mismatched Tenant Context Pairing:**
   - *Threat:* An attacker with an authenticated session for Company A modifies request body or parameters to act upon Company B.
   - *Mitigation:* `TenantScopeService` performs runtime context binding validation: if `ctx.userId` belongs to Company A and `ctx.companyId` is Company B, it immediately throws `InvalidTenantContextException` before touching the database.
   - *Verification:* Verified by Test 16 and 17 in `rls.spec.ts`.
