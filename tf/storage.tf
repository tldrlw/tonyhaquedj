# Example "hello world" resource — creates a simple GCS bucket
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