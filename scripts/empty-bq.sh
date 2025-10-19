#!/bin/bash
# Delete all rows from a BigQuery table (truncate operation)
# Usage:
#   ./empty-bq.sh [PROJECT_ID] [DATASET] [TABLE] [--no-prompt]
#
# Examples:
#   ./empty-bq.sh dulcet-provider-474401-d3 chunes tracks
#   ./empty-bq.sh dulcet-provider-474401-d3 chunes tracks --no-prompt
#
# Notes:
# - If the table has a streaming buffer, DELETE may fail with a buffer error.
#   See your ingestion flow; you may need to wait a few minutes before retrying.

set -euo pipefail

PROJECT_ID="${1:-dulcet-provider-474401-d3}"
DATASET="${2:-chunes}"
TABLE="${3:-tracks-2}"
shift 3 || true

NO_PROMPT=false
for arg in "$@"; do
  case "$arg" in
    --no-prompt) NO_PROMPT=true ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

LOG_FILE="./truncate-bq-table.log"

echo "🧹 Truncating BigQuery table" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"
echo "🗄️  Target: ${PROJECT_ID}.${DATASET}.${TABLE}" | tee -a "$LOG_FILE"

# --- Auth check (gcloud) ---
echo "🔑 Checking gcloud authentication..." | tee -a "$LOG_FILE"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null; then
  echo "❌ No active gcloud account found. Run 'gcloud auth login' first." | tee -a "$LOG_FILE"
  exit 1
fi

# --- Set project for bq CLI too ---
echo "🧭 Setting project to ${PROJECT_ID}" | tee -a "$LOG_FILE"
gcloud config set project "$PROJECT_ID" | tee -a "$LOG_FILE" >/dev/null

# --- Confirm (same flow as GCS script) ---
echo "⚠️  This will DELETE ALL rows from ${PROJECT_ID}.${DATASET}.${TABLE}" | tee -a "$LOG_FILE"
if ! $NO_PROMPT; then
  read -r -p "Type 'YES' to confirm deletion: " confirm
  if [[ "$confirm" != "YES" ]]; then
    echo "🛑 Deletion cancelled." | tee -a "$LOG_FILE"
    exit 0
  fi
fi

# --- Execute ---
echo "🚨 Running DELETE ... (standard SQL)" | tee -a "$LOG_FILE"
set +e
OUT=$(
  bq query \
    --project_id="${PROJECT_ID}" \
    --use_legacy_sql=false \
    "DELETE FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` WHERE TRUE;" 2>&1
)
STATUS=$?
set -e

echo "$OUT" | tee -a "$LOG_FILE"

if [[ $STATUS -ne 0 ]]; then
  if grep -q "affect rows in the streaming buffer" <<<"$OUT"; then
    echo "❌ BigQuery refused due to streaming buffer." | tee -a "$LOG_FILE"
    echo "   Workarounds you can try:" | tee -a "$LOG_FILE"
    echo "   - Wait a few minutes and re-run." | tee -a "$LOG_FILE"
    echo "   - Or temporarily stop streaming inserts, then retry." | tee -a "$LOG_FILE"
    echo "   - Or use a snapshot/replace strategy (create empty table and swap)." | tee -a "$LOG_FILE"
  else
    echo "❌ Failed to truncate table." | tee -a "$LOG_FILE"
  fi
  exit 1
fi

echo "✅ Table ${PROJECT_ID}.${DATASET}.${TABLE} has been cleared." | tee -a "$LOG_FILE"
date | tee -a "$LOG_FILE"