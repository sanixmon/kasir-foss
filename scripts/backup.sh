#!/bin/bash
set -euo pipefail

# ==============================================================================
# Kasir FOSS - Enterprise Automated PostgreSQL Backup Script
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kasir-db}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-kasir}"
POSTGRES_DB="${POSTGRES_DB:-kasir_db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
S3_BUCKET="${S3_BUCKET:-}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/kasir_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "======================================================"
echo " Starting Automated PostgreSQL Backup..."
echo " Target DB: ${POSTGRES_DB} on ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo " Destination: ${BACKUP_FILE}"
echo "======================================================"

mkdir -p "${BACKUP_DIR}"

# 1. Execute pg_dump and compress on-the-fly
if command -v pg_dump >/dev/null 2>&1; then
    pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip -9 > "${BACKUP_FILE}"
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q 'kasir-postgres'; then
    echo "Running pg_dump inside Docker container 'kasir-postgres'..."
    docker exec kasir-postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip -9 > "${BACKUP_FILE}"
else
    echo "ERROR: Neither local pg_dump nor running 'kasir-postgres' docker container found."
    exit 1
fi

# 2. Verify Backup File Integrity
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file is empty or missing: ${BACKUP_FILE}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

gzip -t "${BACKUP_FILE}"
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo " Backup successfully created! Size: ${BACKUP_SIZE}"

# 3. Optional Upload to Offsite S3 / MinIO Object Storage
if [ -n "${S3_BUCKET}" ]; then
    echo "Uploading backup to S3 Bucket: ${S3_BUCKET}..."
    if command -v aws >/dev/null 2>&1; then
        aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/"
        echo " Uploaded to AWS S3 successfully."
    elif command -v mc >/dev/null 2>&1; then
        mc cp "${BACKUP_FILE}" "minio/${S3_BUCKET}/backups/"
        echo " Uploaded to MinIO successfully."
    else
        echo "WARNING: S3_BUCKET configured, but neither 'aws' nor 'mc' CLI tools were found."
    fi
fi

# 4. Prune Old Backups Beyond Retention Window
echo "Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "kasir_${POSTGRES_DB}_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -exec rm -v {} \;

echo " Backup pipeline completed successfully at $(date)!"
