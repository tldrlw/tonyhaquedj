#!/usr/bin/env bash
set -euo pipefail

# ========= CONFIG =========
PROJECT_ID="dulcet-provider-474401-d3"
REGION="us-central1"

# Where your React app lives
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../web" && pwd)"

# Website bucket
WEB_BUCKET="chunes-web-${PROJECT_ID}-${REGION}"

# Logging
LOG_FILE="./deploy-react-to-gcs.log"

# Optional flags
DRY_RUN=false      # true = preview only, no uploads
DELETE=false       # true = delete remote files not in BUILD_DIR
CHECKSUM=true      # true = rsync via checksums (slower, safer)
DO_BUILD=true      # false = skip install/build
SET_CACHE=true     # false = skip Cache-Control updates
# ==========================

ts() { date +"%Y-%m-%dT%H:%M:%S%z"; }
log() { echo "[$(ts)] [$1] $2 ${3:+| $3}" | tee -a "$LOG_FILE"; }
run() {
  echo "[$(ts)] [RUN] $*" | tee -a "$LOG_FILE"
  "$@"
}

echo "🚀 Deploying React site (web/) to gs://${WEB_BUCKET}/" | tee "$LOG_FILE"
date | tee -a "$LOG_FILE"

# --- Auth check ---
log INFO "Checking gcloud auth"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null; then
  log ERROR "No active gcloud account found. Run 'gcloud auth login' first."
  exit 1
fi

# --- Project & bucket checks ---
log INFO "Setting project" "project_id=${PROJECT_ID}"
run gcloud config set project "$PROJECT_ID" >/dev/null

log INFO "App directory" "path=${APP_DIR}"
if [[ ! -d "$APP_DIR" ]]; then
  log ERROR "App directory not found: ${APP_DIR}"
  exit 1
fi

log INFO "Checking bucket exists" "bucket=gs://${WEB_BUCKET}"
if ! gcloud storage buckets describe "gs://${WEB_BUCKET}" >/dev/null 2>&1; then
  log ERROR "Bucket not found: ${WEB_BUCKET}"
  echo "   Make sure Terraform created google_storage_bucket.react_site" | tee -a "$LOG_FILE"
  exit 1
fi

# --- Build (optional) ---
pushd "$APP_DIR" >/dev/null
if $DO_BUILD; then
  # Pick package manager
  if command -v pnpm >/dev/null 2>&1 && [[ -f "pnpm-lock.yaml" ]]; then
    PM="pnpm"; log INFO "Installing deps + building with pnpm" "dir=$(pwd)"
    run pnpm i | tee -a "$LOG_FILE"
    if pnpm run | grep -q "^build"; then run pnpm run build | tee -a "$LOG_FILE"; else
      log ERROR "No 'build' script found (pnpm)"; exit 1; fi
  elif command -v yarn >/dev/null 2>&1 && [[ -f "yarn.lock" ]]; then
    PM="yarn"; log INFO "Installing deps + building with yarn" "dir=$(pwd)"
    run yarn install --frozen-lockfile | tee -a "$LOG_FILE"
    if yarn run | grep -q " build"; then run yarn build | tee -a "$LOG_FILE"; else
      log ERROR "No 'build' script found (yarn)"; exit 1; fi
  else
    PM="npm"; log INFO "Installing deps + building with npm" "dir=$(pwd)"
    if [[ -f "package-lock.json" ]]; then run npm ci | tee -a "$LOG_FILE"; else run npm install | tee -a "$LOG_FILE"; fi
    if npm run | grep -q "^  build$"; then run npm run build | tee -a "$LOG_FILE"; else
      log ERROR "No 'build' script found (npm)"; exit 1; fi
  fi
else
  log INFO "Skipping build (DO_BUILD=false)"
fi

# --- Detect build dir ---
BUILD_DIR=""
for c in dist build out; do
  if [[ -d "$c" ]]; then BUILD_DIR="$c"; break; fi
done
if [[ -z "$BUILD_DIR" ]]; then
  log ERROR "Could not detect build output (looked for: dist, build, out)"
  exit 1
fi
log INFO "Using build output" "path=${APP_DIR}/${BUILD_DIR}"
popd >/dev/null

# --- Confirm (safety) ---
echo "⚠️  About to sync ${APP_DIR}/${BUILD_DIR} → gs://${WEB_BUCKET}/" | tee -a "$LOG_FILE"
$DRY_RUN && echo "   (dry-run mode, no changes will be made)" | tee -a "$LOG_FILE"
$DELETE  && echo "   (remote files not present locally WILL be deleted)" | tee -a "$LOG_FILE"
read -rp "Type 'DEPLOY' to continue: " confirm
if [[ "$confirm" != "DEPLOY" ]]; then
  echo "🛑 Deployment cancelled." | tee -a "$LOG_FILE"
  exit 0
