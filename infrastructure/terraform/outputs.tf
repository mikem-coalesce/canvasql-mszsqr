# Network outputs
output "vpc_id" {
  description = "ID of the VPC where ERD Tool infrastructure is deployed"
  value       = module.networking.vpc_id
}

output "private_subnets" {
  description = "List of private subnet IDs where application components are deployed"
  value       = module.networking.private_subnet_ids
}

# Compute outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer for accessing the ERD Tool"
  value       = module.compute.alb_dns_name
  sensitive   = false
}

output "instance_ids" {
  description = "IDs of EC2 instances in the Auto Scaling Group"
  value       = module.compute.instance_ids
  sensitive   = false
}

# Database outputs
output "redis_endpoint" {
  description = "Endpoint URL for Redis cache used for session management and real-time collaboration"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "sqlite_volume_id" {
  description = "ID of EBS volume containing SQLite database for persistent storage"
  value       = module.database.sqlite_volume_id
  sensitive   = false
}

# Monitoring outputs
output "grafana_endpoint" {
  description = "Endpoint URL for Grafana monitoring dashboard"
  value       = module.monitoring.grafana_endpoint
  sensitive   = false
}

output "prometheus_endpoint" {
  description = "Endpoint URL for Prometheus metrics server"
  value       = module.monitoring.prometheus_endpoint
  sensitive   = false
}