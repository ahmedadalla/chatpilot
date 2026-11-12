#!/bin/sh
set -e

# Run Prisma migrations at startup unless explicitly skipped
if [ "${SKIP_MIGRATIONS}" != "true" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy --schema=prisma/schema.prisma
fi

exec "$@"
