#!/bin/bash
set -euo pipefail

# ==============================================================================
# Kasir FOSS - PostgreSQL Disaster Recovery / Restore Script
# ==============================================================================

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path_to_backup.sql.gz|path_to_backup.sql> [--force]"
    exit 1
fi

BACKUP_PATH="$1"
FORCE_FLAG="${2:-}"

POSTGRES_USER="${POSTGRES_USER:-kasir}"
POSTGRES_DB="${POSTGRES_DB:-kasir_db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if [ ! -f "${BACKUP_PATH}" ]; then
    echo "ERROR: Backup file does not exist: ${BACKUP_PATH}"
    exit 1
fi

echo "======================================================"
echo " WARNING: RESTORING DATABASE"
echo " Target DB: ${POSTGRES_DB} on ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo " Source:    ${BACKUP_PATH}"
echo "======================================================"

if [ "${FORCE_FLAG}" != "--force" ]; then
    read -rp "Are you sure you want to overwrite '${POSTGRES_DB}' with this backup? [y/N]: " CONFIRM
    if [[ ! "${CONFIRM}" =~ ^[yY]$ ]]; then
        echo "Restore cancelled by user."
        exit 0
    fi
fi

# Execute Restore
if [[ "${BACKUP_PATH}" == *.gz ]]; then
    echo "Decompressing and restoring gzipped backup..."
    if command -v psql >/dev/null 2>&1; then
        gunzip -c "${BACKUP_PATH}" | psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
    elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q 'kasir-postgres'; then
        gunzip -c "${BACKUP_PATH}" | docker exec -i kasir-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
    else
        echo "ERROR: Neither local psql nor running 'kasir-postgres' docker container found."
        exit 1
    fi
else
    echo "Restoring plain SQL backup..."
    if command -v psql >/dev/null 2>&1; then
        psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${BACKUP_PATH}"
    elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q 'kasir-postgres'; then
        docker exec -i kasir-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${BACKUP_PATH}"
    else
        echo "ERROR: Neither local psql nor running 'kasir-postgres' docker container found."
        exit 1
    fi
fi

echo " Database restore completed successfully!"
