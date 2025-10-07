# Example "hello world" resource — creates a simple GCS bucket
resource "google_storage_bucket" "chunes" {
  name     = "chunes-${var.project_id}-${var.region}"
  location = var.region
}
