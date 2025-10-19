#!/bin/bash
# Empty a Google Cloud Storage bucket (objects only; bucket retained)
# Usage:
#   ./empty-gcs.sh [PROJECT_ID] [REGION] [--dry-run] [--no-prompt]
#
# Examples:
#   ./empty-gcs.sh dulcet-provider-474401-d3 us-central1 --dry-run
#   ./empty-gcs.sh dulcet-provider-474401-d3 us-central1 --no-prompt

set -euo pipefail

# ========= CONFIG =========
PROJECT_ID="${1:-dulcet-provider-474401-d3}"
REGION="${2:-us-central1}"
shift 2 || true

DRY_RUN=false
NO_PROMPT=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-prompt) NO_PROMPT=true ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

BUCKET="chunes-${PROJECT_ID}-${REGION}"
LOG_FILE="./empty-gcs.log"
# ==========================

echo "🧹 Starting bucket cleanup: gs://${BUCKET}" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"
echo "Project: ${PROJECT_ID} | Region: ${REGION}" | tee -a "$LOG_FILE"

# --- Auth check ---
echo "🔑 Checking gcloud authentication..." | tee -a "$LOG_FILE"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null; then
  echo "❌ No active gcloud account found. Run 'gcloud auth login' first." | tee -a "$LOG_FILE"
  exit 1
fi

# --- Project & bucket checks ---
echo "🧭 Setting project to ${PROJECT_ID}" | tee -a "$LOG_FILE"
gcloud config set project "$PROJECT_ID" | tee -a "$LOG_FILE" >/dev/null

echo "🪣 Checking bucket existence..." | tee -a "$LOG_FILE"
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "❌ Bucket not found: ${BUCKET}" | tee -a "$LOG_FILE"
  exit 1
fi

# --- List quick sanity ---
echo "📋 Listing top-level to verify access..." | tee -a "$LOG_FILE"
if ! gcloud storage ls "gs://${BUCKET}/" >/dev/null 2>&1; then
  echo "✅ Bucket is already empty." | tee -a "$LOG_FILE"
  exit 0
fi

# --- Build delete command ---
cmd=(gcloud storage rm --recursive "gs://${BUCKET}/**")
$DRY_RUN && cmd+=(--dry-run)

echo "⚠️  About to delete ALL objects in gs://${BUCKET}" | tee -a "$LOG_FILE"
$DRY_RUN && echo "   (dry-run mode, no changes will be made)" | tee -a "$LOG_FILE"

# --- Confirm (same flow as BQ script) ---
if ! $NO_PROMPT; then
  read -r -p "Type 'YES' to confirm deletion: " confirm
  if [[ "$confirm" != "YES" ]]; then
    echo "🛑 Deletion cancelled." | tee -a "$LOG_FILE"
    exit 0
  fi
fi

# --- Execute ---
echo "🚨 Executing: ${cmd[*]}" | tee -a "$LOG_FILE"
if "${cmd[@]}" | tee -a "$LOG_FILE"; then
  echo "✅ Bucket objects removed (bucket retained)" | tee -a "$LOG_FILE"
else
  echo "❌ Failed to empty bucket" | tee -a "$LOG_FILE"
  exit 1
fi

date | tee -a "$LOG_FILE"