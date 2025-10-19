#!/usr/bin/env bash
# Compare GCS object names vs BigQuery gcs_object (exact string match).
# Usage: ./compare-bq-gcs.sh [PROJECT_ID] [DATASET] [TABLE] [REGION]
# Requires: gcloud, bq, jq

set -euo pipefail

PROJECT_ID="${1:-dulcet-provider-474401-d3}"
DATASET="${2:-chunes}"
TABLE="${3:-tracks}"
REGION="${4:-us-central1}"
BUCKET="chunes-${PROJECT_ID}-${REGION}"

# Set a stable collation so sort/comm behave predictably.
export LC_ALL=C

# Toggle per-item recheck against BQ for anything flagged as "missing"
REVERIFY_MISSING=true

TMP_DIR="$(mktemp -d)"
GCS_LIST="${TMP_DIR}/gcs.txt"
BQ_LIST="${TMP_DIR}/bq.txt"
MISS_IN_BQ="${TMP_DIR}/missing_in_bq.txt"
MISS_IN_GCS="${TMP_DIR}/missing_in_gcs.txt"
INTERSECTION="${TMP_DIR}/intersection.txt"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

echo "🪣 GCS bucket:   gs://${BUCKET}"
echo "🗄️  BigQuery:     ${PROJECT_ID}.${DATASET}.${TABLE}"
echo "───────────────────────────────────────────────"

# -------- GCS: full object names (remove bucket prefix, drop 'folder/' placeholders) --------
echo "☁️  Fetching GCS object list..."
# Notes:
# - Remove leading 'gs://bucket/' only (keep any subpaths).
# - Drop any lines that end with '/' (folder placeholders).
# - Drop empties; trim CRs; unique sort.
gcloud storage ls --recursive "gs://${BUCKET}/**" \
  | sed -E "s#^gs://${BUCKET}/##" \
  | sed -E '/\/$/d' \
  | sed -E '/^[[:space:]]*$/d' \
  | tr -d '\r' \
  | sort -u > "${GCS_LIST}"

GCS_COUNT=$(wc -l < "${GCS_LIST}" | tr -d ' ')
echo "📊 GCS object count: ${GCS_COUNT}"

# -------- BigQuery: exact gcs_object strings via JSON + jq --------
echo "📥 Fetching gcs_object column from BigQuery (JSON)…"
# Use DISTINCT to avoid dup rows; filter nulls; set high max_rows.
bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  --max_rows=1000000 \
  --format=json \
  "SELECT DISTINCT gcs_object
     FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
    WHERE gcs_object IS NOT NULL" \
  | jq -r '.[].gcs_object' \
  | tr -d '\r' \
  | sort -u > "${BQ_LIST}"

BQ_COUNT=$(wc -l < "${BQ_LIST}" | tr -d ' ')
echo "📊 BigQuery row count (distinct gcs_object): ${BQ_COUNT}"
echo "───────────────────────────────────────────────"

# -------- Set math via comm (both lists must be sorted) --------
# In GCS but not in BQ
comm -23 "${GCS_LIST}" "${BQ_LIST}" > "${MISS_IN_BQ}" || true
# In BQ but not in GCS
comm -13 "${GCS_LIST}" "${BQ_LIST}" > "${MISS_IN_GCS}" || true
# Intersection
comm -12 "${GCS_LIST}" "${BQ_LIST}" > "${INTERSECTION}" || true

# -------- Report --------
echo "📦 Files present in GCS but NOT in BigQuery (likely never ingested):"
if [[ -s "${MISS_IN_BQ}" ]]; then
  echo ":"
  cat "${MISS_IN_BQ}"
  echo "⚠️  Above objects exist in GCS but were not found in the BQ list."
else
  echo "✅ None"
fi
echo

echo "🗄️  Rows present in BigQuery but NOT in GCS (likely deleted or moved):"
if [[ -s "${MISS_IN_GCS}" ]]; then
  echo ":"
  # Quote to make any odd characters visible in terminals
  sed 's/.*/"&"/' "${MISS_IN_GCS}"
  echo "⚠️  Above rows exist in BQ but their objects are missing in GCS."
else
  echo "✅ None"
fi
echo

INTER_COUNT=$(wc -l < "${INTERSECTION}" | tr -d ' ')
echo "🔀 Intersection (in BOTH GCS & BQ): ${INTER_COUNT}"
echo "───────────────────────────────────────────────"

# -------- Optional: re-verify any suspected misses directly in BQ --------
# This catches false positives due to hidden whitespace/Unicode mismatches or parsing issues.
if $REVERIFY_MISSING && [[ -s "${MISS_IN_BQ}" ]]; then
  echo "🔍 Re-verifying each 'missing in BQ' item with an exact equality query…"
  while IFS= read -r obj; do
    # Use a parameterized query to avoid quoting issues.
    cnt=$(bq query \
      --quiet \
      --project_id="${PROJECT_ID}" \
      --use_legacy_sql=false \
      --format=csv \
      --max_rows=1 \
      --parameter="name:STRING:${obj}" \
      "SELECT COUNT(1) FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` WHERE gcs_object = @name" \
      | tail -n 1)

    if [[ "${cnt}" != "0" ]]; then
      echo "   ✅ Found in BQ after direct check (likely a diff/normalization glitch):"
      echo "      ${obj}"
    fi
  done < "${MISS_IN_BQ}"
fi

echo
echo "✅ Comparison complete!"
echo "☁️  GCS objects: ${GCS_COUNT}"
echo "🗄️  BQ rows:     ${BQ_COUNT}"