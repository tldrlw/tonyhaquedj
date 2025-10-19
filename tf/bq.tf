# Enable BigQuery API
resource "google_project_service" "bigquery" {
  project            = var.project_id
  service            = "bigquery.googleapis.com"
  disable_on_destroy = false
}

# Create the dataset
resource "google_bigquery_dataset" "chunes" {
  project    = var.project_id
  dataset_id = var.bq_dataset
  location   = var.region
  depends_on = [google_project_service.bigquery]
}

# Create the table
resource "google_bigquery_table" "tracks" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.chunes.dataset_id
  table_id   = var.bq_table

  deletion_protection = false

  # (existing config)
  schema = jsonencode([
    { "name" : "gcs_bucket", "type" : "STRING", "mode" : "REQUIRED" },
    { "name" : "gcs_object", "type" : "STRING", "mode" : "REQUIRED" },
    { "name" : "gcs_generation", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "size", "type" : "FLOAT64", "mode" : "NULLABLE", "description" : "File size in megabytes" },
    { "name" : "track_id", "type" : "INT64", "mode" : "NULLABLE" },
    { "name" : "track_name", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "artists", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "mix_name", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "bpm", "type" : "INT64", "mode" : "NULLABLE" },
    { "name" : "musical_key", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "camelot_key", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "label", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "release_date", "type" : "TIMESTAMP", "mode" : "NULLABLE" },
    { "name" : "purchase_date", "type" : "TIMESTAMP", "mode" : "NULLABLE" },
    { "name" : "file_ext", "type" : "STRING", "mode" : "NULLABLE" },
    { "name" : "ingested_at", "type" : "TIMESTAMP", "mode" : "REQUIRED" }
  ])

  time_partitioning {
    type  = "DAY"
    field = "ingested_at"
  }

  clustering = ["artists", "label"]

  depends_on = [google_bigquery_dataset.chunes]
}

# Optional: Grant write access to your Cloud Function service account later
variable "function_sa_email" {
  description = "Cloud Function service account email (optional, for inserting rows)."
  type        = string
  default     = ""
}
