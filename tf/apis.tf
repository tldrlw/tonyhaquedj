# Enable required APIs once (keep if you want TF to manage APIs)
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudfunctions.googleapis.com",
    "eventarc.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}
