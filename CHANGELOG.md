# Changelog
All notable changes to the Collaborative ERD Visualization Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each version entry includes both frontend (FE) and backend (BE) version numbers where applicable.

## [Unreleased]

### Added
- Initial project scaffolding and core dependencies setup
- Basic project documentation and contribution guidelines

## [1.0.0] - 2024-01-15

FE: 1.0.0
BE: 1.0.0

### Added
- Real-time collaborative ERD editing with Y.js integration [#101]
- SQL DDL parsing and ERD generation for PostgreSQL and Snowflake [#102]
- Interactive diagram canvas powered by React Flow [#103]
- Multi-user presence indicators and cursor tracking [#104]
- Project and workspace management with role-based access control [#105]
- User authentication system via Auth.js [#106]
- Version history with comprehensive change tracking [#107]
- Dark/light theme support using Tailwind CSS [#108]
- Export capabilities for PNG/SVG formats [#109]
- Real-time chat and collaboration features [#110]
- Performance monitoring and error tracking integration [#111]
- Security features including CSP and API rate limiting [#112]

### Security
- Implement Content Security Policy (CSP) headers [#113]
- Add rate limiting for API endpoints [#114]
- Enable CSRF protection for all forms [#115]
- Implement secure session management [#116]
- Add input validation and sanitization [#117]

### Changed
- Optimize SQL parsing performance for large schemas [#118]
- Enhance WebSocket connection stability [#119]
- Improve ERD layout algorithms [#120]

### Fixed
- Resolve concurrent editing conflicts in complex diagrams [#121]
- Fix memory leaks in WebSocket connections [#122]
- Address cross-browser compatibility issues [#123]

### Documentation
- Add comprehensive API documentation [#124]
- Include deployment guides for various environments [#125]
- Provide user manual with best practices [#126]

[Unreleased]: https://github.com/username/repo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/username/repo/releases/tag/v1.0.0