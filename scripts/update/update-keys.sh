#!/bin/bash
#
# update_keys.sh
#
# Usage:
#   ./update_keys.sh <TRACK_ID> <NEW_MUSICAL_KEY> [PROJECT_ID] [DATASET] [TABLE]
#
# Examples:
#   ./update_keys.sh 20391533 Gbm
#   ./update_keys.sh 20391533 "F#m"
#   ./update_keys.sh 20297519 Bm
#
# Defaults:
#   PROJECT_ID = dulcet-provider-474401-d3
#   DATASET    = chunes
#   TABLE      = tracks
#
# What it does:
#   1. Derives the Camelot key from the musical_key you pass in
#   2. Shows current row (track_id, track_name, artists, bpm, musical_key, camelot_key)
#   3. Updates musical_key and camelot_key together
#   4. Shows updated row
#

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "❌ Usage: $0 <TRACK_ID> <NEW_MUSICAL_KEY> [PROJECT_ID] [DATASET] [TABLE]"
  exit 1
fi

TRACK_ID="$1"
NEW_MUSICAL_KEY_RAW="$2"  # e.g. Gbm, F#m, Bm, C, etc.
PROJECT_ID="${3:-dulcet-provider-474401-d3}"
DATASET="${4:-chunes}"
TABLE="${5:-tracks}"

FQTN="\`${PROJECT_ID}.${DATASET}.${TABLE}\`"  # fully qualified table name

############################################
# function: normalize_key
# - Uppercases letters except the trailing 'm' for minor
# - Removes spaces
# - Keeps '#' and 'b'
# So:
#   "f#m"   -> "F#m"
#   "gbm"   -> "Gbm"
#   "A#"    -> "A#"
#   "a#m"   -> "A#m"
############################################
normalize_key() {
  local raw="$1"
  # strip spaces
  raw="${raw//[[:space:]]/}"

  # We want to uppercase letters except a trailing 'm' in minors.
  # We'll do a tiny transform:
  # 1. lowercase everything
  # 2. uppercase first char and any #/b following appropriately
  # 3. ensure trailing 'm' stays lowercase
  #
  # Easier approach: pattern match common forms and rewrite them known-good.
  # We'll just uppercase A-G and #/b and ensure 'm' at the end is lowercase.
  # Example: "f#m" -> "F#m", "gbm" -> "Gbm", "C" -> "C", "a#m" -> "A#m"

  # lowercase whole thing first
  local lower="$(printf "%s" "$raw" | tr 'A-Z' 'a-z')"

  # if it ends with "m", split root vs 'm'
  if [[ "$lower" =~ ^([a-g][#b]?)(m)$ ]]; then
    local root="${BASH_REMATCH[1]}"
    local minor_tag="${BASH_REMATCH[2]}" # "m"
    # uppercase root letter, keep '#' or 'b'
    local first_char_upper="$(printf "%s" "${root:0:1}" | tr 'a-z' 'A-Z')"
    local accidental="${root:1}"
    printf "%s%s%s" "$first_char_upper" "$accidental" "$minor_tag"
    return 0
  fi

  # else treat it like major (no trailing m)
  if [[ "$lower" =~ ^([a-g][#b]?)$ ]]; then
    local root="${BASH_REMATCH[1]}"
    local first_char_upper="$(printf "%s" "${root:0:1}" | tr 'a-z' 'A-Z')"
    local accidental="${root:1}"
    printf "%s%s" "$first_char_upper" "$accidental"
    return 0
  fi

  # Fallback: return raw unchanged if weird format
  printf "%s" "$raw"
}

############################################
# function: camelot_for_key
# Map musical key (normalized) -> Camelot
#
# Camelot wheel reference:
#  1A = Abm / G#m          1B = B
#  2A = Ebm / D#m          2B = F# / Gb
#  3A = Bbm / A#m          3B = Db / C#
#  4A = Fm                 4B = Ab / G#
#  5A = Cm                 5B = Eb / D#
#  6A = Gm                 6B = Bb / A#
#  7A = Dm                 7B = F
#  8A = Am                 8B = C
#  9A = Em                 9B = G
# 10A = Bm                10B = D
# 11A = F#m / Gbm         11B = A
# 12A = C#m / Dbm         12B = E
############################################
camelot_for_key() {
  local key="$1"
  case "$key" in
    # 1A
    "Abm"|"G#m") echo "1A" ;;
    # 1B
    "B") echo "1B" ;;

    # 2A
    "Ebm"|"D#m") echo "2A" ;;
    # 2B
    "F#"|"Gb") echo "2B" ;;

    # 3A
    "Bbm"|"A#m") echo "3A" ;;
    # 3B
    "Db"|"C#") echo "3B" ;;

    # 4A
    "Fm") echo "4A" ;;
    # 4B
    "Ab"|"G#") echo "4B" ;;

    # 5A
    "Cm") echo "5A" ;;
    # 5B
    "Eb"|"D#") echo "5B" ;;

    # 6A
    "Gm") echo "6A" ;;
    # 6B
    "Bb"|"A#") echo "6B" ;;

    # 7A
    "Dm") echo "7A" ;;
    # 7B
    "F") echo "7B" ;;

    # 8A
    "Am") echo "8A" ;;
    # 8B
    "C") echo "8B" ;;

    # 9A
    "Em") echo "9A" ;;
    # 9B
    "G") echo "9B" ;;

    # 10A
    "Bm") echo "10A" ;;
    # 10B
    "D") echo "10B" ;;

    # 11A
    "F#m"|"Gbm") echo "11A" ;;
    # 11B
    "A") echo "11B" ;;

    # 12A
    "C#m"|"Dbm") echo "12A" ;;
    # 12B
    "E") echo "12B" ;;

    *)
      # if we can't map it, return empty
      echo ""
      ;;
  esac
}

# Normalize musical key from user
NORMALIZED_KEY="$(normalize_key "$NEW_MUSICAL_KEY_RAW")"
NEW_CAMELOT_KEY="$(camelot_for_key "$NORMALIZED_KEY")"

if [ -z "$NEW_CAMELOT_KEY" ]; then
  echo "⚠️  Could not derive Camelot key for '$NEW_MUSICAL_KEY_RAW' (normalized: '$NORMALIZED_KEY')."
  echo "    Check spelling (e.g. 'F#m', 'Gbm', 'Bm', 'C#m', 'A', 'E', etc.)."
  exit 1
fi

echo "🎧 Target track_id:    ${TRACK_ID}"
echo "🎼 New musical_key:    ${NORMALIZED_KEY}"
echo "🔑 Derived camelot_key: ${NEW_CAMELOT_KEY}"
echo "📍 Table:              ${PROJECT_ID}.${DATASET}.${TABLE}"
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
# 2. Perform UPDATE of BOTH keys
##############################################################################
echo "✏️  Updating musical_key + camelot_key..."
bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  --format=none \
  "
  UPDATE ${FQTN}
  SET musical_key = \"${NORMALIZED_KEY}\",
      camelot_key = \"${NEW_CAMELOT_KEY}\"
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
    bpm,
    musical_key,
    camelot_key
  FROM ${FQTN}
  WHERE track_id = ${TRACK_ID}
  LIMIT 5
  "

echo ""
echo "🎉 Done."