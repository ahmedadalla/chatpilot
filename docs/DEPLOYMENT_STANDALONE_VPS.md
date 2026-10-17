# Production Deployment Guide: Deploying ChatPilot Directly on a Linux VPS (Standalone / Without Dokploy)

This guide provides a complete, production-grade guide to deploying ChatPilot directly on a clean Linux Virtual Private Server (VPS) using standard **Docker, Docker Compose, Nginx reverse proxy, Certbot Let's Encrypt SSL, UFW firewall, and Systemd**.

---

## 1. Prerequisites & Server Sizing

* **Server OS:** Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (64-bit clean install).
* **Specs:** 2 vCPU, 4 GB RAM minimum (4 vCPU, 8 GB RAM recommended).
* **Static Public IP:** e.g., `203.0.113.10`.
* **Domain DNS Records:** Point two A-records to your VPS IP address:
  * `app.yourdomain.com` -> `203.0.113.10` (Web UI & BFF)
  * `api.yourdomain.com` -> `203.0.113.10` (REST API & Socket.IO WebSockets)

---

## 2. Step 1: Initial Server Hardening & Base Setup

1. SSH into the server as root:
   ```bash
   ssh root@YOUR_VPS_IP
   ```

2. Update system packages:
   ```bash
   apt update && apt upgrade -y
   apt install -y curl git ufw fail2ban certbot python3-certbot-nginx nginx
   ```

3. Create a dedicated non-root deployment user (`deploy`):
   ```bash
   adduser --gecos "" deploy
   usermod -aG sudo deploy
   ```

4. Configure UFW Firewall (Least Privilege):
   ```bash
   # Allow SSH, HTTP, and HTTPS
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   
   # Enable Firewall
   ufw enable
   ```
   *Notice: Database (5432), Redis (6379), and API ports (3001, 3002) are NEVER opened to the public internet.*

---

## 3. Step 2: Install Docker Engine & Docker Compose Plugin

Run the official Docker installation script on Ubuntu:

```bash
# 1. Install prerequisites
apt install -y ca-certificates gnupg lsb-release

# 2. Add Docker's official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 3. Set up the stable repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker Engine, CLI, and Compose Plugin
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 5. Grant docker permissions to deploy user
usermod -aG docker deploy

# 6. Verify installation
docker --version
docker compose version
```

---

## 4. Step 3: Clone Code & Configure Environment Variables

1. Create application directory and clone the repository:
   ```bash
   mkdir -p /opt/chatpilot
   chown -R deploy:deploy /opt/chatpilot
   su - deploy
   cd /opt/chatpilot
   
   # Clone your repository
   git clone https://github.com/your-org/chatpilot.git .
   ```

2. Generate secure random passwords:
   ```bash
   MIGRATOR_PW=$(openssl rand -base64 24)
   APP_PW=$(openssl rand -base64 24)
   REDIS_PW=$(openssl rand -base64 24)
   JWT_KEY=$(openssl rand -base64 32)
   KMS_KEY=$(openssl rand -base64 32)
   ```

3. Create the production environment file:
   ```bash
   cat <<EOF > /opt/chatpilot/.env.production
   NODE_ENV=production
   PORT=3001
   WEB_PORT=3000
   WHATSAPP_WORKER_PORT=3002

   # Two-DSN Least Privilege Database Architecture (D-3)
   DATABASE_URL_MIGRATOR=postgresql://chatpilot_migrator:${MIGRATOR_PW}@postgres:5432/chatpilot?schema=public
   DATABASE_URL=postgresql://chatpilot_app:${APP_PW}@postgres:5432/chatpilot?schema=public

   # Redis
   REDIS_URL=redis://:${REDIS_PW}@redis:6379

   # Security
   JWT_SECRET=${JWT_KEY}
   JWT_ACCESS_TTL=900
   REFRESH_TOKEN_TTL=604800
   KMS_MASTER_KEY=${KMS_KEY}

   # Object Storage (S3 / R2)
   S3_BUCKET=chatpilot-production-uploads
   S3_REGION=auto
   S3_ENDPOINT=https://your-r2-id.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=YOUR_S3_KEY_ID
   S3_SECRET_ACCESS_KEY=YOUR_S3_SECRET_KEY

   # Regional & Localization Defaults (Q-REQ-6)
   DEFAULT_COUNTRY=EG
   DEFAULT_CURRENCY=EGP
   DEFAULT_TIMEZONE=Africa/Cairo
   DEFAULT_LOCALE=ar-EG
   DEFAULT_CALLING_CODE=+20

   # Super Admin Bootstrap (initial start only)
   SUPER_ADMIN_EMAIL=admin@yourdomain.com
   SUPER_ADMIN_PASSWORD=SetAStrongInitialPassword123!
   BOOTSTRAP_OVERRIDE=true
   EOF

   chmod 600 /opt/chatpilot/.env.production
   ```

