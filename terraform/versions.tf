terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Credentials come from `aws configure` / environment variables, never from these files.
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "stockflow"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
