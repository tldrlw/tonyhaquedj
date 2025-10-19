#!/bin/bash
# Compare GCS object list vs BigQuery gcs_object column (exact filename match)
# Usage:
#   ./compare-bq-gcs.sh [PROJECT_ID] [DATASET] [TABLE] [REGION]
#
# Defaults:
#   PROJECT_ID=dulcet-provider-474401-d3
#   DATASET=chunes
#   TABLE=tracks
#   REGION=us-central1
#
# Requires: gcloud, bq, jq, awk, sort, comm

set -euo pipefail

PROJECT_ID="${1:-dulcet-provider-474401-d3}"
DATASET="${2:-chunes}"
TABLE="${3:-tracks}"
REGION="${4:-us-central1}"
BUCKET="chunes-${PROJECT_ID}-${REGION}"

# temp workspace
TMP_DIR=$(mktemp -d)
GCS_LIST="${TMP_DIR}/gcs.txt"
BQ_LIST="${TMP_DIR}/bq.txt"
INTERSECTION="${TMP_DIR}/both.txt"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "🪣 GCS bucket:   gs://${BUCKET}"
echo "🗄️  BigQuery:     ${PROJECT_ID}.${DATASET}.${TABLE}"
echo "───────────────────────────────────────────────"

# --- 1) GCS object names (filenames only) ---
echo "☁️  Fetching GCS object list..."
gcloud storage ls --recursive "gs://${BUCKET}/" \
  | awk -F/ '{print $NF}' \
  | grep -v '^$' \
  | sort -u > "$GCS_LIST"

GCS_COUNT=$(wc -l < "$GCS_LIST" | tr -d ' ')
echo "📊 GCS object count: $GCS_COUNT"

# --- 2) BigQuery gcs_object (JSON + jq to avoid CSV quoting) ---
echo "🗄️  Fetching gcs_object column from BigQuery (JSON)…"
bq query \
  --project_id="$PROJECT_ID" \
  --use_legacy_sql=false \
  --format=prettyjson \
  --max_rows=1000000 \
  "SELECT DISTINCT gcs_object FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` WHERE gcs_object IS NOT NULL" \
  | jq -r '.[].gcs_object' \
  | grep -v '^$' \
  | sort -u > "$BQ_LIST"

BQ_COUNT=$(wc -l < "$BQ_LIST" | tr -d ' ')
echo "📊 BigQuery row count (distinct gcs_object): $BQ_COUNT"
echo "───────────────────────────────────────────────"

# --- 3) In GCS but not in BQ ---
echo "📦 Files present in GCS but NOT in BigQuery (likely never ingested):"
if comm -23 "$GCS_LIST" "$BQ_LIST" | grep .; then
  echo "⚠️  Above objects exist in GCS but are missing from BigQuery."
else
  echo "✅ None"
fi
echo

# --- 4) In BQ but not in GCS ---
echo "🗄️  Rows present in BigQuery but NOT in GCS (likely deleted or moved):"
if comm -13 "$GCS_LIST" "$BQ_LIST" | grep .; then
  echo "⚠️  Above rows are in BigQuery but the objects are missing in GCS."
else
  echo "✅ None"
fi
echo

# --- 5) Sanity: intersection size (should be close to min(GCS, BQ)) ---
comm -12 "$GCS_LIST" "$BQ_LIST" > "$INTERSECTION" || true
BOTH_COUNT=$(wc -l < "$INTERSECTION" | tr -d ' ')

echo "📐 Intersection (in BOTH GCS & BQ): $BOTH_COUNT"
echo "───────────────────────────────────────────────"
echo "✅ Comparison complete!"
echo "☁️  GCS objects: $GCS_COUNT"
echo "🗄️  BQ rows:     $BQ_COUNT"