---

## 5. Step 4: Production Docker Compose Configuration

Create `/opt/chatpilot/docker-compose.prod.yml`:

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
      POSTGRES_PASSWORD: ${MIGRATOR_PW}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U chatpilot_migrator -d chatpilot']
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - internal-net

  redis:
    image: redis:7-alpine
    container_name: chatpilot-redis
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${REDIS_PW}"]
    volumes:
      - redis_prod_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', '-a', '${REDIS_PW}', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - internal-net

  api:
    build:
      context: .
      dockerfile: compose/Dockerfile.api
    container_name: chatpilot-api
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - '127.0.0.1:3001:3001' # Bound to localhost only!
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal-net

  worker:
    build:
      context: .
      dockerfile: compose/Dockerfile.worker
    container_name: chatpilot-worker
    restart: unless-stopped
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal-net

  whatsapp-worker:
    build:
      context: .
      dockerfile: compose/Dockerfile.whatsapp-worker
    container_name: chatpilot-whatsapp-worker
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - '127.0.0.1:3002:3002' # Bound to localhost only!
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal-net

  web:
    build:
      context: .
      dockerfile: compose/Dockerfile.web
    container_name: chatpilot-web
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - '127.0.0.1:3000:3000' # Bound to localhost only!
    depends_on:
      - api
    networks:
      - internal-net

networks:
  internal-net:
    driver: bridge

volumes:
  postgres_prod_data:
  redis_prod_data:
```

---

## 6. Step 5: Initialize Database & Apply Migrations

1. Start database and cache services first:
   ```bash
   docker compose -f docker-compose.prod.yml up -d postgres redis
   ```

2. Wait for PostgreSQL to become healthy:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

3. Initialize the runtime least-privilege roles in PostgreSQL:
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U chatpilot_migrator -d chatpilot <<EOF
   DO \$\$
   BEGIN
     IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_app') THEN
       CREATE ROLE chatpilot_app WITH LOGIN PASSWORD '${APP_PW}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
     END IF;
     IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_analytics') THEN
       CREATE ROLE chatpilot_analytics WITH LOGIN PASSWORD 'analytics_secret' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
     END IF;
   END
   \$\$;

   GRANT USAGE ON SCHEMA public TO chatpilot_app, chatpilot_analytics;
   ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatpilot_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO chatpilot_app;
   EOF
   ```

