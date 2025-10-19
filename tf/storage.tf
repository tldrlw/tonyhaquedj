resource "google_storage_bucket" "chunes" {
  name     = "chunes-${var.project_id}-${var.region}"
  location = var.region
}

# Build source bundle
resource "google_storage_bucket" "build_src" {
  name                        = "fn-src-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}

# PUBLIC SNAPSHOTS BUCKET (read-only)
resource "google_storage_bucket" "snapshots" {
  name = "chunes-snapshots-${var.project_id}-${var.region}"
  # Use the same region you use for BigQuery/compute to keep egress cheap
  location = var.region
  # Strongly recommended for modern IAM-only control
  uniform_bucket_level_access = true
  # Keep object versions in case you ever need to roll back (cheap + nice safety)
  versioning { enabled = true }
  # OPTIONAL: basic lifecycle—auto-expire data files after 180 days.
  # We store the small manifest under "manifest/" so it won’t be deleted.
  lifecycle_rule {
    action { type = "Delete" }
    condition {
      age            = 180
      matches_prefix = ["snapshots/"]
    }
  }
  # If you will front this with Cloud CDN later, dual-region can be okay too.
  # For now, we keep it simple/cheap in a single region you control.
  # Optional: turn off public access prevention so we can grant allUsers viewer
  public_access_prevention = "inherited"
  cors {
    origin          = ["*"] # or lock to your app: ["https://yourapp.com"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Content-Encoding", "Cache-Control"]
    max_age_seconds = 3600
  }
  # Sensible default cache. You can override per-object in your uploader.
  default_event_based_hold = false
}

# (Optional) You can add logging to another bucket if you want access logs:
# resource "google_storage_bucket" "snapshots_logs" { ... }
# and then set logging { log_bucket = google_storage_bucket.snapshots_logs.name }

# NICE-TO-HAVE OUTPUTS
output "snapshots_bucket_name" {
  value = google_storage_bucket.snapshots.name
}

output "snapshots_public_url_latest_manifest" {
  description = "Convenience URL for the tiny manifest (we will write manifest/latest.json)."
  value       = "https://storage.googleapis.com/${google_storage_bucket.snapshots.name}/manifest/latest.json"
}
