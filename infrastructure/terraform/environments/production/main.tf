# Production environment configuration for ERD Visualization Tool

# Configure required providers
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for production environment
locals {
  production_tags = {
    Environment = "production"
    Project     = "ERD-Tool"
    ManagedBy   = "Terraform"
  }
}

# Production environment variables
variable "environment" {
  type    = string
  default = "production"
}

variable "region" {
  type    = string
  default = "us-west-2"
}

# Production-specific networking configuration
module "networking" {
  source = "../../../terraform/modules/networking"

  environment         = var.environment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]  # Multi-AZ for high availability

  # Production-grade networking features
  enable_vpc_flow_logs = true
  enable_nat_gateway   = true
  single_nat_gateway   = false  # Use multiple NAT gateways for HA

  tags = merge(local.production_tags, {
    Component = "networking"
  })
}

# Production-specific compute configuration
module "compute" {
  source = "../../../terraform/modules/compute"

  environment     = var.environment
  instance_type  = "t3.large"  # Sized for production workloads
  min_size       = 3          # Minimum instances for HA
  max_size       = 6          # Maximum instances for scaling
  
  vpc_id          = module.networking.vpc_id
  private_subnets = module.networking.private_subnets

  # Production-grade compute features
  enable_detailed_monitoring = true
  enable_cpu_credits        = "unlimited"
  root_volume_size         = 100

  # Auto-scaling policies for production performance
  scaling_policies = {
    cpu_utilization = {
      target_value       = 70
      scale_in_cooldown  = 300
      scale_out_cooldown = 180
    }
    memory_utilization = {
      target_value       = 75
      scale_in_cooldown  = 300
      scale_out_cooldown = 180
    }
  }

  tags = merge(local.production_tags, {
    Component = "compute"
  })

  depends_on = [module.networking]
}

# Production-specific database configuration
module "database" {
  source = "../../../terraform/modules/database"

  environment            = var.environment
  redis_node_type       = "cache.t3.medium"
  redis_num_cache_nodes = 3          # Multiple nodes for HA
  redis_multi_az        = true       # Enable Multi-AZ deployment
  redis_automatic_failover = true
  sqlite_volume_size    = 100        # Larger volume for production data
  sqlite_backup_retention = 30        # Longer backup retention

  vpc_id          = module.networking.vpc_id
  private_subnets = module.networking.private_subnets

  # Production-grade database features
  enable_encryption = true
  redis_parameters = {
    maxmemory_policy  = "allkeys-lru"
    maxmemory_samples = 10
    tcp_keepalive     = 300
  }

  tags = merge(local.production_tags, {
    Component = "database"
  })

  depends_on = [module.networking]
}

# Production-specific monitoring configuration
module "monitoring" {
  source = "../../../terraform/modules/monitoring"

  environment         = var.environment
  retention_days     = 90           # Longer retention for production metrics
  vpc_id             = module.networking.vpc_id
  private_subnets    = module.networking.private_subnets

  # Production-grade monitoring features
  enable_alerts      = true
  enable_dashboard   = true
  metrics_resolution = "1m"
  log_retention_days = 90

  # Production alert configurations
  alert_configurations = {
    high_cpu = {
      threshold = 80
      period    = "300"
      statistic = "Average"
    }
    high_memory = {
      threshold = 85
      period    = "300"
      statistic = "Average"
    }
    response_time = {
      threshold = 3000  # 3 seconds max load time requirement
      period    = "60"
      statistic = "p95"
    }
  }

  tags = merge(local.production_tags, {
    Component = "monitoring"
  })

  depends_on = [module.compute, module.database]
}

# Production outputs
output "alb_dns_name" {
  description = "DNS name of the production load balancer"
  value       = module.compute.alb_dns_name
}

output "redis_endpoint" {
  description = "Production Redis cache endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}