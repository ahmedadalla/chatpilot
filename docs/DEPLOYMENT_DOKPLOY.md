# Production Deployment Guide: Deploying ChatPilot on a VPS using Dokploy

This guide provides a comprehensive, step-by-step walkthrough for deploying the entire ChatPilot platform on a Virtual Private Server (VPS) using **Dokploy** (the open-source PaaS that orchestrates Docker, Traefik reverse proxy, SSL certificates, and databases).

---

## 1. Prerequisites & Server Sizing

### 1.1 VPS Hardware Requirements
* **Operating System:** Clean installation of **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (64-bit).
* **Minimum Resources:** 2 vCPU, 4 GB RAM, 40 GB SSD.
* **Recommended Resources:** 4 vCPU, 8 GB RAM, 80 GB NVMe SSD (especially when hosting PostgreSQL, Redis, Baileys WhatsApp worker, and AI queues on the same server).
* **Network:** Static public IPv4 address.
* **Access:** SSH root or sudo access.

### 1.2 Domain & DNS Records
Before beginning, create the following DNS **A Records** pointing to your VPS public IPv4 address at your domain registrar or Cloudflare (set proxy to *DNS Only* initially during SSL generation):

| Host / Subdomain | Example Record | Target | Purpose |
|---|---|---|---|
| `app` | `app.yourdomain.com` | `YOUR_VPS_IP` | Next.js Frontend Portal (BFF) |
| `api` | `api.yourdomain.com` | `YOUR_VPS_IP` | NestJS HTTP API, Webhooks & Socket.IO |
| `dokploy` | `dokploy.yourdomain.com` | `YOUR_VPS_IP` | Dokploy Management Dashboard |

---

## 2. Step 1: Install Dokploy on Your VPS

1. Connect to your clean VPS via SSH:
   ```bash
   ssh root@YOUR_VPS_IP
   ```

2. Update system packages:
   ```bash
   apt update && apt upgrade -y
   apt install -y curl ufw git
   ```

3. Configure firewall basics (allow SSH, HTTP, HTTPS, and Dokploy initial setup port):
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 3000/tcp
   ufw enable
   ```

4. Run the official Dokploy automated installer:
   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```

5. Once the installation completes, Dokploy will output:
   ```
   Dokploy is running on: http://YOUR_VPS_IP:3000
   ```

6. Open `http://YOUR_VPS_IP:3000` in your web browser. Create your administrator account (Email and Password).
7. In the Dokploy Settings -> Domain, attach your domain `dokploy.yourdomain.com` and enable Let's Encrypt SSL. You can now access Dokploy securely at `https://dokploy.yourdomain.com`.

---

## 3. Step 2: Create Project & Backing Databases in Dokploy

Inside the Dokploy dashboard:

### 3.1 Create Project
1. Navigate to **Projects** -> Click **+ Create Project**.
2. Name the project: `chatpilot-production`.

### 3.2 Add PostgreSQL 17 with pgvector
ChatPilot requires **PostgreSQL 17** with the **pgvector** extension (D-1):
1. In your project, click **+ Add Service** -> Select **Compose** (or Database).
2. To ensure pgvector is included, deploy PostgreSQL as a Compose service or Docker container using the official pgvector image:
   * **Image:** `pgvector/pgvector:pg17`
   * **Environment Variables:**
     ```env
     POSTGRES_DB=chatpilot
     POSTGRES_USER=chatpilot_migrator
     POSTGRES_PASSWORD=generate_a_very_strong_password_here
     ```
   * **Volumes:** Bind mount or named volume `/var/lib/postgresql/data`.
   * **Internal Network:** Ensure it is attached to the Dokploy private network (e.g. `dokploy-network`). Do NOT expose port 5432 to the public internet.

### 3.3 Add Redis 7
1. In your project, click **+ Add Service** -> Select **Redis**.
2. **Version:** `7-alpine`.
3. Set a strong password in configuration.
4. Keep Redis on the private internal network (no public port exposure).

---

## 4. Step 3: Configure Environment Secrets

In Dokploy, under your application service or compose service, go to **Environment Variables** and enter the following production values:

```env
# Application Environment
NODE_ENV=production
PORT=3001
WEB_PORT=3000
WHATSAPP_WORKER_PORT=3002

# Two-DSN Least Privilege Database Architecture (D-3)
# 1. Migrator DSN (used only during migrations and init)
DATABASE_URL_MIGRATOR=postgresql://chatpilot_migrator:YOUR_STRONG_PASSWORD@postgres:5432/chatpilot?schema=public

# 2. Runtime Application DSN (chatpilot_app role - NO BYPASSRLS, not a superuser)
DATABASE_URL=postgresql://chatpilot_app:YOUR_APP_ROLE_PASSWORD@postgres:5432/chatpilot?schema=public

# Redis Connection
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@redis:6379

# Cryptography & Security
# Generate with: openssl rand -base64 32
JWT_SECRET=YOUR_RANDOM_32_CHAR_JWT_SECRET_STRING_HERE
JWT_ACCESS_TTL=900
REFRESH_TOKEN_TTL=604800

# Envelope Encryption Master Key (D-13)
# Generate with: openssl rand -base64 32
KMS_MASTER_KEY=YOUR_BASE64_256_BIT_MASTER_KEY_HERE==

# Object Storage (S3 / Cloudflare R2 / MinIO)
S3_BUCKET=chatpilot-production-uploads
S3_REGION=auto
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=YOUR_R2_OR_S3_KEY_ID
S3_SECRET_ACCESS_KEY=YOUR_R2_OR_S3_SECRET_KEY

# Regional & Localization Defaults (Q-REQ-6)
DEFAULT_COUNTRY=EG
DEFAULT_CURRENCY=EGP
DEFAULT_TIMEZONE=Africa/Cairo
DEFAULT_LOCALE=ar-EG
DEFAULT_CALLING_CODE=+20

# Initial Super Admin Bootstrap (First boot only)
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=SetAStrongInitialPassword123!
BOOTSTRAP_OVERRIDE=true
```

