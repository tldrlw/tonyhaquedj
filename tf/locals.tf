locals {
  project_id = "dulcet-provider-474401-d3"
  region     = "us-central1"
  bucket     = google_storage_bucket.chunes.name
  func_name  = "main"
  source_dir = "${path.module}/../functions/main"
  bq_dataset = "chunes"
  bq_table   = "tracks"
}
