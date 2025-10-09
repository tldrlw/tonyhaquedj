#!/bin/bash
set -euo pipefail

# ========= CONFIG =========
PROJECT_ID="dulcet-provider-474401-d3"
REGION="us-central1"
BUCKET="chunes-${PROJECT_ID}-${REGION}"
SRC_DIR="$HOME/Desktop/chunes-temp"
LOG_FILE="./push-to-gcs.log"

# Optional flags
DRY_RUN=false     # true = preview only, no uploads
DELETE=false      # true = delete remote files not in SRC_DIR
CHECKSUM=true     # true = verify by checksum instead of timestamps/sizes
# ==========================

echo "🚀 Starting upload to gs://${BUCKET}/" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# --- Auth check ---
echo "🔑 Checking gcloud authentication..." | tee -a "$LOG_FILE"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null; then
  echo "❌ No active gcloud account found. Run 'gcloud auth login' first." | tee -a "$LOG_FILE"
  exit 1
fi

# --- Project & bucket checks ---
echo "🧭 Setting project to ${PROJECT_ID}" | tee -a "$LOG_FILE"
gcloud config set project "$PROJECT_ID" | tee -a "$LOG_FILE"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "❌ Source directory not found: $SRC_DIR" | tee -a "$LOG_FILE"
  exit 1
fi

echo "🪣 Checking bucket: gs://${BUCKET}" | tee -a "$LOG_FILE"
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "❌ Bucket not found: ${BUCKET}" | tee -a "$LOG_FILE"
  exit 1
fi

# --- Build rsync command ---
cmd=(gcloud storage rsync --recursive)
$CHECKSUM && cmd+=(--checksums-only)
$DRY_RUN   && cmd+=(--dry-run)
$DELETE    && cmd+=(--delete)

# Exclude macOS junk
cmd+=(--exclude=".*\\.DS_Store$" --exclude=".*Icon\\r$" --exclude=".*Thumbs\\.db$")

cmd+=("$SRC_DIR" "gs://${BUCKET}/")

# --- Execute ---
echo "🎧 Syncing ${SRC_DIR} → gs://${BUCKET}/" | tee -a "$LOG_FILE"
echo "📦 Command: ${cmd[*]}" | tee -a "$LOG_FILE"

SYNC_OUTPUT=$(mktemp)
"${cmd[@]}" | tee -a "$LOG_FILE" | tee "$SYNC_OUTPUT"

# --- Parse summary ---
COPIED=$(grep -c "Copying" "$SYNC_OUTPUT" || true)
SKIPPED=$(grep -c "Skipping" "$SYNC_OUTPUT" || true)
DELETED=$(grep -c "Deleting" "$SYNC_OUTPUT" || true)

echo "" | tee -a "$LOG_FILE"
echo "📊 Summary:" | tee -a "$LOG_FILE"
echo "   ➕ Files uploaded: ${COPIED}" | tee -a "$LOG_FILE"
echo "   ➖ Files skipped : ${SKIPPED}" | tee -a "$LOG_FILE"
$DELETE && echo "   ❌ Files deleted: ${DELETED}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

rm -f "$SYNC_OUTPUT"
echo "✅ Upload complete! Full details logged in ${LOG_FILE}"