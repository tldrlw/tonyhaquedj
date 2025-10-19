# Package source
data "archive_file" "fn_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/main"
  output_path = "${path.module}/.tmp/main.zip"
}

resource "google_storage_bucket_object" "fn_src" {
  name          = "main-${data.archive_file.fn_zip.output_md5}.zip"
  bucket        = google_storage_bucket.build_src.name
  source        = data.archive_file.fn_zip.output_path
  cache_control = "no-store"
}

# Cloud Function (Gen 2) with Eventarc trigger
resource "google_cloudfunctions2_function" "main" {
  name     = var.func_name
  location = var.region # ensure this matches your bucket's region
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
      BQ_DATASET = var.bq_dataset
      BQ_TABLE   = var.bq_table
    }
  }

  event_trigger {
    event_type            = "google.cloud.storage.object.v1.finalized"
    trigger_region        = var.region
    service_account_email = google_service_account.eventarc_invoker.email
    event_filters {
      attribute = "bucket"
      value     = google_storage_bucket.chunes.name
    }
    retry_policy = "RETRY_POLICY_RETRY"
  }
  # Make sure the trigger's required IAM is in place BEFORE creation
  depends_on = [
    google_project_service.apis,
    google_storage_bucket.chunes,
    google_storage_bucket.build_src,
    google_service_account.fn_sa,
    google_service_account.eventarc_invoker,
    google_bigquery_dataset_iam_member.fn_bq_writer,
    google_project_iam_binding.eventarc_invoker_event_receiver, # already added
    google_project_iam_member.terraform_cf_admin,               # <-- add this
    google_service_account_iam_member.terraform_can_act_as_eventarc_invoker
  ]
}

resource "google_cloudfunctions2_function" "exporter" {
  name     = "export-snapshot"
  location = var.region

  build_config {
    runtime     = "nodejs20"
    entry_point = "exportSnapshot" # exported via index.js → exporter.js
    source {
      storage_source {
        bucket = google_storage_bucket.build_src.name
        object = google_storage_bucket_object.fn_src.name
      }
    }
  }
  service_config {
    service_account_email = google_service_account.fn_sa_exporter.email
    available_memory      = "2048M"
    timeout_seconds       = 540
    max_instance_count    = 1
    environment_variables = {
      PROJECT_ID  = var.project_id # <— add this
      BQ_DATASET  = var.bq_dataset
      BQ_TABLE    = var.bq_table
      GCS_BUCKET  = google_storage_bucket.snapshots.name
      GCS_PREFIX  = "snapshots"
      BQ_LOCATION = var.region
    }
  }
  # HTTP-only (no event_trigger)
  depends_on = [
    google_project_service.apis,
    google_storage_bucket.build_src,
    google_storage_bucket_object.fn_src,
    google_service_account.fn_sa_exporter,
    google_storage_bucket.snapshots,
  ]
}
