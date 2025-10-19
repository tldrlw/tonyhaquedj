#!/usr/bin/env bash
set -euo pipefail

# ========= CONFIG =========
PROJECT_ID="${PROJECT_ID:-dulcet-provider-474401-d3}"
REGION="${REGION:-us-central1}"
FUNCTION="${FUNCTION:-export-snapshot}"
LOG_FILE="${LOG_FILE:-./invoke-exporter.log}"

METHOD="${METHOD:-POST}"
DATA_JSON='{}'
# ==========================

echo "🚀 Invoking Cloud Function: ${FUNCTION}" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# --- Auth check ---
echo "🔑 Checking gcloud authentication..." | tee -a "$LOG_FILE"
ACTIVE_ACCT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
if [[ -z "${ACTIVE_ACCT}" ]]; then
  echo "❌ No active gcloud account. Run 'gcloud auth login'." | tee -a "$LOG_FILE"
  exit 1
fi
echo "✅ Active account: ${ACTIVE_ACCT}" | tee -a "$LOG_FILE"

# --- Project ---
echo "🧭 Setting project to ${PROJECT_ID}" | tee -a "$LOG_FILE"
gcloud config set project "$PROJECT_ID" | tee -a "$LOG_FILE"

# --- URL ---
URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION}"
echo "🌐 URL: ${URL}" | tee -a "$LOG_FILE"

# --- Identity token ---
echo "🔐 Fetching identity token..." | tee -a "$LOG_FILE"
ID_TOKEN="$(gcloud auth print-identity-token)"

# --- Invoke ---
RESP_TMP="$(mktemp)"
HTTP_STATUS=$(curl -sS -X "${METHOD}" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${DATA_JSON}" \
  -o "${RESP_TMP}" \
  -w "%{http_code}" \
  "${URL}")

tee -a "$LOG_FILE" < "${RESP_TMP}"
rm -f "${RESP_TMP}"

echo "" | tee -a "$LOG_FILE"
echo "📊 HTTP status: ${HTTP_STATUS}" | tee -a "$LOG_FILE"

if [[ "${HTTP_STATUS}" -ge 200 && "${HTTP_STATUS}" -lt 300 ]]; then
  echo "✅ Invocation succeeded." | tee -a "$LOG_FILE"
  exit 0
else
  echo "❌ Invocation failed (HTTP ${HTTP_STATUS}). See ${LOG_FILE} for details." | tee -a "$LOG_FILE"
  exit 1
fi