4. Apply the SQL migrations in order:
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/001_guc_helpers.sql
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/002_preauth_lookups.sql
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/003_rls_policies.sql
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U chatpilot_migrator -d chatpilot < prisma/migrations/004_pgvector_hnsw.sql
   ```

5. Build and launch all applications:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

6. Verify that all 6 containers are running:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

---

## 7. Step 6: Configure Nginx Reverse Proxy & Let's Encrypt SSL

1. Switch back to root user:
   ```bash
   exit
   ```

2. Create Nginx site configuration for Web (`app.yourdomain.com`):
   ```bash
   cat << 'EOF' > /etc/nginx/sites-available/chatpilot-web.conf
   server {
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
       }
   }
   EOF
   ```

3. Create Nginx site configuration for API & WebSockets (`api.yourdomain.com`):
   ```bash
   cat << 'EOF' > /etc/nginx/sites-available/chatpilot-api.conf
   server {
       server_name api.yourdomain.com;

       # Max upload size for menu images & KB documents (25 MB)
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
   EOF
   ```

4. Enable the configurations:
   ```bash
   ln -s /etc/nginx/sites-available/chatpilot-web.conf /etc/nginx/sites-enabled/
   ln -s /etc/nginx/sites-available/chatpilot-api.conf /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   ```

5. Obtain automated SSL certificates from Let's Encrypt using Certbot:
   ```bash
   certbot --nginx -d app.yourdomain.com -d api.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com
   ```
   Certbot will automatically configure HTTPS redirection and install an auto-renewal systemd timer.

---

## 8. Step 7: Systemd Auto-Start Service

Create a systemd unit file so Docker Compose starts automatically upon system reboot:

1. Create service file:
   ```bash
   cat << 'EOF' > /etc/systemd/system/chatpilot.service
   [Unit]
   Description=ChatPilot Production Docker Stack
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
   EOF
   ```

2. Enable and start service:
   ```bash
   systemctl daemon-reload
   systemctl enable chatpilot.service
   ```

---

## 9. Step 8: Automated Daily Backups with Cron

1. Create backup directory and script:
   ```bash
   mkdir -p /opt/chatpilot/scripts
   cat << 'EOF' > /opt/chatpilot/scripts/backup.sh
   #!/usr/bin/env bash
   set -euo pipefail

   BACKUP_DIR="/var/backups/chatpilot"
   TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
   mkdir -p "$BACKUP_DIR"

   # Execute pg_dump from inside PostgreSQL container
   docker exec chatpilot-postgres pg_dump -U chatpilot_migrator -d chatpilot -F c -b -f "/var/lib/postgresql/data/backup_${TIMESTAMP}.dump"
   docker cp chatpilot-postgres:/var/lib/postgresql/data/backup_${TIMESTAMP}.dump "${BACKUP_DIR}/chatpilot_${TIMESTAMP}.dump"
   docker exec chatpilot-postgres rm "/var/lib/postgresql/data/backup_${TIMESTAMP}.dump"

   # Delete backups older than 7 days
   find "$BACKUP_DIR" -type f -name "*.dump" -mtime +7 -delete

   echo "[$(date)] Backup completed: ${BACKUP_DIR}/chatpilot_${TIMESTAMP}.dump"
   EOF

   chmod +x /opt/chatpilot/scripts/backup.sh
   ```

2. Schedule in root crontab to run daily at 03:00 AM:
   ```bash
   (crontab -l 2>/dev/null; echo "0 3 * * * /opt/chatpilot/scripts/backup.sh >> /var/log/chatpilot-backup.log 2>&1") | crontab -
   ```

---

## 10. Step 9: Zero-Downtime Application Updates

When new code is pushed to your Git repository, execute updates with minimal downtime:

```bash
cd /opt/chatpilot
git pull origin main

# Rebuild images in parallel
docker compose -f docker-compose.prod.yml build api worker whatsapp-worker web

# Perform zero-downtime rolling reload
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.prod.yml up -d --no-deps worker whatsapp-worker
docker compose -f docker-compose.prod.yml up -d --no-deps web

# Clean unused build caches
docker image prune -f
```

---

## 11. Verification Checklist

Execute these checks to confirm the standalone production deployment:

```bash
# 1. Check Liveness Probe (HTTP 200)
curl -I https://api.yourdomain.com/healthz

# 2. Check Readiness Probe (Startup RLS self-test must be "passed")
curl -s https://api.yourdomain.com/readyz | grep "rlsSelfTest"

# 3. View live application logs
docker compose -f /opt/chatpilot/docker-compose.prod.yml logs -f --tail=50 api
```
Open `https://app.yourdomain.com` to log in with your Super Admin credentials.
