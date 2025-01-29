# Environment configuration
variable "environment" {
  type        = string
  description = "Deployment environment (staging/production)"
  default     = "staging"

  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either staging or production"
  }
}

# AWS Region configuration
variable "region" {
  type        = string
  description = "AWS region for deployment"
  default     = "us-west-2"
}

# Network configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for high availability deployment"
  default     = ["us-west-2a", "us-west-2b"]
}

# EC2 configuration
variable "instance_type" {
  type        = string
  description = "EC2 instance type for application servers optimized for 25 concurrent users per workspace"
  default     = "t3.medium"
}

variable "min_size" {
  type        = number
  description = "Minimum number of EC2 instances in auto-scaling group for high availability"
  default     = 2
}

variable "max_size" {
  type        = number
  description = "Maximum number of EC2 instances in auto-scaling group for load handling"
  default     = 4
}

# Redis configuration
variable "redis_node_type" {
  type        = string
  description = "Redis node type for caching and real-time collaboration state"
  default     = "cache.t3.medium"
}

variable "redis_num_cache_nodes" {
  type        = number
  description = "Number of Redis cache nodes for high availability"
  default     = 2
}

# Storage configuration
variable "sqlite_volume_size" {
  type        = number
  description = "Size in GB for SQLite EBS volume with room for growth"
  default     = 50
}

# Monitoring configuration
variable "retention_days" {
  type        = number
  description = "Number of days to retain monitoring data for analysis"
  default     = 30
}

variable "grafana_admin_password" {
  type        = string
  description = "Admin password for Grafana monitoring dashboard"
  sensitive   = true
}