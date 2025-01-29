# Configure Terraform version constraints
terraform {
  required_version = ">= 1.0"

  # Configure required providers with version constraints
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  # Configure remote state backend with encryption and locking
  backend "s3" {
    bucket = "erd-tool-terraform-state"
    key    = "terraform.tfstate"
    region = "${var.region}"

    # Enable encryption and versioning
    encrypt = true
    acl     = "private"

    # Configure state locking using DynamoDB
    dynamodb_table = "terraform-state-lock"

    # Enable server-side encryption
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }

    # Enable access logging
    logging {
      target_bucket = "erd-tool-terraform-logs"
      target_prefix = "state-access-logs/"
    }
  }
}

# Configure AWS provider with secure defaults
provider "aws" {
  region = var.region

  # Configure default tags for all resources
  default_tags {
    Environment        = var.environment
    Project           = "ERD-Visualization-Tool"
    ManagedBy         = "Terraform"
    Application       = "ERD-Tool"
    SecurityLevel     = "High"
    DataClassification = "Internal"
    BackupRequired    = "true"
    LastUpdated       = timestamp()
  }

  # Configure default security settings
  default_network_acl_deny_all = true
  default_security_group_deny_all = true
  default_vpc_enable_dns_hostnames = true
  default_vpc_enable_dns_support = true

  # Enable IAM role support for service accounts
  enable_iam_role_arn_generation = true
}