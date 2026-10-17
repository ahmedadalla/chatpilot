# Production Deployment Guide: Deploying ChatPilot from GitHub to VPS using Dokploy

**Repository:** `https://github.com/ahmedadalla/chatpilot.git`  
**Target Environment:** Virtual Private Server (Ubuntu 22.04 / 24.04 LTS)  
**Orchestrator:** Dokploy (Docker, Traefik Reverse Proxy, Let's Encrypt SSL)

---

## Overview

This guide walks you through the entire deployment process from your GitHub repository `ahmedadalla/chatpilot` to a live, production-ready system on your VPS. 

By the end of this guide:
1. Dokploy will manage your containers and automatically renew SSL certificates.
2. PostgreSQL 17 with `pgvector` will run securely with Row-Level Security (RLS) and least-privilege roles.
3. Redis 7 will power your background job queues (BullMQ).
4. All four services (`web`, `api`, `worker`, `whatsapp-worker`) will run with health checks and zero-downtime restarts.
5. Your platform will be accessible via:
   * **Web Portal:** `https://app.yourdomain.com`
   * **API & WebSockets:** `https://api.yourdomain.com`
   * **Dokploy Panel:** `https://dokploy.yourdomain.com`

---

## Phase 1: DNS & Domain Setup

Before touching the server, configure your domain's DNS records so SSL certificates can be issued immediately:

1. Log in to your domain provider (Cloudflare, Namecheap, GoDaddy, Hostinger, etc.).
2. Go to **DNS Management** for your domain (e.g. `yourdomain.com`).
3. Add three **A Records** pointing to your **VPS Public IPv4 Address**:

| Type | Name / Host | Target IP | Proxy Status (Cloudflare) | Purpose |
|---|---|---|---|---|
| **A** | `app` | `YOUR_VPS_IP` | **DNS Only (Gray Cloud)** | Next.js Web Portal |
| **A** | `api` | `YOUR_VPS_IP` | **DNS Only (Gray Cloud)** | NestJS API & Socket.IO |
| **A** | `dokploy` | `YOUR_VPS_IP` | **DNS Only (Gray Cloud)** | Dokploy Admin Dashboard |

*(Note for Cloudflare users: Keep proxy set to "DNS Only" initially so Let's Encrypt HTTP-01 challenges can verify your server directly. You can enable Cloudflare proxying later if desired).*

---

## Phase 2: VPS Preparation & Dokploy Installation

### Step 1: Connect to your VPS via SSH
Open your terminal (PowerShell, Git Bash, or macOS Terminal):
```bash
ssh root@YOUR_VPS_IP
```

### Step 2: Update Server & Configure Firewall
Run these commands to update Ubuntu packages and configure the UFW firewall:
```bash
# Update package lists and upgrade existing software
apt update && apt upgrade -y

# Install essential tools
apt install -y curl ufw git fail2ban

# Configure firewall: Allow SSH, HTTP, HTTPS, and Dokploy initial port
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

# Enable firewall
ufw enable -y
```

### Step 3: Install Dokploy
Run the official Dokploy one-line automated installer:
```bash
curl -sSL https://dokploy.com/install.sh | sh
```
The installer will automatically install Docker, Docker Compose, Traefik reverse proxy, and start the Dokploy management service.

When installation finishes, you will see:
```
Dokploy is running on: http://YOUR_VPS_IP:3000
```

### Step 4: Initial Dokploy Account & Custom Domain
1. In your browser, open `http://YOUR_VPS_IP:3000`.
2. Fill out your Administrator details:
   * **Name:** Your name
   * **Email:** `admin@yourdomain.com`
   * **Password:** Choose a strong password
3. Click **Complete Setup**.
4. Secure Dokploy with HTTPS:
   * In Dokploy, go to **Settings** (gear icon in sidebar) -> **Server Domain**.
   * Enter: `dokploy.yourdomain.com`
   * Check **Enable Let's Encrypt SSL**.
   * Click **Save**.
5. You can now access Dokploy securely at `https://dokploy.yourdomain.com`.

---

## Phase 3: Connect GitHub to Dokploy

To enable Dokploy to pull your private repository `ahmedadalla/chatpilot`, connect GitHub via a Personal Access Token:

### Step 1: Create a GitHub Personal Access Token (PAT)
1. Go to **GitHub** -> Click your profile picture (top right) -> **Settings**.
2. Scroll to the bottom of the left sidebar -> Click **Developer Settings**.
3. Click **Personal access tokens** -> **Tokens (classic)**.
4. Click **Generate new token** -> **Generate new token (classic)**.
5. Set:
   * **Note:** `Dokploy VPS Deployer`
   * **Expiration:** `90 days` (or `No expiration`)
   * **Scopes:** Check `repo` (Full control of private repositories).
6. Click **Generate token** at the bottom.
7. **Copy the generated token immediately** (starts with `ghp_...`).

### Step 2: Add GitHub Token to Dokploy
1. In Dokploy, go to **Settings** -> **Git Providers**.
2. Under **GitHub**, click **+ Add Credential**.
3. Name: `My GitHub`
4. Paste your Personal Access Token (`ghp_...`).
5. Click **Save**. Dokploy is now connected to your GitHub account.

---

## Phase 4: Create Project & Backing Databases

### Step 1: Create the Project
1. In Dokploy sidebar, click **Projects** -> **+ Create Project**.
2. **Name:** `ChatPilot-Production`
3. Click **Create**.

### Step 2: Deploy PostgreSQL 17 with pgvector
ChatPilot requires PostgreSQL 17 with `pgvector` for AI vector embeddings (D-1):
1. Inside the project, click **+ Add Service** -> Select **Compose**.
2. Name the service: `postgres`.
3. In the Compose editor, paste:
   ```yaml
   version: '3.8'

   services:
     postgres:
       image: pgvector/pgvector:pg17
       container_name: chatpilot-postgres
       restart: unless-stopped
       environment:
         POSTGRES_DB: chatpilot
         POSTGRES_USER: chatpilot_migrator
         POSTGRES_PASSWORD: StrongMigratorPassword_ReplaceMe_123!
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U chatpilot_migrator -d chatpilot"]
         interval: 5s
         timeout: 5s
         retries: 5
       networks:
         - dokploy-network

   volumes:
     postgres_data:

   networks:
     dokploy-network:
       external: true
   ```
4. Click **Deploy**. Wait until the container shows **Running (Healthy)**.

### Step 3: Deploy Redis 7
1. In the project, click **+ Add Service** -> Select **Compose**.
2. Name the service: `redis`.
3. In the Compose editor, paste:
   ```yaml
   version: '3.8'

   services:
     redis:
       image: redis:7-alpine
       container_name: chatpilot-redis
       restart: unless-stopped
       command: ["redis-server", "--requirepass", "StrongRedisPassword_ReplaceMe_456!"]
       volumes:
         - redis_data:/data
       healthcheck:
         test: ["CMD", "redis-cli", "-a", "StrongRedisPassword_ReplaceMe_456!", "ping"]
         interval: 5s
         timeout: 5s
         retries: 5
       networks:
         - dokploy-network

   volumes:
     redis_data:

   networks:
     dokploy-network:
       external: true
   ```
4. Click **Deploy**. Wait until the container shows **Running (Healthy)**.

---

## Phase 5: Execute Initial Database Security Migrations

Before running the API, execute the database role setup and Row-Level Security migrations:

1. In Dokploy, click on the **postgres** service -> Go to the **Terminal** tab (or connect via SSH).
2. Connect to PostgreSQL:
   ```bash
   psql -U chatpilot_migrator -d chatpilot
   ```

3. Paste this SQL snippet to create the least-privilege runtime roles:
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_app') THEN
       CREATE ROLE chatpilot_app WITH LOGIN PASSWORD 'StrongAppPassword_ReplaceMe_789!' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
     END IF;
     IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_analytics') THEN
       CREATE ROLE chatpilot_analytics WITH LOGIN PASSWORD 'StrongAnalyticsPassword_123!' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
     END IF;
   END
   $$;

   GRANT USAGE ON SCHEMA public TO chatpilot_app, chatpilot_analytics;
   ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatpilot_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO chatpilot_app;
   ```
   Type `\q` and press Enter to exit `psql`.

---

## Phase 6: Deploy ChatPilot from GitHub in Dokploy

### Step 1: Create the ChatPilot Service
1. In Dokploy, inside your `ChatPilot-Production` project, click **+ Add Service** -> Select **Compose**.
2. Name: `chatpilot-app`.
3. Select **Source:** `GitHub`.
4. Select your repository: `ahmedadalla/chatpilot`.
5. Select Branch: `main`.
6. Select Compose Path: `docker-compose.prod.yml` (or paste the compose specification below directly).

### Step 2: Production Compose Specification
In the Compose editor in Dokploy, paste:

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: compose/Dockerfile.api
    container_name: chatpilot-api
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
    container_name: chatpilot-worker
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - dokploy-network

  whatsapp-worker:
    build:
      context: .
      dockerfile: compose/Dockerfile.whatsapp-worker
    container_name: chatpilot-whatsapp-worker
    restart: unless-stopped
    env_file:
      - .env
    networks:
      - dokploy-network

  web:
    build:
      context: .
      dockerfile: compose/Dockerfile.web
    container_name: chatpilot-web
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

### Step 3: Configure Production Environment Variables
Click on the **Environment** tab in Dokploy and paste the following configuration:

```env
# Application Environment
NODE_ENV=production
PORT=3001
WEB_PORT=3000
WHATSAPP_WORKER_PORT=3002

# Two-DSN Least Privilege Database Architecture (D-3)
DATABASE_URL_MIGRATOR=postgresql://chatpilot_migrator:StrongMigratorPassword_ReplaceMe_123!@chatpilot-postgres:5432/chatpilot?schema=public
DATABASE_URL=postgresql://chatpilot_app:StrongAppPassword_ReplaceMe_789!@chatpilot-postgres:5432/chatpilot?schema=public

# Redis Connection
REDIS_URL=redis://:StrongRedisPassword_ReplaceMe_456!@chatpilot-redis:6379

# Cryptography & Security (Generate 32-char random strings)
JWT_SECRET=c2VjdXJlX2p3dF9zaWduaW5nX2tleV8zMl9jaGFyYWN0ZXJzX21pbg==
JWT_ACCESS_TTL=900
REFRESH_TOKEN_TTL=604800
KMS_MASTER_KEY=YmFzZTY0X21hc3Rlcl9rZXlfZm9yX2VuY3J5cHRpb25fMzJi==

# Object Storage (S3 / Cloudflare R2 / MinIO)
S3_BUCKET=chatpilot-production-uploads
S3_REGION=auto
S3_ENDPOINT=https://storage.yourdomain.com
S3_ACCESS_KEY_ID=YOUR_STORAGE_KEY_ID
S3_SECRET_ACCESS_KEY=YOUR_STORAGE_SECRET_KEY

# Regional & Localization Defaults (Q-REQ-6)
DEFAULT_COUNTRY=EG
DEFAULT_CURRENCY=EGP
DEFAULT_TIMEZONE=Africa/Cairo
DEFAULT_LOCALE=ar-EG
DEFAULT_CALLING_CODE=+20

# Initial Super Admin Bootstrap (First launch only)
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=SuperAdmin_Password_2026!Secure
BOOTSTRAP_OVERRIDE=true
```
Click **Save**.

### Step 4: Run Prisma Deploy & Apply SQL Migrations
Before the first deployment, run the database migrations from the API container:
1. In Dokploy, click **Deploy** to trigger the initial container builds.
2. Once the image is built, open the **api** container terminal in Dokploy (or via SSH: `docker exec -it chatpilot-api sh`):
   ```bash
   # Run Prisma Migrations
   pnpm --filter @chatpilot/database exec prisma migrate deploy
   ```
3. Apply the remaining SQL security migrations to PostgreSQL:
   ```bash
   psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/001_guc_helpers.sql
   psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/002_preauth_lookups.sql
   psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/003_rls_policies.sql
   psql "$DATABASE_URL_MIGRATOR" -f prisma/migrations/004_pgvector_hnsw.sql
   ```

---

## Phase 7: Configure Domains & Automated SSL Certificates

In Dokploy, Traefik handles reverse proxying and auto-renews SSL certificates via Let's Encrypt.

### Step 1: Configure Web Portal Domain (`apps/web`)
1. Click on the **chatpilot-app** service -> Go to **Domains**.
2. Click **+ Add Domain**.
3. **Select Service / Container:** `web`
4. **Host / Domain:** `app.yourdomain.com`
5. **Port:** `3000`
6. **Certificate:** Select **Let's Encrypt (Production)**.
7. Click **Create Domain**.

### Step 2: Configure API & WebSockets Domain (`apps/api`)
1. In the same **Domains** tab, click **+ Add Domain**.
2. **Select Service / Container:** `api`
3. **Host / Domain:** `api.yourdomain.com`
4. **Port:** `3001`
5. **Certificate:** Select **Let's Encrypt (Production)**.
6. Click **Create Domain**.

Traefik will immediately verify the DNS A records with Let's Encrypt and install the SSL certificates within ~30 seconds.

---

## Phase 8: Verification & First Login

### 1. Verify API Liveness
Run from your local terminal or check in browser:
```bash
curl -I https://api.yourdomain.com/healthz
```
*Expected response:* `HTTP/2 200` with JSON `{ "status": "ok", "uptime": ... }`.

### 2. Verify Startup RLS Self-Test (Readiness)
```bash
curl -s https://api.yourdomain.com/readyz
```
*Expected response:*
```json
{
  "status": "ready",
  "database": "connected",
  "rlsSelfTest": "passed",
  "timestamp": "2026-10-17T..."
}
```
*(If `rlsSelfTest` reports anything other than `passed`, check your database roles to ensure `chatpilot_app` does not have BYPASSRLS).*

### 3. Log In to the Web Portal
1. Open `https://app.yourdomain.com` in your browser.
2. The portal will load in Arabic (`ar-EG`) with full RTL styling and an immediate English toggle.
3. Click **تسجيل الدخول / Sign In**.
4. Log in with your bootstrapped Super Admin credentials:
   * **Email:** `admin@yourdomain.com`
   * **Password:** `SuperAdmin_Password_2026!Secure`
5. Complete your TOTP MFA setup (scan QR code with Google Authenticator or 1Password) and **save your 10 single-use recovery codes**.

### 4. Remove Bootstrap Override
Once you have logged in and confirmed your Super Admin account:
1. In Dokploy, go to **Environment Variables** for `chatpilot-app`.
2. Delete `BOOTSTRAP_OVERRIDE=true` or set it to `false`.
3. Click **Save**. This ensures no subsequent restarts can trigger automatic bootstrapping.

---

## Phase 9: Ongoing Updates & Maintenance

Whenever you push code updates to your GitHub repository:
```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

To deploy the new code in Dokploy:
1. Open the Dokploy dashboard.
2. Go to **ChatPilot-Production** -> `chatpilot-app`.
3. Click **Redeploy** (or enable the **Auto-Deploy Webhook** under the Git tab so GitHub automatically triggers Dokploy on every push to `main`).
4. Dokploy will pull the latest commit, rebuild the containers in the background, and perform a zero-downtime rolling reload.
