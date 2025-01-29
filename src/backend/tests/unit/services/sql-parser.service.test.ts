import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SQLParserService } from '../../src/services/sql-parser.service';
import { SQLDialect } from '../../src/core/types/diagram.types';
import { ValidationError } from '../../src/core/errors/ValidationError';

describe('SQLParserService', () => {
  let sqlParserService: SQLParserService;

  // Test SQL samples
  const validPostgreSQLDDL = `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending'
    );
  `;

  const validSnowflakeDDL = `
    CREATE TABLE users (
      id INTEGER AUTOINCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    );

    CREATE TABLE orders (
      id INTEGER AUTOINCREMENT PRIMARY KEY,
      user_id INTEGER FOREIGN KEY REFERENCES users(id),
      total NUMBER(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending'
    );
  `;

  const invalidSQLDDL = 'CREAT TABLE invalid_syntax (id INT);';

  // Generate large SQL DDL for performance testing
  const generateLargeSQL = (tableCount: number): string => {
    let sql = '';
    for (let i = 0; i < tableCount; i++) {
      sql += `
        CREATE TABLE table_${i} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    }
    return sql;
  };

  const largePostgreSQLDDL = generateLargeSQL(100);

  beforeEach(() => {
    sqlParserService = new SQLParserService(100); // Initialize with 100 table limit
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateERDFromSQL', () => {
    it('should successfully generate ERD from valid PostgreSQL DDL', async () => {
      const result = await sqlParserService.generateERDFromSQL(
        validPostgreSQLDDL,
        SQLDialect.POSTGRESQL
      );

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      
      // Verify users table node
      const usersNode = result.nodes.find(n => n.data.name === 'users');
      expect(usersNode).toBeDefined();
      expect(usersNode?.data.columns).toHaveLength(3);
      expect(usersNode?.data.columns.find(c => c.name === 'id')?.isPrimary).toBe(true);

      // Verify orders table node
      const ordersNode = result.nodes.find(n => n.data.name === 'orders');
      expect(ordersNode).toBeDefined();
      expect(ordersNode?.data.columns).toHaveLength(4);
      expect(ordersNode?.data.columns.find(c => c.name === 'user_id')?.isForeign).toBe(true);

      // Verify relationship edge
      const edge = result.edges[0];
      expect(edge.source).toBe('table-users');
      expect(edge.target).toBe('table-orders');
      expect(edge.type).toBe('one-to-many');
    });

    it('should successfully generate ERD from valid Snowflake DDL', async () => {
      const result = await sqlParserService.generateERDFromSQL(
        validSnowflakeDDL,
        SQLDialect.SNOWFLAKE
      );

      expect(result).toBeDefined();
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);

      // Verify data type mapping
      const usersNode = result.nodes.find(n => n.data.name === 'users');
      const createdAtColumn = usersNode?.data.columns.find(c => c.name === 'created_at');
      expect(createdAtColumn?.type).toBe('timestamp_ntz');
    });

    it('should handle large SQL input within performance requirements', async () => {
      const startTime = performance.now();
      const result = await sqlParserService.generateERDFromSQL(
        largePostgreSQLDDL,
        SQLDialect.POSTGRESQL
      );
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.nodes).toHaveLength(100);
      expect(processingTime).toBeLessThan(3000); // Should process within 3 seconds
      expect(result.version).toBe(1);
    });

    it('should throw ValidationError for empty SQL input', async () => {
      await expect(sqlParserService.generateERDFromSQL(
        '',
        SQLDialect.POSTGRESQL
      )).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid SQL syntax', async () => {
      await expect(sqlParserService.generateERDFromSQL(
        invalidSQLDDL,
        SQLDialect.POSTGRESQL
      )).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for unsupported dialect', async () => {
      await expect(sqlParserService.generateERDFromSQL(
        validPostgreSQLDDL,
        'MYSQL' as SQLDialect
      )).rejects.toThrow(ValidationError);
    });
  });

  describe('validateAndFormatSQL', () => {
    it('should validate and format valid PostgreSQL DDL', async () => {
      const result = await sqlParserService.validateAndFormatSQL(
        validPostgreSQLDDL,
        SQLDialect.POSTGRESQL
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.formattedSQL).toContain('CREATE TABLE users');
      expect(result.tableCount).toBe(2);
    });

    it('should return validation errors for invalid SQL', async () => {
      const result = await sqlParserService.validateAndFormatSQL(
        invalidSQLDDL,
        SQLDialect.POSTGRESQL
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.formattedSQL).toBe(invalidSQLDDL);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousSQL = `
        CREATE TABLE users (id INT);
        DROP TABLE users; --
      `;

      const result = await sqlParserService.validateAndFormatSQL(
        maliciousSQL,
        SQLDialect.POSTGRESQL
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.messages[0].includes('syntax'))).toBe(true);
    });

    it('should include performance metrics in validation result', async () => {
      const result = await sqlParserService.validateAndFormatSQL(
        validPostgreSQLDDL,
        SQLDialect.POSTGRESQL
      );

      expect(result.performance).toBeDefined();
      expect(result.performance.parseTime).toBeGreaterThan(0);
      expect(result.performance.totalTime).toBeGreaterThan(0);
    });
  });

  describe('isSupportedDialect', () => {
    it('should return true for PostgreSQL dialect', () => {
      const result = sqlParserService.isSupportedDialect(SQLDialect.POSTGRESQL);
      expect(result.supported).toBe(true);
      expect(result.features).toContain('Tables');
      expect(result.features).toContain('Foreign Keys');
    });

    it('should return true for Snowflake dialect', () => {
      const result = sqlParserService.isSupportedDialect(SQLDialect.SNOWFLAKE);
      expect(result.supported).toBe(true);
      expect(result.features).toContain('Tables');
      expect(result.features).toContain('Clustering Keys');
    });

    it('should return false with alternatives for unsupported dialect', () => {
      const result = sqlParserService.isSupportedDialect('MYSQL' as SQLDialect);
      expect(result.supported).toBe(false);
      expect(result.alternatives).toContain(SQLDialect.POSTGRESQL);
      expect(result.alternatives).toContain(SQLDialect.SNOWFLAKE);
    });
  });

  describe('Performance Requirements', () => {
    it('should handle 100+ tables within memory limits', async () => {
      const largeSQLDDL = generateLargeSQL(120);
      
      await expect(sqlParserService.generateERDFromSQL(
        largeSQLDDL,
        SQLDialect.POSTGRESQL
      )).rejects.toThrow(ValidationError);
    });

    it('should maintain performance with complex relationships', async () => {
      const complexSQL = `
        CREATE TABLE departments (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        );

        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          department_id INTEGER REFERENCES departments(id),
          manager_id INTEGER REFERENCES employees(id),
          name VARCHAR(255) NOT NULL
        );

        CREATE TABLE projects (
          id SERIAL PRIMARY KEY,
          department_id INTEGER REFERENCES departments(id),
          lead_id INTEGER REFERENCES employees(id),
          name VARCHAR(255) NOT NULL
        );
      `;

      const startTime = performance.now();
      const result = await sqlParserService.generateERDFromSQL(
        complexSQL,
        SQLDialect.POSTGRESQL
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should process within 1 second
      expect(result.edges.length).toBeGreaterThanOrEqual(3); // Should detect all relationships
    });
  });
});