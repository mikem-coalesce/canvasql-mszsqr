# Main Terraform configuration file for ERD Visualization Tool infrastructure

# Local variables for resource naming and tagging
locals {
  name_prefix = "erd-tool-${var.environment}"
  common_tags = {
    Project     = "ERD-Visualization-Tool"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Networking module for VPC and subnet configuration
module "networking" {
  source = "./modules/networking"

  environment           = var.environment
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  enable_vpc_flow_logs = true
  enable_nat_gateway   = true
  single_nat_gateway   = false # Use multiple NAT gateways for high availability

  tags = merge(local.common_tags, {
    Component = "networking"
  })
}

# Compute module for application servers and load balancing
module "compute" {
  source = "./modules/compute"

  environment               = var.environment
  instance_type            = var.instance_type
  min_size                 = var.min_size
  max_size                 = var.max_size
  vpc_id                   = module.networking.vpc_id
  private_subnets          = module.networking.private_subnets
  enable_detailed_monitoring = true
  enable_cpu_credits       = "unlimited"
  root_volume_size         = 50

  # Auto-scaling policies for performance requirements
  scaling_policies = {
    cpu_utilization = {
      target_value = 70
      scale_in_cooldown  = 300
      scale_out_cooldown = 180
    }
    memory_utilization = {
      target_value = 75
      scale_in_cooldown  = 300
      scale_out_cooldown = 180
    }
  }

  tags = merge(local.common_tags, {
    Component = "compute"
  })

  depends_on = [module.networking]
}

# Database module for Redis cache and SQLite storage
module "database" {
  source = "./modules/database"

  environment            = var.environment
  redis_node_type       = var.redis_node_type
  redis_num_cache_nodes = var.redis_num_cache_nodes
  redis_multi_az        = true
  redis_automatic_failover = true
  sqlite_volume_size    = var.sqlite_volume_size
  sqlite_backup_retention = 7
  vpc_id                = module.networking.vpc_id
  private_subnets       = module.networking.private_subnets
  enable_encryption     = true

  # Performance optimization settings
  redis_parameters = {
    maxmemory_policy = "allkeys-lru"
    maxmemory_samples = 10
    tcp_keepalive = 300
  }

  tags = merge(local.common_tags, {
    Component = "database"
  })

  depends_on = [module.networking]
}

# Monitoring module for observability and alerts
module "monitoring" {
  source = "./modules/monitoring"

  environment            = var.environment
  retention_days        = var.retention_days
  grafana_admin_password = var.grafana_admin_password
  vpc_id                = module.networking.vpc_id
  private_subnets       = module.networking.private_subnets
  enable_alerts         = true
  enable_dashboard      = true
  metrics_resolution    = "1m"
  log_retention_days    = 30

  # Alert configurations
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
      threshold = 3000 # 3 seconds max load time
      period    = "60"
      statistic = "p95"
    }
  }

  tags = merge(local.common_tags, {
    Component = "monitoring"
  })

  depends_on = [module.compute, module.database]
}

# Output values for reference
output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = module.compute.alb_dns_name
}

output "redis_endpoint" {
  description = "Redis cluster endpoint for caching and real-time collaboration"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "sqlite_volume_id" {
  description = "EBS volume ID for SQLite storage"
  value       = module.database.sqlite_volume_id
}

output "monitoring_endpoint" {
  description = "Grafana monitoring dashboard endpoint"
  value       = module.monitoring.grafana_endpoint
  sensitive   = true
}

# Security group rules for application components
resource "aws_security_group_rule" "allow_alb_to_app" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  source_security_group_id = module.compute.alb_security_group_id
  security_group_id        = module.compute.app_security_group_id
}

resource "aws_security_group_rule" "allow_app_to_redis" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = module.compute.app_security_group_id
  security_group_id        = module.database.redis_security_group_id
}

# CloudWatch dashboard for application metrics
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", module.compute.asg_name]
          ]
          period = 300
          stat   = "Average"
          title  = "CPU Utilization"
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", module.database.redis_cluster_id]
          ]
          period = 300
          stat   = "Average"
          title  = "Redis CPU Utilization"
        }
      }
    ]
  })
}