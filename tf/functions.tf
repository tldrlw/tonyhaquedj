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
    "pubsub.googleapis.com", # 👈 add this
  ])
  project            = local.project_id
  service            = each.key
  disable_on_destroy = false
}

# Function runtime SA
resource "google_service_account" "fn_sa" {
  account_id   = "main-fn-sa"
  display_name = "main-fn-sa"
}

# IAM for Eventarc and Logs
resource "google_project_iam_member" "fn_eventarc" {
  project = local.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.fn_sa.email}"
}

resource "google_project_iam_member" "fn_logs" {
  project = local.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.fn_sa.email}"
}

# Allow function to write to the dataset
resource "google_bigquery_dataset_iam_member" "fn_bq_writer" {
  project    = local.project_id
  dataset_id = google_bigquery_dataset.chunes.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.fn_sa.email}"
}

# Build source bundle
resource "google_storage_bucket" "build_src" {
  name                        = "${local.project_id}-fn-src"
  location                    = local.region
  uniform_bucket_level_access = true
  force_destroy               = true
}

data "archive_file" "fn_zip" {
  type        = "zip"
  source_dir  = local.source_dir
  output_path = "${path.module}/.tmp/main.zip"
}

resource "google_storage_bucket_object" "fn_src" {
  name          = "main-${data.archive_file.fn_zip.output_md5}.zip"
  bucket        = google_storage_bucket.build_src.name
  source        = data.archive_file.fn_zip.output_path
  cache_control = "no-store"
}

# Event-triggered Cloud Function (Gen 2)
resource "google_cloudfunctions2_function" "main" {
  name     = local.func_name
  location = local.region

  build_config {
    runtime     = "nodejs20"
    entry_point = "handleGcsFinalize"
    source {
      storage_source {
        bucket = google_storage_bucket.build_src.name
        object = google_storage_bucket_object.fn_src.name
      }
    }
  }

  service_config {
    service_account_email = google_service_account.fn_sa.email
    available_memory      = "1024M"
    timeout_seconds       = 300
    environment_variables = {
      BQ_DATASET = local.bq_dataset
      BQ_TABLE   = local.bq_table
    }
  }

  event_trigger {
    event_type     = "google.cloud.storage.object.v1.finalized"
    trigger_region = local.region
    event_filters {
      attribute = "bucket"
      value     = local.bucket
    }
    retry_policy = "RETRY_POLICY_RETRY"
  }

  depends_on = [
    google_project_service.apis,
    google_service_account.fn_sa,
    google_bigquery_dataset_iam_member.fn_bq_writer
  ]
}
