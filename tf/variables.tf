variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "impersonate_service_account" {
  description = "Service account Terraform should impersonate"
  type        = string
}

variable "func_name" {
  default = "main"
  type    = string
}

variable "exporter_invoker_user" {
  description = "User allowed to invoke the exporter function (the account you use with gcloud)."
  type        = string
  default     = "tonyhaquedj@gmail.com" # <-- set this to your email
}

variable "bq_dataset" {
  type    = string
  default = "chunes"
}

variable "bq_table" {
  type    = string
  default = "tracks"
}
