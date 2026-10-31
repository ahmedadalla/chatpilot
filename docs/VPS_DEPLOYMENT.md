# ChatPilot: Production VPS Deployment Guide

**Target Environment:** Standard Linux Virtual Private Server (Ubuntu 22.04 LTS / 24.04 LTS)  
**Deployment Method:** Direct Docker Compose, Nginx Reverse Proxy & Certbot TLS  
**Document Status:** Complete, Authoritative Production Standard  

---

## Table of Contents
1. [Deployment Overview and Architecture](#1-deployment-overview-and-architecture)
2. [VPS Prerequisites](#2-vps-prerequisites)
3. [Initial Server Setup](#3-initial-server-setup)
4. [Application Installation](#4-application-installation)
5. [Production Environment Variables](#5-production-environment-variables)
6. [Database Setup and Migrations](#6-database-setup-and-migrations)
7. [Production Build and Deployment](#7-production-build-and-deployment)
8. [Domain, Reverse Proxy, and HTTPS](#8-domain-reverse-proxy-and-https)
9. [Post-Deployment Verification](#9-post-deployment-verification)
10. [Application Updates and Rollbacks](#10-application-updates-and-rollbacks)
11. [Production Security](#11-production-security)
12. [Monitoring and Maintenance](#12-monitoring-and-maintenance)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Deployment Overview and Architecture

### 1.1 Architecture & Component Topology
ChatPilot is deployed as a containerized multi-tier stack orchestrated by Docker Compose on a single Linux VPS. Ingress traffic is managed by host-level Nginx, providing TLS termination, HTTP/2 multiplexing, WebSocket protocol upgrading, and reverse proxying to isolated local ports.

```
                    Internet (Client Browsers & Webhooks)
                                    │
                                    ▼
                [ Public Ports 80 & 443 on VPS Host ]
                                    │
                        Host-Level Nginx Reverse Proxy
                     (TLS Termination via Let's Encrypt)
                                    │
            ┌───────────────────────┴───────────────────────┐
            │ (Reverse Proxy to 127.0.0.1:3000)             │ (Reverse Proxy to 127.0.0.1:3001)
            ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│        chatpilot-web          │               │         chatpilot-api         │
│     (Next.js App Router)      │───Internal───▶│    (NestJS Modular Monolith)  │
│    BFF & Role Portals         │               │ REST API, Webhooks, Socket.IO │
└───────────────────────────────┘               └───────────────────────────────┘
                                                                │
            ┌───────────────────┬───────────────────────────────┼───────────────────────────────┐
            │                   │                               │                               │
            ▼                   ▼                               ▼                               ▼
┌────────────────────────┐┌─────────────┐             ┌────────────────────┐          ┌────────────────────┐
│   chatpilot-postgres   ││chatpilot-   │             │  chatpilot-worker  │          │ chatpilot-         │
│ (PostgreSQL 17+pgvector││   redis     │             │  (BullMQ Consumer) │          │   whatsapp-worker  │
│  Forced Tenant RLS)    ││(Redis 7)    │             │ Background Queues  │          │  (Baileys Socket)  │
└────────────────────────┘└─────────────┘             └────────────────────┘          └────────────────────┘
```

### 1.2 Responsibilities of Stack Components
1. **Host Nginx:** Terminates HTTPS, forces HTTP-to-HTTPS redirect, sets security headers, and routes `app.yourdomain.com` to port 3000 and `api.yourdomain.com` to port 3001.
2. **`chatpilot-web` (`apps/web`):** Next.js App Router acting as the Backend-For-Frontend (BFF). Serves server-rendered role portals (Admin, Company, Branch, Kitchen, Delivery) with Arabic RTL-first (`ar-EG`) and English (`en-US`) support.
3. **`chatpilot-api` (`apps/api`):** NestJS modular monolith handling business logic, authentication (Argon2id, rotating CAS refresh tokens, TOTP MFA), state machine transitions, and Socket.IO real-time gateways.
4. **`chatpilot-worker` (`apps/worker`):** BullMQ background consumer handling asynchronous tasks: daily analytics aggregation, order auto-cancellation sweepers, and notification delivery.
5. **`chatpilot-whatsapp-worker` (`apps/whatsapp-worker`):** Dedicated Baileys multi-device process. Isolated from the main API process to ensure long-lived WebSocket reconnect cycles or memory pressure never degrade API availability (D-21).
6. **`chatpilot-postgres`:** PostgreSQL 17 with `pgvector` 0.8+ extension, enforcing PostgreSQL Row-Level Security (RLS) on all tenant tables via transaction-local GUCs (`app.company_id`, `app.branch_id`, `app.scope`).
7. **`chatpilot-redis`:** Redis 7 Alpine instance backing BullMQ job queues, real-time Socket.IO adapter pub/sub, and session revocation channels.

### 1.3 Port Isolation & Network Boundary
* **Public Ports (0.0.0.0):** Only `22` (SSH), `80` (HTTP), and `443` (HTTPS) are exposed through the firewall.
* **Internal Application Ports (127.0.0.1 on Host):**
  * Port `3000`: `chatpilot-web` (bound exclusively to loopback).
  * Port `3001`: `chatpilot-api` (bound exclusively to loopback).
  * Port `3002`: `chatpilot-whatsapp-worker` (internal communication / optional diagnostics).
* **Private Network (Docker Bridge `chatpilot-net`):**
  * Port `5432`: PostgreSQL (never exposed to host or internet).
  * Port `6379`: Redis (never exposed to host or internet).

---

## 2. VPS Prerequisites

### 2.1 Hardware Requirements
* **Operating System:** Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (64-bit clean minimal installation).
* **CPU:** 2 vCPU minimum (4 vCPU recommended for high concurrent order volumes).
* **RAM:** 4 GB physical RAM minimum + 4 GB Swap space (8 GB physical RAM recommended).
* **Storage:** 40 GB NVMe / SSD minimum with at least 15 GB free disk space.
* **Network:** Static public IPv4 address.

### 2.2 Domain & DNS Requirements
Configure two **A Records** pointing to your VPS public IPv4 address at your domain registrar or Cloudflare (set proxy status to **DNS Only / Gray Cloud** during initial SSL verification):

| Record Type | Subdomain / Name | Destination IP | Purpose |
|---|---|---|---|
| **A** | `app.yourdomain.com` | `YOUR_VPS_PUBLIC_IP` | Next.js Web UI & Portal |
| **A** | `api.yourdomain.com` | `YOUR_VPS_PUBLIC_IP` | REST API, Webhooks & Socket.IO |

---

## 3. Initial Server Setup

Log in to the VPS via SSH as `root`:
```bash
ssh root@YOUR_VPS_IP
```

### 3.1 Update Base System Packages
```bash
apt-get update && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw git fail2ban htop wget
```

### 3.2 Create Swap Space (Critical for VPS Stability)
Cloud VPS instances (especially on AWS, Hetzner, or DigitalOcean) often ship without swap memory. Compiling TypeScript and Docker images can trigger Linux Out-Of-Memory (OOM) kills without swap:
```bash
# Check if swap exists
free -h

# Create 4GB swapfile if none exists
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Verify active swap
free -h
```

### 3.3 Configure UFW Firewall
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
```

### 3.4 Create Dedicated Deployment User (`deploy`)
```bash
# Create user without interactive prompts
adduser --gecos "" --disabled-password deploy
usermod -aG sudo deploy

# Set up SSH authorized keys for deploy user
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
```

---

## 4. Application Installation

### 4.1 Install Docker Engine & Docker Compose Plugin
Install official Docker Engine packages on Ubuntu:
```bash
# Remove outdated packages if present
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add official Docker GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add repository (using Ubuntu noble stable for 24.04, jammy for 22.04)
UBUNTU_CODENAME=$(lsb_release -cs)
if [ "$UBUNTU_CODENAME" != "jammy" ] && [ "$UBUNTU_CODENAME" != "noble" ]; then
  UBUNTU_CODENAME="noble"
fi

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  ${UBUNTU_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y --allow-change-held-packages docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add deploy user to docker group
usermod -aG docker deploy

# Verify Docker installation
docker --version
docker compose version
```

### 4.2 Clone Repository & Prepare Directory Structure
```bash
# Create application root directory
mkdir -p /opt/chatpilot
chown -R deploy:deploy /opt/chatpilot

# Switch to deploy user
su - deploy
cd /opt/chatpilot

# Clone repository
git clone https://github.com/ahmedadalla/chatpilot.git .
git checkout main
```

---

## 5. Production Environment Variables

### 5.1 Create `.env.production`
Copy the production template:
```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

### 5.2 Generate Cryptographically Secure Secrets
Run these commands to generate random 256-bit credentials:
```bash
# Generates 32-byte passwords and base64 keys
MIGRATOR_PW=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
APP_PW=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
REDIS_PW=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
JWT_SECRET=$(openssl rand -base64 32)
KMS_KEY=$(openssl rand -base64 32)

echo "Postgres Migrator PW: $MIGRATOR_PW"
echo "Postgres App PW:      $APP_PW"
echo "Redis PW:             $REDIS_PW"
```

### 5.3 Complete Production Variables Reference
Edit `/opt/chatpilot/.env.production` (`nano .env.production`) and populate every variable:

```env
# ==============================================================================
# ChatPilot Production Environment Configuration
# ==============================================================================

# Application Runtime Modes
NODE_ENV=production
PORT=3001
WEB_PORT=3000
WHATSAPP_WORKER_PORT=3002

# ------------------------------------------------------------------------------
# PostgreSQL 17 + pgvector (Two-DSN Least Privilege Model - D-3)
# ------------------------------------------------------------------------------
POSTGRES_DB=chatpilot
POSTGRES_USER=chatpilot_migrator
POSTGRES_PASSWORD=YOUR_MIGRATOR_PASSWORD_HERE

# 1. Migrator DSN (used only during DDL and schema migrations)
DATABASE_URL_MIGRATOR=postgresql://chatpilot_migrator:YOUR_MIGRATOR_PASSWORD_HERE@postgres:5432/chatpilot?schema=public

# 2. Runtime Application DSN (chatpilot_app role: NO BYPASSRLS, not a superuser)
DATABASE_URL=postgresql://chatpilot_app:YOUR_APP_PASSWORD_HERE@postgres:5432/chatpilot?schema=public

# ------------------------------------------------------------------------------
# Redis 7 Configuration
# ------------------------------------------------------------------------------
REDIS_PASSWORD=YOUR_REDIS_PASSWORD_HERE
REDIS_URL=redis://:YOUR_REDIS_PASSWORD_HERE@redis:6379

# ------------------------------------------------------------------------------
# Cryptography & Security Secrets
# ------------------------------------------------------------------------------
# Minimum 32-character random string for HMAC-SHA256 signing
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_STRING_HERE
JWT_ACCESS_TTL=900
REFRESH_TOKEN_TTL=604800

# Envelope Encryption Master Key (D-13) - 256-bit base64 key
KMS_MASTER_KEY=YOUR_GENERATED_KMS_MASTER_KEY_HERE==

# ------------------------------------------------------------------------------
# S3 / Cloudflare R2 Object Storage
# ------------------------------------------------------------------------------
S3_BUCKET=chatpilot-production-uploads
S3_REGION=auto
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=YOUR_S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=YOUR_S3_SECRET_ACCESS_KEY

# ------------------------------------------------------------------------------
# Regional & Localization Defaults (Q-REQ-6)
# ------------------------------------------------------------------------------
DEFAULT_COUNTRY=EG
DEFAULT_CURRENCY=EGP
DEFAULT_TIMEZONE=Africa/Cairo
DEFAULT_LOCALE=ar-EG
DEFAULT_CALLING_CODE=+20

# ------------------------------------------------------------------------------
# Initial Super Admin Bootstrap (Initial Start Only)
# Remove BOOTSTRAP_OVERRIDE after first successful login
# ------------------------------------------------------------------------------
SUPER_ADMIN_EMAIL=admin@yourdomain.com
SUPER_ADMIN_PASSWORD=SetAStrongInitialSuperAdminPassword123!
BOOTSTRAP_OVERRIDE=true
```

### 5.4 Create `.env` Symlink (Essential for Docker Compose)
Docker Compose by default reads `.env` for variable interpolation. Creating a symlink ensures that all `docker compose` commands (like `ps`, `up`, `logs`) automatically load your production variables without needing `--env-file` every time:

```bash
cd /opt/chatpilot
ln -sf .env.production .env
```

---

## 6. Database Setup and Migrations

The database follows a **Two-DSN Least Privilege Model (D-3, D-4)**. The application runtime role (`chatpilot_app`) has no `BYPASSRLS` privileges and cannot modify schemas.

### 6.1 Start Database and Cache Backing Services
```bash
cd /opt/chatpilot
ln -sf .env.production .env
docker compose -f docker-compose.prod.yml up -d postgres redis
```
Verify both containers report `healthy`:
```bash
docker compose -f docker-compose.prod.yml ps
```
*(If postgres was previously started with an empty password and is in a restart loop, run `docker compose -f docker-compose.prod.yml down -v` to reset the volume and start clean).*

### 6.2 Initialize Security Roles & Grants
Execute `000_init_roles.sql` into the running PostgreSQL container as `chatpilot_migrator`. Substitute `YOUR_APP_PASSWORD_HERE` with the actual value from `.env.production`:

```bash
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot << 'EOF'
DO $$
BEGIN
  -- 1. chatpilot_app: Runtime application role (NO BYPASSRLS)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_app') THEN
    CREATE ROLE chatpilot_app WITH LOGIN PASSWORD 'YOUR_APP_PASSWORD_HERE' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  -- 2. chatpilot_analytics: Restricted role for analytics rollups
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_analytics') THEN
    CREATE ROLE chatpilot_analytics WITH LOGIN PASSWORD 'YOUR_APP_PASSWORD_HERE' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Schema usage and least-privilege table grants
GRANT USAGE ON SCHEMA public TO chatpilot_app, chatpilot_analytics;
ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatpilot_app;
ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO chatpilot_app;
EOF
```

### 6.3 Deploy Prisma Schema Tables
Run Prisma migrate deploy inside a temporary migration container:
```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="$DATABASE_URL_MIGRATOR" \
  api pnpm --filter @chatpilot/database exec prisma db push --schema=prisma/schema.prisma
```

### 6.4 Apply Row-Level Security & pgvector Extensions
Apply the raw SQL security migrations in sequence:
```bash
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/001_guc_helpers.sql
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/002_preauth_lookups.sql
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/003_rls_policies.sql
docker exec -i chatpilot-postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/004_pgvector_hnsw.sql
```

### 6.5 Verify Database RLS Enforcement
Verify that un-scoped reads fail closed with 0 rows:
```bash
docker exec -i chatpilot-postgres psql -U chatpilot_app -d chatpilot -c "SELECT count(*) FROM companies;"
```
*Expected Output:* `count: 0` (even if companies exist, the absence of tenant GUCs forces 0 rows).

---

## 7. Production Build and Deployment

### 7.1 Build and Launch Application Containers
Run Docker Compose in production mode:
```bash
cd /opt/chatpilot
docker compose -f docker-compose.prod.yml up -d --build
```

### 7.2 Verify Running Services
```bash
docker compose -f docker-compose.prod.yml ps
```
All six containers must show status `Up` or `Up (healthy)`:
* `chatpilot-postgres` (pgvector:pg17)
* `chatpilot-redis` (redis:7-alpine)
* `chatpilot-api` (NestJS API on `127.0.0.1:3001`)
* `chatpilot-worker` (BullMQ consumer)
* `chatpilot-whatsapp-worker` (Baileys on `127.0.0.1:3002`)
* `chatpilot-web` (Next.js on `127.0.0.1:3000`)

---

## 8. Domain, Reverse Proxy, and HTTPS

Switch back to the `root` user to configure Nginx and Certbot:
```bash
exit # or sudo su
```

### 8.1 Install Nginx & Certbot
```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

### 8.2 Create Nginx Virtual Host for Web Portal (`app.yourdomain.com`)
Create `/etc/nginx/sites-available/chatpilot-web.conf`:
```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

### 8.3 Create Nginx Virtual Host for API & Socket.IO (`api.yourdomain.com`)
Create `/etc/nginx/sites-available/chatpilot-api.conf`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Max upload limit for menu images and KB documents
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### 8.4 Enable Sites and Obtain Let's Encrypt Certificates
```bash
# Enable virtual hosts
ln -s /etc/nginx/sites-available/chatpilot-web.conf /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/chatpilot-api.conf /etc/nginx/sites-enabled/

# Test syntax
nginx -t

# Reload Nginx
systemctl reload nginx

# Request automated certificates and configure HTTPS redirects
certbot --nginx \
  -d app.yourdomain.com \
  -d api.yourdomain.com \
  --non-interactive \
  --agree-tos \
  -m admin@yourdomain.com
```

---

## 9. Post-Deployment Verification

### 9.1 Verification Commands Checklist
Execute the following verification commands:

```bash
# 1. API Liveness Check (Should return HTTP 200)
curl -I https://api.yourdomain.com/healthz

# 2. Database RLS Startup Self-Test (Should return "rlsSelfTest": "passed")
curl -s https://api.yourdomain.com/readyz

# 3. Prometheus Metrics Endpoint
curl -s https://api.yourdomain.com/metrics | grep "process_uptime_seconds"

# 4. Web Portal Response (HTTP 200)
curl -I https://app.yourdomain.com
```

### 9.2 First Admin Login & TOTP Setup
1. Open `https://app.yourdomain.com` in your web browser.
2. Verify that the interface renders in Arabic with proper RTL alignment.
3. Click **تسجيل الدخول / Sign In**.
4. Log in using `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.
5. Complete TOTP MFA registration using Google Authenticator or 1Password.
6. **Securely store the 10 single-use recovery codes.**

### 9.3 Post-Bootstrap Security Clean-Up
Once logged in, remove the bootstrap flag to prevent re-initialization on subsequent restarts:
```bash
su - deploy
cd /opt/chatpilot
sed -i 's/BOOTSTRAP_OVERRIDE=true/BOOTSTRAP_OVERRIDE=false/' .env.production
```

---

## 10. Application Updates and Rollbacks

### 10.1 Safe Update Procedure
To deploy a new commit from the Git repository:
```bash
su - deploy
cd /opt/chatpilot

# 1. Backup current database state
/opt/chatpilot/scripts/backup.sh

# 2. Pull latest release
git fetch origin
git checkout main
git pull origin main

# 3. Apply schema migrations if modified
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @chatpilot/database exec prisma migrate deploy

# 4. Rebuild images with layer caching
docker compose -f docker-compose.prod.yml build api worker whatsapp-worker web

# 5. Rolling restart of containers
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.prod.yml up -d --no-deps worker whatsapp-worker
docker compose -f docker-compose.prod.yml up -d --no-deps web

# 6. Verify health
curl -s https://api.yourdomain.com/readyz
```

### 10.2 Rollback Procedure
If a deployment fails:
```bash
su - deploy
cd /opt/chatpilot

# 1. Check out previous working commit
git checkout <PREVIOUS_COMMIT_HASH>

# 2. Rebuild and restart application containers
docker compose -f docker-compose.prod.yml up -d --build

# 3. If database restore is required due to schema changes:
# docker compose -f docker-compose.prod.yml stop api worker whatsapp-worker
# /opt/chatpilot/scripts/restore.sh /var/backups/chatpilot/chatpilot_backup_YYYYMMDD.dump
# docker compose -f docker-compose.prod.yml start api worker whatsapp-worker
```

---

## 11. Production Security

### 11.1 Least-Privilege Database Access
* The `chatpilot_app` database user holds zero DDL permissions and `NOBYPASSRLS`.
* All queries run inside transactions where GUCs (`app.company_id`, `app.branch_id`) are applied locally via `set_config(..., true)`. Connections returned to the pool immediately revert to zero-tenant context.

### 11.2 Environment File Hardening
* `.env.production` is owned by `deploy:deploy` with strict `0600` permissions (`-rw-------`).
* `.gitignore` includes `.env*` to prevent accidental commit of production credentials.

### 11.3 Systemd Auto-Start Service
Ensure the Docker stack restarts automatically on system reboot:
Create `/etc/systemd/system/chatpilot.service` as `root`:
```ini
[Unit]
Description=ChatPilot Docker Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/chatpilot
User=deploy
Group=deploy
ExecStart=/usr/bin/docker compose -f /opt/chatpilot/docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f /opt/chatpilot/docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```
Enable the service:
```bash
systemctl daemon-reload
systemctl enable chatpilot.service
```

---

## 12. Monitoring and Maintenance

### 12.1 Automated Daily Backups
Create backup directory and script:
```bash
mkdir -p /opt/chatpilot/scripts /var/backups/chatpilot
chown -R deploy:deploy /opt/chatpilot/scripts /var/backups/chatpilot
```

Create `/opt/chatpilot/scripts/backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/chatpilot"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/chatpilot_${TIMESTAMP}.dump"

# Run pg_dump from inside PostgreSQL container
docker exec chatpilot-postgres pg_dump -U chatpilot_migrator -d chatpilot -F c -b -f "/var/lib/postgresql/data/temp_backup.dump"
docker cp chatpilot-postgres:/var/lib/postgresql/data/temp_backup.dump "$BACKUP_FILE"
docker exec chatpilot-postgres rm -f "/var/lib/postgresql/data/temp_backup.dump"

# Retain backups for 7 days
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +7 -delete

echo "[$(date)] Backup completed successfully: $BACKUP_FILE"
```
Make executable:
```bash
chmod +x /opt/chatpilot/scripts/backup.sh
```

Add to cron (`crontab -e` as `root`):
```cron
0 3 * * * /opt/chatpilot/scripts/backup.sh >> /var/log/chatpilot-backup.log 2>&1
```

### 12.2 Inspecting Live Logs
```bash
su - deploy
cd /opt/chatpilot

# Follow API logs
docker compose -f docker-compose.prod.yml logs -f --tail=100 api

# Follow WhatsApp worker logs
docker compose -f docker-compose.prod.yml logs -f --tail=100 whatsapp-worker

# Follow background worker logs
docker compose -f docker-compose.prod.yml logs -f --tail=100 worker
```

---

## 13. Troubleshooting

### 13.1 `docker: not found` or Installation Errors
* **Symptom:** Docker installer fails with package hold errors or missing release.
* **Fix:** Unhold packages and install Docker with `--allow-change-held-packages`:
  ```bash
  apt-mark unhold docker-ce docker-ce-cli docker-ce-rootless-extras 2>/dev/null || true
  apt-get install -y --allow-change-held-packages docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  ```

### 13.2 Build Memory Exhaustion or Freezing
* **Symptom:** Build hangs during `pnpm install` or `next build` on a 2GB/4GB VPS.
* **Fix:** Add a 4GB swapfile (Section 3.2).

### 13.3 `RLS_SELF_TEST_FAILED_DATA_LEAK` (HTTP 503 on `/readyz`)
* **Symptom:** `/readyz` returns 503 with reason `RLS_SELF_TEST_FAILED_DATA_LEAK`.
* **Cause:** The `DATABASE_URL` is connected with superuser privileges or `chatpilot_app` role was granted `BYPASSRLS`.
* **Fix:** Re-run the role revocation in Section 6.2:
  ```sql
  ALTER ROLE chatpilot_app NOBYPASSRLS NOSUPERUSER;
  ```

### 13.4 WebSocket Connection Drops (Socket.IO)
* **Symptom:** Socket.IO fails to connect or repeatedly falls back to long-polling.
* **Fix:** Ensure Nginx configuration includes `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";` with read timeouts set to `86400s`.

### 13.5 WhatsApp Session Disconnects
* **Symptom:** QR code pairing drops after phone screen lock.
* **Fix:** The dedicated `whatsapp-worker` runs an automatic reconnect loop with exponential backoff. Check logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f whatsapp-worker
  ```
