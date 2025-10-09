########################
# Service Accounts
########################

# Runtime SA for the Cloud Function (Gen2)
resource "google_service_account" "fn_sa" {
  account_id   = "main-fn-sa"
  display_name = "main-fn-sa"
}

# SA used by the Eventarc trigger to invoke the function
resource "google_service_account" "eventarc_invoker" {
  account_id   = "eventarc-invoker"
  display_name = "Eventarc trigger invoker"
}

########################
# Project-level IAM for runtime SA
########################

# Receive events (required for Gen2 CF behind Eventarc)
resource "google_project_iam_member" "fn_eventarc" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.fn_sa.email}"
}

# Write logs
resource "google_project_iam_member" "fn_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.fn_sa.email}"
}

########################
# BigQuery dataset write for runtime SA
########################

resource "google_bigquery_dataset_iam_member" "fn_bq_writer" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.chunes.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.fn_sa.email}"
}

########################
# Eventarc trigger identity grants
########################

# Let the Eventarc trigger SA invoke the Gen2 function
# (Bind to the function resource; no Cloud Run IAM → no TF cycle)
resource "google_cloudfunctions2_function_iam_member" "eventarc_invoker_can_call" {
  project        = var.project_id
  location       = google_cloudfunctions2_function.main.location
  cloud_function = google_cloudfunctions2_function.main.name
  role           = "roles/cloudfunctions.invoker"
  member         = "serviceAccount:${google_service_account.eventarc_invoker.email}"
}

# Allow Terraform deployer SA to impersonate the Eventarc trigger SA
resource "google_service_account_iam_member" "terraform_can_act_as_eventarc_invoker" {
  service_account_id = google_service_account.eventarc_invoker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.impersonate_service_account}"
}

# Give the Eventarc trigger SA permission to receive events (project-wide)
# Use BINDING (not member) to avoid fragmented policies during validation.
resource "google_project_iam_binding" "eventarc_invoker_event_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"

  members = [
    "serviceAccount:${google_service_account.eventarc_invoker.email}",
  ]
}

# Allow Terraform deployer SA to manage CF Gen2 IAM (needed for google_cloudfunctions2_function_iam_member)
resource "google_project_iam_member" "terraform_cf_admin" {
  project = var.project_id
  role    = "roles/cloudfunctions.admin"
  member  = "serviceAccount:${var.impersonate_service_account}"
}

# Allow the Eventarc trigger SA to invoke the underlying Cloud Run service of the Gen2 function
resource "google_cloud_run_service_iam_member" "eventarc_invoker_run" {
  project  = var.project_id
  location = var.region
  service  = google_cloudfunctions2_function.main.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.eventarc_invoker.email}"
}
