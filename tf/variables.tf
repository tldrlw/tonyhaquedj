variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "dulcet-provider-474401-d3"
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
}