fi

# --- Build rsync command ---
cmd=(gcloud storage rsync --recursive)
$CHECKSUM && cmd+=(--checksums-only)
$DRY_RUN   && cmd+=(--dry-run)
$DELETE    && cmd+=(--delete)
# exclude macOS junk
cmd+=(--exclude=".*\\.DS_Store$" --exclude=".*Icon\\r$" --exclude=".*Thumbs\\.db$")
cmd+=("${APP_DIR}/${BUILD_DIR}" "gs://${WEB_BUCKET}/")

# --- Execute sync ---
log INFO "Starting rsync"
SYNC_OUTPUT=$(mktemp)
"${cmd[@]}" | tee -a "$LOG_FILE" | tee "$SYNC_OUTPUT"

# --- Cache-Control headers via gsutil (robust + wildcard support) ---
if $SET_CACHE && ! $DRY_RUN; then
  log INFO "Setting Cache-Control headers with gsutil"

  if ! command -v gsutil >/dev/null 2>&1; then
    log ERROR "gsutil not found. Install Google Cloud SDK or add gsutil to PATH."
    rm -f "$SYNC_OUTPUT"
    exit 1
  fi

  # HTML should revalidate on every request
  run gsutil -m setmeta -h "Cache-Control:public, max-age=0, must-revalidate" \
    "gs://${WEB_BUCKET}/index.html" \
    "gs://${WEB_BUCKET}/404.html" || true

  # Static assets: cache for 1 year + immutable
  ASSET_CC="Cache-Control:public, max-age=31536000, immutable"

  # Vite’s default hashed assets live under /assets
  run gsutil -m setmeta -h "$ASSET_CC" "gs://${WEB_BUCKET}/assets/**" || true

  # Fallback for any assets at the root (favicons, etc.)
  run gsutil -m setmeta -h "$ASSET_CC" \
    "gs://${WEB_BUCKET}/*.js" \
    "gs://${WEB_BUCKET}/*.css" \
    "gs://${WEB_BUCKET}/*.map" \
    "gs://${WEB_BUCKET}/*.svg" \
    "gs://${WEB_BUCKET}/*.png" \
    "gs://${WEB_BUCKET}/*.jpg" \
    "gs://${WEB_BUCKET}/*.jpeg" \
    "gs://${WEB_BUCKET}/*.webp" \
    "gs://${WEB_BUCKET}/*.gif" \
    "gs://${WEB_BUCKET}/*.ico" \
    "gs://${WEB_BUCKET}/*.ttf" \
    "gs://${WEB_BUCKET}/*.otf" \
    "gs://${WEB_BUCKET}/*.woff" \
    "gs://${WEB_BUCKET}/*.woff2" || true

  log INFO "Cache-Control headers updated"
else
  log INFO "Skipping Cache-Control updates" "reason=$($DRY_RUN && echo 'dry-run' || echo 'disabled')"
fi

# --- Summary (best-effort parse) ---
COPIED=$(grep -c "Copying" "$SYNC_OUTPUT" || true)
SKIPPED=$(grep -c "Skipping" "$SYNC_OUTPUT" || true)
DELETED=$(grep -c "Deleting" "$SYNC_OUTPUT" || true)

echo "" | tee -a "$LOG_FILE"
echo "📊 Summary:" | tee -a "$LOG_FILE"
echo "   ➕ Files uploaded: ${COPIED}" | tee -a "$LOG_FILE"
echo "   ➖ Files skipped : ${SKIPPED}" | tee -a "$LOG_FILE"
$DELETE && echo "   ❌ Files deleted: ${DELETED}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

rm -f "$SYNC_OUTPUT"

SITE_WEBSITE_URL="http://${WEB_BUCKET}.storage.googleapis.com/"
SITE_JSON_URL="https://storage.googleapis.com/${WEB_BUCKET}/index.html"

echo "✅ Deploy complete! Full details in ${LOG_FILE}"
echo "🌐 Website endpoint (HTTP):  ${SITE_WEBSITE_URL}"
echo "🔒 Direct HTTPS object URL:  ${SITE_JSON_URL}"
echo "ℹ️  For HTTPS + custom domain, put this bucket behind a Cloud CDN Load Balancer."