# AWS Provider configuration is inherited from root module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Redis subnet group for cache cluster deployment
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name        = "${var.environment}-redis-subnet-group"
  subnet_ids  = var.private_subnets
  description = "Subnet group for Redis cache cluster"
}

# Redis parameter group for optimized cache settings
resource "aws_elasticache_parameter_group" "redis_parameter_group" {
  family      = "redis7"
  name        = "${var.environment}-redis-params"
  description = "Redis parameter group for ERD tool"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }
}

# Redis security group for network access control
resource "aws_security_group" "redis_sg" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for Redis cache cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Redis port access from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.environment}-redis-sg"
    Environment = var.environment
  }
}

# KMS key for SQLite volume encryption
resource "aws_kms_key" "sqlite_key" {
  description             = "KMS key for SQLite volume encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "${var.environment}-sqlite-kms-key"
    Environment = var.environment
  }
}

# Redis cache cluster for session management and real-time collaboration
resource "aws_elasticache_cluster" "redis_cluster" {
  cluster_id               = "${var.environment}-redis"
  engine                  = "redis"
  engine_version          = "7.0"
  node_type               = var.redis_node_type
  num_cache_nodes         = var.redis_num_cache_nodes
  parameter_group_name    = aws_elasticache_parameter_group.redis_parameter_group.name
  subnet_group_name       = aws_elasticache_subnet_group.redis_subnet_group.name
  port                    = 6379
  security_group_ids      = [aws_security_group.redis_sg.id]
  snapshot_retention_limit = 7
  snapshot_window         = "05:00-09:00"
  maintenance_window      = "mon:22:00-mon:23:30"
  automatic_failover_enabled = true
  multi_az_enabled        = true

  tags = {
    Environment = var.environment
    Purpose     = "ERD Tool Cache Layer"
  }
}

# EBS volume for SQLite database storage
resource "aws_ebs_volume" "sqlite_volume" {
  availability_zone = var.availability_zones[0]
  size             = var.sqlite_volume_size
  type             = "gp3"
  iops             = 3000
  throughput       = 125
  encrypted        = true
  kms_key_id       = aws_kms_key.sqlite_key.id

  tags = {
    Name        = "${var.environment}-sqlite-volume"
    Environment = var.environment
    Purpose     = "ERD Tool Persistent Storage"
  }
}

# Variables declaration
variable "environment" {
  type        = string
  description = "Deployment environment (staging/production)"
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where database resources will be deployed"
}

variable "private_subnets" {
  type        = list(string)
  description = "List of private subnet IDs for database deployment"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block of the VPC for security group rules"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for database deployment"
}

# Outputs for use by other modules
output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis_cluster.cache_nodes[0].address
  description = "Endpoint for connecting to Redis cache cluster"
}

output "sqlite_volume_id" {
  value       = aws_ebs_volume.sqlite_volume.id
  description = "EBS volume ID containing SQLite database"
}