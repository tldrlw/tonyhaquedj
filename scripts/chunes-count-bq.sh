#!/bin/bash
# Count the number of rows in a BigQuery table
# Usage: ./count_bq_rows.sh [PROJECT_ID] [DATASET] [TABLE]

set -euo pipefail

PROJECT_ID="${1:-dulcet-provider-474401-d3}"
DATASET="${2:-chunes}"
TABLE="${3:-tracks}"

echo "📊 Counting rows in ${PROJECT_ID}.${DATASET}.${TABLE}..."

ROW_COUNT=$(bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  --format=sparse \
  "SELECT COUNT(*) AS row_count FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`" | tail -n 1)

echo "✅ Row count for ${PROJECT_ID}.${DATASET}.${TABLE}: ${ROW_COUNT}"