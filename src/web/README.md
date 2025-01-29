# Collaborative ERD Visualization Tool - Frontend

A real-time web application for collaborative database schema design and visualization, enabling teams to create, edit, and share Entity Relationship Diagrams with automated SQL DDL parsing capabilities.

## Features

- Real-time collaborative diagram editing with presence indicators
- Automated ERD generation from SQL DDL statements
- Interactive node-based diagram interface
- Multi-user editing with conflict resolution
- Customizable and accessible UI components
- Enterprise-grade security and performance

## Prerequisites

- Node.js 18 LTS or higher
- pnpm 8.x or higher
- Supported Browsers:
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+
  - Opera 76+

## Installation

1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```

## Available Scripts

- `pnpm dev` - Start development server with HMR
- `pnpm build` - Build production-ready bundle with type checking
- `pnpm preview` - Preview production build locally
- `pnpm lint` - Run ESLint checks with automatic fixing
- `pnpm format` - Format code using Prettier
- `pnpm test` - Run unit tests with watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm type-check` - Run TypeScript type checking

## Technology Stack

- **Core Framework**: React 18.2.0
- **Language**: TypeScript 5.2.0
- **Build Tool**: Vite 4.5.0
- **Diagram Rendering**: React Flow 11.0.0
- **Real-time Collaboration**: Y.js 13.6.0
- **State Management**: Zustand 4.4.0
- **UI Components**: shadcn/ui 1.0.0
- **Styling**: Tailwind CSS 3.3.0
- **Testing**: 
  - Vitest 0.34.0 (Unit Testing)
  - Playwright 1.38.0 (E2E Testing)

## Project Structure

```
src/
├── components/       # Reusable UI components
├── features/        # Feature-specific components and logic
├── hooks/           # Custom React hooks
├── lib/            # Utility functions and shared code
├── pages/          # Route components
├── services/       # API and external service integrations
├── store/          # Zustand store definitions
├── styles/         # Global styles and Tailwind configuration
├── types/          # TypeScript type definitions
└── utils/          # Helper functions and utilities
```

## Development Guidelines

### Code Style

- Follow TypeScript strict mode guidelines
- Use functional components with hooks
- Implement proper error boundaries
- Write comprehensive unit tests
- Document complex logic and components
- Follow accessibility best practices

### Git Workflow

1. Create feature branch from `main`
2. Make focused, atomic commits
3. Write descriptive commit messages
4. Submit PR with comprehensive description
5. Address review feedback
6. Squash and merge to `main`

## Environment Variables

```bash
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_MONITORING=true

# Authentication
VITE_AUTH_DOMAIN=auth.example.com
VITE_AUTH_CLIENT_ID=your_client_id
```

## Testing

### Unit Tests

- Write tests for all business logic
- Maintain high test coverage (target: 80%+)
- Run tests before commits:
```bash
pnpm test
```

### E2E Tests

- Cover critical user flows
- Test cross-browser compatibility
- Run E2E tests before deployment:
```bash
pnpm test:e2e
```

## Building for Production

1. Set production environment variables
2. Run production build:
```bash
pnpm build
```
3. Preview build locally:
```bash
pnpm preview
```

## Performance Optimization

- Implement code splitting
- Optimize asset loading
- Enable tree shaking
- Compress static assets
- Cache API responses
- Lazy load components

## Security Best Practices

- Implement Content Security Policy
- Sanitize user inputs
- Use HTTPS for all requests
- Implement proper CORS policies
- Follow secure authentication flows
- Regular dependency updates

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Clear build cache
   - Update dependencies
   - Check TypeScript errors

2. **Development Server Issues**
   - Verify Node.js version
   - Check port availability
   - Clear browser cache

3. **Testing Problems**
   - Update test snapshots
   - Clear test cache
   - Check browser drivers

## Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome  | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari  | 14+ | Limited cursor tracking |
| Edge    | 90+ | Full support |
| Opera   | 76+ | Full support |

## Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Update documentation
6. Submit pull request

## License

This project is proprietary and confidential. All rights reserved.

## Support

For technical support or questions, please contact the development team through:
- Issue Tracker
- Development Chat
- Technical Documentation