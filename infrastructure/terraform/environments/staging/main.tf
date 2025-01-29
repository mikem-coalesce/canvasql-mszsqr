# Configure AWS provider for staging environment
provider "aws" {
  region = "us-west-2"
  default_tags {
    Environment = "staging"
    Project     = "erd-visualization-tool"
  }
}

# Local variables for staging-specific configuration
locals {
  environment          = "staging"
  instance_type       = "t3.medium"
  min_size           = 2
  max_size           = 4
  redis_node_type    = "cache.t3.medium"
  redis_num_cache_nodes = 2
  sqlite_volume_size = 50
  retention_days     = 30
}

# Configure staging environment infrastructure using root module
module "staging" {
  source = "../../"

  # Environment configuration
  environment = "staging"
  region     = "us-west-2"

  # Network configuration
  vpc_cidr           = "10.1.0.0/16"  # Staging-specific CIDR range
  availability_zones = ["us-west-2a", "us-west-2b"]

  # Compute configuration optimized for staging workloads
  instance_type = local.instance_type
  min_size     = local.min_size
  max_size     = local.max_size

  # Database configuration for staging environment
  redis_node_type       = local.redis_node_type
  redis_num_cache_nodes = local.redis_num_cache_nodes
  sqlite_volume_size    = local.sqlite_volume_size

  # Monitoring configuration
  retention_days = local.retention_days
}

# Output staging-specific resource information
output "staging_alb_dns_name" {
  description = "DNS name of the staging application load balancer"
  value       = module.staging.alb_dns_name
}

output "staging_redis_endpoint" {
  description = "Endpoint for connecting to staging Redis cache"
  value       = module.staging.redis_endpoint
}