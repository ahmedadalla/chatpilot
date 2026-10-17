# ChatPilot Database Migration & Disaster Recovery Runbook

**Status:** Operational Runbook  
**Related:** `ARCHITECTURE.md` §11.2, `IMPLEMENTATION_PLAN.md` Phase P9

---

## 1. Zero-Downtime Migration Principles

Prisma does not provide native `migrate rollback` commands. Therefore, database schema evolution in ChatPilot follows the **forward-corrective expand-contract pattern**:

### Rule 1: Non-Breaking Additions Only
* **New Columns:** Must always be `NULLABLE` or carry a safe `DEFAULT` value.
* **New Tables:** Can be added and RLS policies attached before application code starts reading/writing them.
* **New Indexes:** Must be created concurrently (`CREATE INDEX CONCURRENTLY ...`) in raw SQL migrations to avoid exclusive table locks on high-traffic operational tables (`orders`, `messages`).

### Rule 2: Two-Step Column Renames / Deletions (Expand -> Migrate -> Contract)
1. **Step 1 (Expand):** Add the new column as nullable. Deploy code that writes to both old and new columns, reading from the old column.
2. **Step 2 (Migrate):** Backfill data from old column to new column using a batch script.
3. **Step 3 (Contract):** Deploy code reading only from the new column. Remove old column in a subsequent scheduled maintenance migration.

---

## 2. Pre-Migration Deployment Checklist

Prior to applying any migration in production:
- [ ] Verify migration executes cleanly on a staging database populated with a sanitized production-volume snapshot.
- [ ] Run `pnpm test:integration --suite=rls` to verify that no new table omitted `FORCE ROW LEVEL SECURITY`.
- [ ] Confirm the migration script runs under `DATABASE_URL_MIGRATOR` (`chatpilot_migrator`).
- [ ] Verify that application runtime role (`chatpilot_app`) is granted least-privilege permissions on any newly created table.
- [ ] Perform a manual backup snapshot before running DDL.

---

## 3. Disaster Recovery: Daily Automated Backup & Restore Drill

### 3.1 Daily Backup Script
Executed via cron on the Dokploy host at 02:00 UTC daily:

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/chatpilot"
BACKUP_FILE="${BACKUP_DIR}/chatpilot_backup_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Starting pg_dump for ChatPilot database..."
pg_dump -U chatpilot_migrator -h localhost -d chatpilot \
  -F c -b -v -f "$BACKUP_FILE"

# Upload to encrypted private S3/R2 backup bucket
aws s3 cp "$BACKUP_FILE" "s3://${S3_BACKUP_BUCKET}/db-backups/chatpilot_${TIMESTAMP}.dump" \
  --sse aws:kms

# Retain local backups for 7 days
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +7 -delete

echo "Backup complete: ${BACKUP_FILE}"
```

### 3.2 Backup Restore Verification Drill
A backup that has never been restored is not a verified backup. Once per quarter, run the restore verification drill on a clean staging container:

```bash
# 1. Spin up clean PostgreSQL 17 + pgvector container
docker run --name pg-restore-drill -e POSTGRES_PASSWORD=restore_pass -p 5439:5432 -d pgvector/pgvector:pg17

# 2. Re-create database and roles
psql -h localhost -p 5439 -U postgres -c "CREATE ROLE chatpilot_migrator WITH LOGIN SUPERUSER PASSWORD 'migrator_pass';"
psql -h localhost -p 5439 -U postgres -c "CREATE DATABASE chatpilot OWNER chatpilot_migrator;"

# 3. Restore dump file
pg_restore -h localhost -p 5439 -U chatpilot_migrator -d chatpilot -v "$BACKUP_FILE"

# 4. Verify table row counts and RLS integrity
psql -h localhost -p 5439 -U chatpilot_migrator -d chatpilot -c "
  SELECT schemaname, tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public';
"
```
Ensure all tenant tables report `rowsecurity = true`.
