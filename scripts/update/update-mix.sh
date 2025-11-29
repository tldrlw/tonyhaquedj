#!/bin/bash
#
# update_mix.sh
#
# Usage:
#   ./update_mix.sh <TRACK_ID> "<NEW_MIX_NAME>" [PROJECT_ID] [DATASET] [TABLE]
#
# Examples:
#   ./update_mix.sh 19596504 "Extended Mix"
#   ./update_mix.sh 20391533 "Club Mix"
#
# Defaults:
#   PROJECT_ID = dulcet-provider-474401-d3
#   DATASET    = chunes
#   TABLE      = tracks
#
# What it does:
#   1. Shows the current row (track_id, track_name, artists, mix_name, bpm, musical_key, camelot_key)
#   2. Updates mix_name
#   3. Shows the row again so you can confirm
#

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "❌ Usage: $0 <TRACK_ID> \"<NEW_MIX_NAME>\" [PROJECT_ID] [DATASET] [TABLE]"
  exit 1
fi

TRACK_ID="$1"
NEW_MIX_NAME="$2"
PROJECT_ID="${3:-dulcet-provider-474401-d3}"
DATASET="${4:-chunes}"
TABLE="${5:-tracks}"

FQTN="\`${PROJECT_ID}.${DATASET}.${TABLE}\`"  # fully qualified table name

echo "🎧 Target track_id: ${TRACK_ID}"
echo "🎚️  New mix_name:   ${NEW_MIX_NAME}"
echo "📍 Table:           ${PROJECT_ID}.${DATASET}.${TABLE}"
echo ""

##############################################################################
# 1. Show BEFORE state
##############################################################################
echo "🔍 Current row before update:"
bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  --format=prettyjson \
  "
  SELECT
    track_id,
    track_name,
    artists,
    mix_name,
    bpm,
    musical_key,
    camelot_key
  FROM ${FQTN}
  WHERE track_id = ${TRACK_ID}
  LIMIT 5
  " || {
    echo "⚠️ Failed to read current row. Aborting."
    exit 1
  }

echo ""

##############################################################################
# 2. Perform UPDATE
##############################################################################
echo "✏️  Updating mix_name..."
bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  --format=none \
  "
  UPDATE ${FQTN}
  SET mix_name = \"${NEW_MIX_NAME}\"
  WHERE track_id = ${TRACK_ID}
  " || {
    echo "❌ Update failed."
    exit 1
  }

echo "✅ Update issued."
echo ""

##############################################################################
# 3. Show AFTER state
##############################################################################
echo "🔁 Row after update:"
bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  --format=prettyjson \
  "
  SELECT
    track_id,
    track_name,
    artists,
    mix_name,
    bpm,
    musical_key,
    camelot_key
  FROM ${FQTN}
  WHERE track_id = ${TRACK_ID}
  LIMIT 5
  "

echo ""
echo "🎉 Done."