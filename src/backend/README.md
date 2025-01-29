# Collaborative ERD Visualization Tool - Backend Server

## Overview

Enterprise-grade Node.js backend server for the Collaborative ERD Visualization Tool, providing real-time collaboration features, secure authentication, and optimized database schema management.

## Technology Stack

- **Runtime**: Node.js 18 LTS
- **Language**: TypeScript 5.0+
- **Framework**: Express 4.18+
- **Real-time**: Y.js 13.x for CRDT-based collaboration
- **Database**: SQLite 3.x with Prisma ORM
- **Caching**: Redis 7.x for session management
- **Authentication**: Auth.js with JWT (RS256)
- **WebSocket**: ws 8.x for real-time communication
- **Validation**: Zod 3.x for runtime type checking
- **Logging**: Winston 3.x with daily rotation
- **Metrics**: Prometheus + Grafana

## Prerequisites

- Node.js >= 18.0.0 LTS
- Redis >= 7.x
- SQLite >= 3.x
- pnpm >= 8.x (recommended)
- OpenSSL for JWT key generation

## Installation

1. Clone the repository and navigate to backend directory:
```bash
git clone <repository-url>
cd src/backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Generate JWT keys:
```bash
mkdir -p config/keys
openssl genrsa -out config/keys/jwt-private.pem 4096
openssl rsa -in config/keys/jwt-private.pem -pubout -out config/keys/jwt-public.pem
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Initialize database:
```bash
pnpm prisma generate
pnpm prisma migrate deploy
```

6. Start development server:
```bash
pnpm dev
```

## Project Structure

```
src/
├── api/
│   ├── controllers/    # Request handlers
│   ├── middlewares/    # Express middlewares
│   ├── routes/         # API route definitions
│   └── validators/     # Request validation schemas
├── config/
│   ├── auth.config.ts  # Authentication configuration
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── websocket.config.ts
├── core/
│   ├── errors/         # Custom error classes
│   ├── interfaces/     # TypeScript interfaces
│   ├── types/          # TypeScript types
│   └── utils/          # Utility functions
├── services/           # Business logic
├── websocket/
│   ├── handlers/       # WebSocket event handlers
│   └── types/         # WebSocket types
└── server.ts          # Application entry point
```

## Key Features

### Real-time Collaboration
- CRDT-based synchronization using Y.js
- Cursor tracking with < 100ms latency
- User presence indicators
- Concurrent editing support
- Automatic conflict resolution

### Security
- JWT authentication with RS256 signing
- Role-based access control (RBAC)
- Rate limiting and DDoS protection
- Input validation and sanitization
- Secure WebSocket connections
- CORS and security headers

### Performance
- Redis caching for sessions
- Connection pooling
- Request compression
- Optimized WebSocket communication
- Efficient SQL parsing and validation

### Monitoring
- Prometheus metrics collection
- Grafana dashboards
- Winston logging with rotation
- Error tracking and reporting
- Performance monitoring

## API Documentation

API documentation is available at `/api-docs` when running the server. Key endpoints include:

- Authentication: `/api/v1/auth/*`
- Workspaces: `/api/v1/workspaces/*`
- Projects: `/api/v1/projects/*`
- Diagrams: `/api/v1/diagrams/*`

## WebSocket Protocol

WebSocket endpoints for real-time features:

- Collaboration: `/ws/collaboration`
- Cursor Tracking: `/ws/cursors`
- User Presence: `/ws/presence`

## Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm test         # Run tests
pnpm lint         # Lint code
pnpm format       # Format code
```

### Testing

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:e2e         # E2E tests
```

### Code Style

- ESLint for linting
- Prettier for formatting
- Husky for git hooks
- Conventional commits

## Deployment

### Production Setup

1. Build the application:
```bash
pnpm build
```

2. Configure production environment:
```bash
# Set production environment variables
NODE_ENV=production
PORT=3000
```

3. Start the server:
```bash
pnpm start
```

### Docker Deployment

```bash
# Build image
docker build -t erd-backend .

# Run container
docker run -p 3000:3000 erd-backend
```

### Monitoring Setup

1. Configure Prometheus:
```bash
# prometheus.yml
scrape_configs:
  - job_name: 'erd-backend'
    static_configs:
      - targets: ['localhost:3000']
```

2. Configure Grafana dashboards using provided templates

## Performance Requirements

- Maximum concurrent users per workspace: 25
- WebSocket latency: < 100ms
- API response time: < 200ms
- Maximum memory usage: 1GB per instance

## License

[License Type] - See LICENSE file for details