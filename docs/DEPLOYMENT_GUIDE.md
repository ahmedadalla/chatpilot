# ChatPilot Production Deployment Guide (Dokploy & Container Topology)

**Status:** Production Standard  
**Related:** `ARCHITECTURE.md` §11, `IMPLEMENTATION_PLAN.md` Phase P9

> **Operational Deployment Guides:**
> - For a complete step-by-step guide using **Dokploy (GUI PaaS)**, see **[`DEPLOYMENT_DOKPLOY.md`](./DEPLOYMENT_DOKPLOY.md)**.
> - For a complete step-by-step guide on a **clean Linux VPS without Dokploy (Docker + Nginx + Certbot + Systemd)**, see **[`DEPLOYMENT_STANDALONE_VPS.md`](./DEPLOYMENT_STANDALONE_VPS.md)**.

---

## 1. Architecture & Container Topology

In production, ChatPilot runs as four decoupled services with two private backing services within a dedicated Dokploy private network:

```
[ Ingress / SSL Reverse Proxy (Traefik/Nginx) ]
      │ (public HTTPS)
      ├──▶ web (Next.js App Router, port 3000) ──(BFF internal)──┐
      └──▶ api (NestJS HTTP & Socket.IO, port 3001) ◀─────────────┘
             │ (internal Redis / DB)
             ├──▶ postgres (PostgreSQL 17 + pgvector 0.8+, port 5432)
             ├──▶ redis (Redis 7 Alpine, port 6379)
             │
      ┌──────┴──────────────────────────┐
      ▼                                 ▼
worker (BullMQ Consumer)     whatsapp-worker (Baileys Multi-Device)
(background jobs, no public port)    (WebSocket sessions, port 3002)
```

### Key Invariants:
* **The API is NOT directly browser-reachable.** The browser communicates with the Next.js BFF (`apps/web`), which proxies state-changing and data-fetching operations internally.
* **The WhatsApp Multi-Device process (`apps/whatsapp-worker`) is strictly isolated** in its own container to prevent long-lived socket memory leaks or reconnect loops from impacting HTTP API availability (D-21).
* **Two-DSN Least Privilege Enforcement (D-3):**
  * `DATABASE_URL_MIGRATOR`: `chatpilot_migrator` role. Table owner, executes DDL and RLS schema migrations.
  * `DATABASE_URL`: `chatpilot_app` role. Runtime application user without `BYPASSRLS`, not a superuser, not table owner.

---

## 2. Pre-Deployment: Migration Init-Container

Before starting application containers (`api`, `worker`, `whatsapp-worker`, `web`), execute database migrations using an init-container or pre-deploy hook:

```bash
# 1. Run migrations as chatpilot_migrator
pnpm --filter @chatpilot/database exec prisma migrate deploy

# 2. Apply raw SQL security migrations
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/000_init_roles.sql
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/001_guc_helpers.sql
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/002_preauth_lookups.sql
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/003_rls_policies.sql
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/004_pgvector_hnsw.sql
```

---

## 3. Production Environment Variables Checklist

Configure the following secrets in Dokploy:

| Variable | Description | Example / Requirement |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | API listen port | `3001` |
| `WEB_PORT` | Web listen port | `3000` |
| `WHATSAPP_WORKER_PORT` | WhatsApp worker port | `3002` |
| `DATABASE_URL` | Runtime DSN (`chatpilot_app`) | `postgresql://chatpilot_app:***@postgres:5432/chatpilot?schema=public` |
| `DATABASE_URL_MIGRATOR`| Migrator DSN (`chatpilot_migrator`)| `postgresql://chatpilot_migrator:***@postgres:5432/chatpilot?schema=public` |
| `REDIS_URL` | Redis 7 connection string | `redis://:***@redis:6379` |
| `JWT_SECRET` | 256-bit signing key (≥ 32 chars) | Cryptographically random secret string |
| `KMS_MASTER_KEY` | Master key for envelope encryption | Base64-encoded 256-bit key (D-13) |
| `S3_BUCKET` | Private object storage bucket | `chatpilot-prod-uploads` |
| `S3_REGION` | S3 / R2 Region | `auto` or AWS region code |
| `S3_ENDPOINT` | Private S3 API URL | Cloudflare R2 / AWS S3 endpoint |
| `S3_ACCESS_KEY_ID` | Storage access key | Private API token |
| `S3_SECRET_ACCESS_KEY` | Storage secret key | Private secret key |
| `DEFAULT_COUNTRY` | Default country code | `EG` (Egypt, Q-REQ-6) |
| `DEFAULT_CURRENCY` | Default currency code | `EGP` (Egyptian Pound) |
| `DEFAULT_TIMEZONE` | Default business timezone | `Africa/Cairo` |
| `DEFAULT_LOCALE` | Default language locale | `ar-EG` |

---

## 4. Health & Readiness Orchestration

Dokploy orchestrator must be configured with both liveness and readiness probes on `api`:

1. **Liveness Probe:**
   * Path: `GET /healthz`
   * Interval: 10s
   * Success: `HTTP 200` (cheap process check).
2. **Readiness Probe & Startup RLS Self-Test:**
   * Path: `GET /readyz`
   * Interval: 10s
   * Function: Verifies database ping, Redis connectivity, and executes the **startup RLS self-test**:
     `SELECT count(*) FROM companies;` as `chatpilot_app` with no GUC set.
     If count > 0, returns `503 Service Unavailable` with `RLS_SELF_TEST_FAILED_DATA_LEAK`. Dokploy routes zero traffic until this test passes.

---

## 5. Security Headers & TLS Termination

* TLS is terminated at the Traefik / Dokploy reverse proxy layer with HTTP->HTTPS redirection and HTTP/2 enabled.
* Helmet enforces strict response headers on `apps/api`:
  * `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: DENY`
  * `Referrer-Policy: strict-origin-when-cross-origin`
  * `Content-Security-Policy: default-src 'self'`
