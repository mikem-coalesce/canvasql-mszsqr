# Terraform module for ERD Visualization Tool monitoring infrastructure
# Version: ~> 2.0 for both kubernetes and helm providers

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# Create dedicated namespace for monitoring components
resource "kubernetes_namespace" "prometheus_namespace" {
  metadata {
    name = "erd-visualization-monitoring"
    labels = {
      environment = var.environment
      app         = "erd-visualization"
      component   = "monitoring"
    }
  }
}

# Deploy Prometheus stack via Helm
resource "helm_release" "prometheus_release" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  namespace  = kubernetes_namespace.prometheus_namespace.metadata[0].name

  values = [
    yamlencode({
      server = {
        retention = "${var.retention_days}d"
        global = {
          scrape_interval     = "15s"
          evaluation_interval = "15s"
        }
        persistentVolume = {
          size         = "50Gi"
          storageClass = "standard"
        }
        resources = {
          requests = {
            cpu    = "500m"
            memory = "512Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "1Gi"
          }
        }
        # Custom scrape configs for ERD application components
        scrapeConfigsYaml = {
          - job_name: "erd-application"
            static_configs:
              - targets: ["erd-api:3000", "erd-websocket:3001"]
            metrics_path: "/metrics"
            scheme: "http"
        }
      }
      alertmanager = {
        enabled = true
        config = {
          global = {
            resolve_timeout = "5m"
          }
          route = {
            group_by    = ["job"]
            group_wait  = "30s"
            group_interval = "5m"
            repeat_interval = "12h"
            receiver = "default-receiver"
          }
          receivers = [{
            name = "default-receiver"
          }]
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.prometheus_namespace]
}

# Deploy Grafana via Helm
resource "helm_release" "grafana_release" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  namespace  = kubernetes_namespace.prometheus_namespace.metadata[0].name

  values = [
    yamlencode({
      adminPassword = var.grafana_admin_password
      persistence = {
        enabled = true
        size    = "10Gi"
      }
      datasources = {
        "datasources.yaml" = {
          apiVersion = 1
          datasources = [{
            name      = "Prometheus"
            type      = "prometheus"
            url       = "http://prometheus-server"
            access    = "proxy"
            isDefault = true
          }]
        }
      }
      dashboardProviders = {
        "dashboardproviders.yaml" = {
          apiVersion = 1
          providers = [{
            name            = "default"
            orgId           = 1
            folder         = ""
            type           = "file"
            disableDeletion = false
            editable       = true
            options = {
              path = "/var/lib/grafana/dashboards"
            }
          }]
        }
      }
      # Pre-configured dashboards for ERD application monitoring
      dashboards = {
        default = {
          erd-application = {
            json = file("${path.module}/dashboards/erd-application.json")
            datasource = "Prometheus"
          }
          erd-performance = {
            json = file("${path.module}/dashboards/erd-performance.json")
            datasource = "Prometheus"
          }
        }
      }
    })
  ]

  depends_on = [helm_release.prometheus_release]
}

# Deploy Loki stack via Helm
resource "helm_release" "loki_release" {
  name       = "loki"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki-stack"
  namespace  = kubernetes_namespace.prometheus_namespace.metadata[0].name

  values = [
    yamlencode({
      loki = {
        persistence = {
          enabled      = true
          size        = "50Gi"
          storageClass = "standard"
        }
        config = {
          retention_period = "${var.retention_days}d"
          chunk_store_config = {
            max_look_back_period = "${var.retention_days}d"
          }
          table_manager = {
            retention_deletes_enabled = true
            retention_period         = "${var.retention_days}d"
          }
        }
      }
      promtail = {
        enabled = true
        config = {
          snippets = {
            extraScrapeConfigs = <<-EOT
              - job_name: erd-application
                static_configs:
                  - targets:
                      - localhost
                    labels:
                      app: erd-visualization
                      __path__: /var/log/erd-*.log
            EOT
          }
        }
      }
    })
  ]

  depends_on = [helm_release.grafana_release]
}

# Output the monitoring namespace name
output "prometheus_namespace" {
  value       = kubernetes_namespace.prometheus_namespace.metadata[0].name
  description = "The name of the monitoring namespace"
}

# Output the Grafana admin password
output "grafana_admin_password" {
  value       = var.grafana_admin_password
  sensitive   = true
  description = "The admin password for Grafana dashboard access"
}