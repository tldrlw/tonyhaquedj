terraform {
  required_version = ">= 1.5.0"
  backend "gcs" {
    bucket = "tfstate-dulcet-provider-474401-d3-us-central1"
    prefix = "envs/dev"
  }
}
