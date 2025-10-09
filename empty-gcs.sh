#!/bin/bash
set -euo pipefail

# ========= CONFIG =========
PROJECT_ID="dulcet-provider-474401-d3"
REGION="us-central1"
BUCKET="chunes-${PROJECT_ID}-${REGION}"
LOG_FILE="./empty-gcs-bucket.log"
# Optional flags
DRY_RUN=false     # true = preview deletions, no actual delete
# ==========================

echo "🧹 Starting bucket cleanup: gs://${BUCKET}" | tee "$LOG_FILE"
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

echo "🪣 Checking bucket existence..." | tee -a "$LOG_FILE"
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "❌ Bucket not found: ${BUCKET}" | tee -a "$LOG_FILE"
  exit 1
fi

# --- List objects ---
echo "📋 Listing all objects..." | tee -a "$LOG_FILE"
if ! gcloud storage ls "gs://${BUCKET}/" >/dev/null 2>&1; then
  echo "✅ Bucket is already empty." | tee -a "$LOG_FILE"
  exit 0
fi

# --- Build delete command ---
cmd=(gcloud storage rm --recursive "gs://${BUCKET}/**")
$DRY_RUN && cmd+=(--dry-run)

echo "⚠️ About to delete all objects in gs://${BUCKET}" | tee -a "$LOG_FILE"
$DRY_RUN && echo "   (dry-run mode, no changes will be made)" | tee -a "$LOG_FILE"

# --- Confirm (for safety) ---
read -rp "Type 'YES' to confirm deletion: " confirm
if [[ "$confirm" != "YES" ]]; then
  echo "🛑 Deletion cancelled." | tee -a "$LOG_FILE"
  exit 0
fi

# --- Execute ---
echo "🚨 Executing: ${cmd[*]}" | tee -a "$LOG_FILE"
"${cmd[@]}" | tee -a "$LOG_FILE" || {
  echo "❌ Failed to empty bucket" | tee -a "$LOG_FILE"
  exit 1
}

echo "✅ Bucket emptied successfully (bucket itself retained)" | tee -a "$LOG_FILE"
date | tee -a "$LOG_FILE"