---

## 5. Step 4: Run Initial Database Security Migrations

Before launching the API containers, the database roles and Row-Level Security policies must be applied using the `chatpilot_migrator` DSN.

In Dokploy, open the terminal of your PostgreSQL container (or an ephemeral helper container) and execute:

```bash
# 1. Connect to PostgreSQL as superuser/migrator
psql "$DATABASE_URL_MIGRATOR" -d chatpilot

# 2. Create the runtime roles and grant permissions
# Run prisma/migrations/000_init_roles.sql:
```
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_app') THEN
    CREATE ROLE chatpilot_app WITH LOGIN PASSWORD 'YOUR_APP_ROLE_PASSWORD' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_analytics') THEN
    CREATE ROLE chatpilot_analytics WITH LOGIN PASSWORD 'YOUR_ANALYTICS_PASSWORD' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO chatpilot_app, chatpilot_analytics;
ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatpilot_app;
ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO chatpilot_app;
```

```bash
# 3. Apply Prisma Schema & DDL
pnpm --filter @chatpilot/database exec prisma migrate deploy

# 4. Apply Security & Extension Migrations
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/001_guc_helpers.sql
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/002_preauth_lookups.sql
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/003_rls_policies.sql
psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/004_pgvector_hnsw.sql
```

---

## 6. Step 5: Deploy Services in Dokploy

In Dokploy, create a **Compose Service** connected to your Git repository (GitHub / GitLab):

### 6.1 Dokploy Compose Configuration (`docker-compose.prod.yml`)
Paste this configuration into Dokploy:

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: compose/Dockerfile.api
    restart: unless-stopped
    env_file:
      - .env
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3001/healthz']
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - dokploy-network

  worker:
    build:
      context: .
      dockerfile: compose/Dockerfile.worker
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - dokploy-network

  whatsapp-worker:
    build:
      context: .
      dockerfile: compose/Dockerfile.whatsapp-worker
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - dokploy-network

  web:
    build:
      context: .
      dockerfile: compose/Dockerfile.web
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      api:
        condition: service_healthy
    networks:
      - dokploy-network

networks:
  dokploy-network:
    external: true
```

---

## 7. Step 6: Configure Domains, Reverse Proxy & SSL in Dokploy

Dokploy manages **Traefik** automatically to handle HTTPS and reverse proxying.

### 7.1 Web Service Routing (`apps/web`)
1. Click on the **web** service in Dokploy.
2. Go to **Domains** -> Click **+ Add Domain**.
3. **Domain:** `app.yourdomain.com`
4. **Target Port:** `3000`
5. **Certificate:** Select **Let's Encrypt** (Automatic HTTPS).
6. Click **Save** and **Deploy**.

### 7.2 API Service Routing (`apps/api`)
1. Click on the **api** service in Dokploy.
2. Go to **Domains** -> Click **+ Add Domain**.
3. **Domain:** `api.yourdomain.com`
4. **Target Port:** `3001`
5. **Certificate:** Select **Let's Encrypt**.
6. **WebSocket Support:** Traefik supports WebSocket connections automatically. Ensure the headers pass through for `/events` (Socket.IO).
7. Click **Save** and **Deploy**.

---

## 8. Step 7: Verify Live Deployment

1. **Verify Liveness:**
   ```bash
   curl -I https://api.yourdomain.com/healthz
   # Expected: HTTP/1.1 200 OK
   ```

2. **Verify Startup RLS Self-Test (Readiness):**
   ```bash
   curl -i https://api.yourdomain.com/readyz
   # Expected: HTTP/1.1 200 OK
   # JSON: {"status":"ready","database":"connected","rlsSelfTest":"passed",...}
   ```
   *If the RLS self-test returns 503, an invalid DSN or superuser leak occurred, and the orchestrator immediately blocks traffic.*

3. **Verify Web Frontend:**
   Open `https://app.yourdomain.com` in your browser. The Arabic/English portal with RTL layouts will load securely over HTTPS.

4. **Bootstrap Super Admin:**
   Log in with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. Complete your TOTP MFA enrollment and securely store the 10 single-use recovery codes.
   *(Once bootstrapped, remove `BOOTSTRAP_OVERRIDE` from Dokploy environment variables).*

---

## 9. Live Monitoring & Container Logs

Inside the Dokploy dashboard:
* **Logs Tab:** View real-time, structured Pino JSON logs for each container (`api`, `worker`, `whatsapp-worker`, `web`).
* **Metrics Tab:** Monitor container CPU usage, RAM footprint, and network traffic.
* **Auto-Restart:** All containers are set to `restart: unless-stopped`. If the WhatsApp worker encounters a session disconnect, its internal reconnect worker automatically recovers the connection without affecting the API.
