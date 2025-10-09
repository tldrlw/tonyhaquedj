variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "impersonate_service_account" {
  description = "Service account Terraform should impersonate"
  type        = string
}

variable "func_name" {
  default = "main"
  type    = string
}
