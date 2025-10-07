# Enable BigQuery API
resource "google_project_service" "bigquery" {
  project            = local.project_id
  service            = "bigquery.googleapis.com"
  disable_on_destroy = false
}

# Create the dataset
resource "google_bigquery_dataset" "chunes" {
  project    = local.project_id
  dataset_id = local.bq_dataset
  location   = local.region
  depends_on = [google_project_service.bigquery]
}

# Create the table
resource "google_bigquery_table" "tracks" {
  project    = local.project_id
  dataset_id = google_bigquery_dataset.chunes.dataset_id
  table_id   = local.bq_table

  deletion_protection = false

  schema = jsonencode([
    { "name" : "gcs_bucket", "type" : "STRING", "mode" : "REQUIRED", "description" : "Source bucket name" },
    { "name" : "gcs_object", "type" : "STRING", "mode" : "REQUIRED", "description" : "Full GCS object path" },
    { "name" : "size_bytes", "type" : "INT64", "mode" : "NULLABLE", "description" : "File size in bytes" },
    { "name" : "content_type", "type" : "STRING", "mode" : "NULLABLE", "description" : "MIME type" },
    { "name" : "track_id", "type" : "INT64", "mode" : "NULLABLE", "description" : "Beatport track ID" },
    { "name" : "track_name", "type" : "STRING", "mode" : "NULLABLE", "description" : "Track title" },
    { "name" : "artists", "type" : "STRING", "mode" : "NULLABLE", "description" : "Artist(s)" },
    { "name" : "mix_name", "type" : "STRING", "mode" : "NULLABLE", "description" : "Mix or version name" },
    { "name" : "bpm", "type" : "INT64", "mode" : "NULLABLE", "description" : "Beats per minute" },
    { "name" : "musical_key", "type" : "STRING", "mode" : "NULLABLE", "description" : "Musical key (e.g., Em, Ab)" },
    { "name" : "camelot_key", "type" : "STRING", "mode" : "NULLABLE", "description" : "Camelot key (e.g., 9A)" },
    { "name" : "label", "type" : "STRING", "mode" : "NULLABLE", "description" : "Record label" },
    { "name" : "release_date", "type" : "TIMESTAMP", "mode" : "NULLABLE", "description" : "Track release date" },
    { "name" : "purchase_date", "type" : "TIMESTAMP", "mode" : "NULLABLE", "description" : "Date you purchased/downloaded the track" },
    { "name" : "file_ext", "type" : "STRING", "mode" : "NULLABLE", "description" : "File extension (e.g., mp3, aiff)" },
    { "name" : "ingested_at", "type" : "TIMESTAMP", "mode" : "REQUIRED", "description" : "Time metadata was ingested" }
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
