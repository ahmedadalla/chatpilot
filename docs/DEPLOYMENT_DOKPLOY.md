# Complete Production Deployment Guide: Deploying ChatPilot in Dokploy

**Repository:** `https://github.com/ahmedadalla/chatpilot.git`  
**Target Platform:** Ubuntu VPS (22.04 or 24.04 LTS)  
**Deployment Tool:** Dokploy (Docker, Traefik, Let's Encrypt)

---

## 1. How Dokploy Deploys ChatPilot (Important Understanding)

ChatPilot is architected as a **single unified Compose Stack**. 

You do **NOT** need to create separate services in Dokploy for `api`, `web`, `postgres`, `redis`, etc. 

Instead:
1. You create **ONE Compose Service** in Dokploy called `chatpilot-app` connected to your GitHub repository `ahmedadalla/chatpilot`.
2. When you click **Deploy**, Docker Compose automatically builds and launches all 6 containers together:
   * **`chatpilot-postgres`**: PostgreSQL 17 + pgvector
   * **`chatpilot-redis`**: Redis 7 Alpine
   * **`chatpilot-api`**: NestJS modular monolith HTTP & Socket.IO server
   * **`chatpilot-worker`**: BullMQ background worker
   * **`chatpilot-whatsapp-worker`**: Isolated Baileys multi-device process (D-21)
   * **`chatpilot-web`**: Next.js App Router Web Portal (BFF)
3. Once deployed, the `api` container and all other containers are active and running. You can then attach your domains (`app.yourdomain.com` and `api.yourdomain.com`) in the Domains tab of that same service.

---

## 2. DNS Records Setup

Add these three **A Records** in your DNS management (Cloudflare / Namecheap / GoDaddy) pointing to your **VPS Public IP**:

| Type | Subdomain | Target IP | Proxy Status (Cloudflare) | Target Container |
|---|---|---|---|---|
| **A** | `app` | `YOUR_VPS_IP` | **DNS Only (Gray Cloud)** | `web:3000` |
| **A** | `api` | `YOUR_VPS_IP` | **DNS Only (Gray Cloud)** | `api:3001` |
| **A** | `dokploy` | `YOUR_VPS_IP` | **DNS Only (Gray Cloud)** | Dokploy UI |

*(Keep Cloudflare set to "DNS Only" initially so Let's Encrypt SSL certificates generate immediately).*

---

## 3. VPS Preparation & Dokploy Installation

Connect to your VPS terminal via SSH:
```bash
ssh root@YOUR_VPS_IP
```

Run these commands to prepare your server, configure firewall rules, install Docker cleanly, and launch Dokploy:

```bash
# 1. Update system packages
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg ufw git fail2ban

# 2. Add 4GB Swap Space (Essential for VPS builds to prevent memory exhaustion and build freezing)
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 3. Configure UFW Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

# 3. Clean any old held packages
rm -f /etc/apt/sources.list.d/docker.list
apt-mark unhold docker-ce docker-ce-cli docker-ce-rootless-extras 2>/dev/null || true

# 4. Set up official Docker repository (Ubuntu noble stable)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  noble stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Install Docker Engine and Compose plugin
apt update
apt-get install -y --allow-change-held-packages docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. Enable Docker and initialize Swarm
systemctl daemon-reload
systemctl enable --now docker
docker swarm init || true

# 7. Run the official Dokploy installer
curl -sSL https://dokploy.com/install.sh | sh
```

When installation completes, open `http://YOUR_VPS_IP:3000` in your browser. Create your administrator account and secure it with `https://dokploy.yourdomain.com` in Dokploy Settings -> Server Domain.

---

## 4. Connect GitHub in Dokploy

1. Go to **GitHub** -> Profile (top right) -> **Settings** -> **Developer Settings** -> **Personal access tokens (classic)** -> **Generate new token (classic)**.
2. Token Name: `Dokploy VPS`
3. Scopes: Check **`repo`** (Full control of private repositories).
4. Generate and copy the token (`ghp_...`).
5. In Dokploy: Go to **Settings** -> **Git Providers** -> **GitHub** -> Click **+ Add Credential** -> Paste your token -> Click **Save**.

---

## 5. Deploy ChatPilot in Dokploy (The Complete Stack)

### Step 1: Create the Compose Service
1. In the Dokploy sidebar, click **Projects** -> Click **+ Create Project**.
2. Project Name: `ChatPilot-Production` -> Click **Create**.
3. Inside the project, click **+ Add Service** -> Select **Compose**.
4. Name the service: `chatpilot-app` -> Click **Create**.

### Step 2: Connect GitHub Repository
1. In the newly created `chatpilot-app` service:
   * **Source Type:** Select `GitHub`.
   * **Repository:** Select `ahmedadalla/chatpilot`.
   * **Branch:** Select `main`.
   * **Compose Path:** `docker-compose.prod.yml` (or `docker-compose.yml`).
2. Click **Save**.

### Step 3: Configure Environment Variables
Click on the **Environment** tab of the `chatpilot-app` service in Dokploy and paste:

```env
# Application Environment
NODE_ENV=production
PORT=3001
WEB_PORT=3000
WHATSAPP_WORKER_PORT=3002

# Database Passwords & DSNs (Two-DSN Least Privilege Architecture D-3)
POSTGRES_DB=chatpilot
POSTGRES_USER=chatpilot_migrator
POSTGRES_PASSWORD=StrongMigratorPassword_ReplaceMe_123!
REDIS_PASSWORD=StrongRedisPassword_ReplaceMe_456!

# Runtime Connections (Internal container networking)
DATABASE_URL_MIGRATOR=postgresql://chatpilot_migrator:StrongMigratorPassword_ReplaceMe_123!@postgres:5432/chatpilot?schema=public
DATABASE_URL=postgresql://chatpilot_app:StrongAppPassword_ReplaceMe_789!@postgres:5432/chatpilot?schema=public
REDIS_URL=redis://:StrongRedisPassword_ReplaceMe_456!@redis:6379

# Cryptography & Security
JWT_SECRET=c2VjdXJlX2p3dF9zaWduaW5nX2tleV8zMl9jaGFyYWN0ZXJzX21pbg==
JWT_ACCESS_TTL=900
REFRESH_TOKEN_TTL=604800
KMS_MASTER_KEY=YmFzZTY0X21hc3Rlcl9rZXlfZm9yX2VuY3J5cHRpb25fMzJi==

# Object Storage (S3 / Cloudflare R2)
S3_BUCKET=chatpilot-production-uploads
S3_REGION=auto
S3_ENDPOINT=https://storage.yourdomain.com
S3_ACCESS_KEY_ID=YOUR_STORAGE_KEY_ID
S3_SECRET_ACCESS_KEY=YOUR_STORAGE_SECRET_KEY

# Regional & Localization Defaults (Egypt Q-REQ-6)
DEFAULT_COUNTRY=EG
DEFAULT_CURRENCY=EGP
DEFAULT_TIMEZONE=Africa/Cairo
DEFAULT_LOCALE=ar-EG
DEFAULT_CALLING_CODE=+20

# Initial Super Admin Bootstrap (Initial boot only)
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=SuperAdmin_Password_2026!Secure
BOOTSTRAP_OVERRIDE=true
```
Click **Save**.

### Step 4: Click Deploy
Click **Deploy** in Dokploy.

*Note on the previous build error:* The previous build error (`spawn git ENOENT` when installing `@whiskeysockets/baileys`) occurred because Alpine Linux lacked `git` during Docker build. This has been resolved in the repository Dockerfiles by installing `git` and build tools in the base image.

Docker Compose will build and launch all 6 containers:
- `chatpilot-postgres` (PostgreSQL 17 + pgvector)
- `chatpilot-redis` (Redis 7)
- `chatpilot-api` (NestJS API & Socket.IO)
- `chatpilot-worker` (Background BullMQ worker)
- `chatpilot-whatsapp-worker` (Dedicated Baileys multi-device process)
- `chatpilot-web` (Next.js Web Portal)

You will see all containers turn **Green (Running)** in Dokploy!

---

## 6. Run Database Migrations & Security Roles

Now that the containers are running on your VPS, execute the database migrations from your VPS terminal:

```bash
# 1. Initialize runtime least-privilege roles in PostgreSQL:
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot << 'EOF'
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
EOF

# 2. Run Prisma schema migrations from inside the API container:
docker exec -it chatpilot-api pnpm --filter @chatpilot/database exec prisma migrate deploy

# 3. Apply the SQL security migrations:
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/001_guc_helpers.sql
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/002_preauth_lookups.sql
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/003_rls_policies.sql
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/004_pgvector_hnsw.sql
```

---

## 7. Configure Domains & Free SSL in Dokploy

In Dokploy, Traefik routes domains to the internal containers without any port conflicts:

1. Click on the **chatpilot-app** Compose service in Dokploy.
2. Go to the **Domains** tab.
3. **Configure Web Portal Domain:**
   * Click **+ Add Domain**.
   * **Service / Container:** Select **`web`** (or type `web`).
   * **Domain:** `app.yourdomain.com`
   * **Container Port:** `3000`
   * **Certificate:** Select **Let's Encrypt (Production)**.
   * Click **Create Domain**.
4. **Configure API Domain (WebSockets & REST):**
   * Click **+ Add Domain**.
   * **Service / Container:** Select **`api`** (or type `api`).
   * **Domain:** `api.yourdomain.com`
   * **Container Port:** `3001`
   * **Certificate:** Select **Let's Encrypt (Production)**.
   * Click **Create Domain**.

Traefik will automatically issue and install the SSL certificates.

---

## 8. Verification & Super Admin Login

1. **Verify API Liveness:**
   ```bash
   curl -I https://api.yourdomain.com/healthz
   ```
   *Response:* `HTTP/2 200`

2. **Verify Startup RLS Self-Test (Readiness):**
   ```bash
   curl -s https://api.yourdomain.com/readyz
   ```
   *Response:*
   ```json
   {
     "status": "ready",
     "database": "connected",
     "rlsSelfTest": "passed",
     "timestamp": "2026-10-17T..."
   }
   ```

3. **Access the Web Portal:**
   Open `https://app.yourdomain.com` in your browser.
   * The portal will load in Arabic (`ar-EG`) with RTL layout and English switch.
   * Log in with:
     * **Email:** `admin@yourdomain.com`
     * **Password:** `SuperAdmin_Password_2026!Secure`
   * Complete the TOTP MFA setup (Google Authenticator) and save your 10 recovery codes.

4. **Security Cleanup:**
   In Dokploy -> `chatpilot-app` -> **Environment Variables**, delete `BOOTSTRAP_OVERRIDE=true` and click **Save** so no subsequent restarts trigger bootstrap logic.
