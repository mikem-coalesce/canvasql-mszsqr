# Contributing to Collaborative ERD Visualization Tool

Thank you for considering contributing to the Collaborative ERD Visualization Tool. This document provides comprehensive guidelines for contributing to our project.

## Code of Conduct

All contributors are expected to adhere to our Code of Conduct. By participating in this project, you agree to abide by its terms. Please report any unacceptable behavior to the project maintainers.

## Development Setup

### Prerequisites

- Node.js 18 LTS
- pnpm 8.x
- Git
- IDE with TypeScript support (recommended: VS Code)
- Redis 7.x
- SQLite 3.x

### Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/erd-visualization-tool.git
cd erd-visualization-tool
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment:
```bash
cp .env.example .env
```

4. Start development services:
```bash
# Start Redis
redis-server

# Start development server
pnpm dev
```

## Development Workflow

### Branching Strategy

- `main` - Production releases only
- `develop` - Main development branch
- `feature/*` - New features (e.g., `feature/real-time-sync`)
- `bugfix/*` - Bug fixes (e.g., `bugfix/connection-timeout`)
- `hotfix/*` - Urgent production fixes

### Creating a Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

Example:
```
feat(erd): add real-time cursor tracking

Implements collaborative cursor tracking feature using Y.js
Closes #123
```

## Code Standards

### TypeScript Guidelines

- Enable strict mode in `tsconfig.json`
- Use interfaces for type definitions
- Document complex functions and types
- Handle errors comprehensively
- Use meaningful variable names

Example:
```typescript
interface TableNode {
  id: string;
  name: string;
  columns: Column[];
}

function validateTableNode(node: TableNode): ValidationResult {
  // Implementation
}
```

### Testing Requirements

- Unit test coverage > 80%
- Integration tests for all API endpoints
- E2E tests with Playwright
- Performance benchmarks for critical operations

```bash
# Run tests
pnpm test

# Check coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

## Pull Request Process

1. Update documentation for any new features
2. Add/update tests as required
3. Ensure all tests pass locally
4. Update the changelog
5. Fill out the PR template completely
6. Request review from maintainers

## Security Guidelines

### Security Considerations

- Validate all user inputs
- Implement XSS prevention measures
- Use CSRF tokens for forms
- Follow authentication best practices
- Encrypt sensitive data

### Vulnerability Reporting

1. **Do not** create public issues for security vulnerabilities
2. Email security@your-org.com with details
3. Include steps to reproduce
4. Wait for confirmation before disclosure

## Performance Guidelines

- Follow React best practices
- Optimize database queries
- Implement proper caching
- Monitor bundle size
- Profile rendering performance

## Documentation

- Update README.md for new features
- Document API changes
- Include JSDoc comments
- Update changelog
- Add migration guides if needed

## Getting Help

- Check existing issues and discussions
- Join our Discord community
- Review documentation
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the project's license.

## Additional Resources

- [Issue Templates](.github/ISSUE_TEMPLATE/)
- [Pull Request Template](.github/pull_request_template.md)
- [CI Pipeline](.github/workflows/ci.yml)
- Project Documentation