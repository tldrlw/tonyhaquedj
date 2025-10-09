#!/bin/bash
# Delete all rows from a BigQuery table (truncate operation)
# Usage: ./truncate_bq_table.sh [PROJECT_ID] [DATASET] [TABLE]

set -euo pipefail

PROJECT_ID="${1:-dulcet-provider-474401-d3}"
DATASET="${2:-chunes}"
TABLE="${3:-tracks}"

echo "⚠️  This will delete ALL rows from ${PROJECT_ID}.${DATASET}.${TABLE}"
read -p "Are you sure you want to continue? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo "🧹 Truncating table..."
bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  "DELETE FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` WHERE TRUE;"

echo "✅ Table ${PROJECT_ID}.${DATASET}.${TABLE} has been cleared."