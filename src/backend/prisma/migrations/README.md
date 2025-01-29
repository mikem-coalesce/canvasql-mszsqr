# Database Migrations Guide

This guide documents the migration management system for the Collaborative ERD Visualization Tool using Prisma with SQLite.

## Table of Contents
- [Overview](#overview)
- [Migration Workflow](#migration-workflow)
- [Commands Reference](#commands-reference)
- [Best Practices](#best-practices)
- [Rollback Procedures](#rollback-procedures)
- [Version Control Guidelines](#version-control-guidelines)
- [Environment Management](#environment-management)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses Prisma Migrate (^5.0.0) with SQLite for database schema management. All migrations are version-controlled and require proper testing before production deployment.

### Key Requirements
- Database backups before migrations
- Team review for production migrations
- Documented rollback procedures
- Performance impact assessment
- Version control integration

## Migration Workflow

1. **Create Migration**
   ```bash
   # Generate migration from schema changes
   prisma migrate dev --name descriptive_name
   ```
   - Review generated SQL in `migrations/[timestamp]_descriptive_name.sql`
   - Verify changes match intended schema modifications

2. **Testing**
   - Test migration in development environment
   - Verify data integrity
   - Measure performance impact
   - Document rollback steps

3. **Staging Validation**
   ```bash
   # Apply to staging environment
   prisma migrate deploy
   ```
   - Validate against production-like data
   - Verify application functionality
   - Test rollback procedures

4. **Production Deployment**
   ```bash
   # Before deployment
   prisma migrate status
   
   # Deploy migration
   prisma migrate deploy
   ```

## Commands Reference

### Essential Commands
```bash
# Create new migration
prisma migrate dev --name add_user_email

# Deploy migrations
prisma migrate deploy

# Reset database (development only)
prisma migrate reset

# Check migration status
prisma migrate status

# Preview schema changes (development)
prisma db push --preview-feature

# Compare schema changes
prisma migrate diff
```

### Environment Variables
```bash
# Development
DATABASE_URL="file:./dev.db"

# Staging/Production
DATABASE_URL="file:./prod.db"
```

## Best Practices

### Migration Creation
- One logical change per migration
- Descriptive, timestamped names
- Include both up and down migrations
- Test with production-scale data volume

### Naming Conventions
```
YYYYMMDDHHMMSS_descriptive_name.sql
Example: 20231025143022_add_user_email_verification.sql
```

### Performance Considerations
- Review generated SQL for efficiency
- Test with representative data volumes
- Monitor migration execution times
- Consider indexing impact

### Team Coordination
- Communicate migration plans
- Review migrations as pull requests
- Document breaking changes
- Maintain migration history

## Rollback Procedures

### Before Migration
1. Create full database backup
2. Document current schema version
3. Verify backup integrity

### Rollback Steps
1. Stop application services
2. Execute rollback migration
3. Verify data integrity
4. Restart services
5. Validate application functionality

### Emergency Rollback
```bash
# Revert to previous migration
prisma migrate reset --to [previous_migration]

# Restore from backup if needed
sqlite3 prod.db ".restore 'backup.db'"
```

## Version Control Guidelines

### Git Integration
- Commit migrations with schema changes
- Include migration documentation
- Tag significant schema versions

### File Structure
```
prisma/
├── migrations/
│   ├── YYYYMMDDHHMMSS_migration_name.sql
│   ├── migration_lock.toml
│   └── README.md
├── schema.prisma
└── seed.ts
```

### Conflict Resolution
- Rebase feature branches regularly
- Resolve conflicts in schema.prisma first
- Regenerate migrations if needed
- Test after conflict resolution

## Environment Management

### Development
- Use `prisma migrate dev` for schema changes
- Regular schema resets for clean state
- Seed data for testing

### Staging
- Mirror production configuration
- Full migration testing
- Performance validation

### Production
- Scheduled migration windows
- Backup verification
- Monitoring during migration
- Rollback readiness

## Troubleshooting

### Common Issues

1. **Migration Failed**
   ```bash
   # Check status
   prisma migrate status
   
   # Review logs
   prisma migrate reset --preview
   ```

2. **Schema Drift**
   ```bash
   # Compare schemas
   prisma migrate diff
   
   # Reset if needed (development only)
   prisma migrate reset
   ```

3. **Lock Files**
   ```bash
   # Clear migration locks
   rm prisma/migration_lock.toml
   prisma migrate dev
   ```

### Prevention
- Regular schema backups
- Migration dry runs
- Comprehensive testing
- Documentation updates

### Support Resources
- Prisma documentation
- Team knowledge base
- Migration history logs
- Performance metrics

---

**Note**: Keep this guide updated with team learnings and new best practices. Review and update quarterly or when introducing significant schema changes.

Last Updated: [schema_version]
Prisma Version: ^5.0.0
Database: SQLite