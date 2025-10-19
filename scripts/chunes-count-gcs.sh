#!/bin/bash
# Count the number of objects in a Google Cloud Storage bucket
# Usage: ./count_gcs_objects.sh [PROJECT_ID] [REGION] [BUCKET]

set -euo pipefail

PROJECT_ID="${1:-dulcet-provider-474401-d3}"
REGION="${2:-us-central1}"
BUCKET="${3:-chunes-${PROJECT_ID}-${REGION}}"

echo "📊 Counting objects in gs://${BUCKET}..."

OBJECT_COUNT=$(gcloud storage ls --recursive "gs://${BUCKET}/" | wc -l)

echo "✅ Object count for gs://${BUCKET}: ${OBJECT_COUNT}"