import { describe, it, expect } from 'jest';
import { parseSQLToDDL, validateSQLSyntax, formatSQL } from '@/core/utils/sql-parser.util';
import { SQLDialect } from '@/core/types/diagram.types';
import { ValidationError } from '@/core/errors/ValidationError';

// Test timeout configuration
jest.setTimeout(5000);

// Test SQL statements
const validPostgreSQLDDL = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

const validSnowflakeDDL = `
CREATE TABLE orders (
  id INTEGER AUTOINCREMENT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total DECIMAL(10,2) NOT NULL
);`;

const complexDDL = `
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  price DECIMAL(10,2) NOT NULL,
  CONSTRAINT unique_name UNIQUE(name)
);`;

const invalidSQLDDL = 'CREAT TABLE invalid syntax;';

describe('parseSQLToDDL', () => {
  it('should successfully parse valid PostgreSQL DDL', async () => {
    const result = await parseSQLToDDL(validPostgreSQLDDL, SQLDialect.POSTGRESQL);
    
    expect(result).toMatchObject({
      tables: [
        {
          name: 'users',
          columns: [
            {
              name: 'id',
              type: 'serial',
              isPrimary: true,
              isForeign: false,
              isNullable: false
            },
            {
              name: 'email',
              type: 'character varying',
              isPrimary: false,
              isForeign: false,
              isNullable: false
            },
            {
              name: 'created_at',
              type: 'timestamp without time zone',
              isPrimary: false,
              isForeign: false,
              isNullable: true,
              defaultValue: 'CURRENT_TIMESTAMP'
            }
          ],
          constraints: []
        }
      ],
      dialect: SQLDialect.POSTGRESQL,
      version: 1
    });
  });

  it('should successfully parse valid Snowflake DDL', async () => {
    const result = await parseSQLToDDL(validSnowflakeDDL, SQLDialect.SNOWFLAKE);
    
    expect(result).toMatchObject({
      tables: [
        {
          name: 'orders',
          columns: [
            {
              name: 'id',
              type: 'number',
              isPrimary: true,
              isForeign: false,
              isNullable: false
            },
            {
              name: 'user_id',
              type: 'number',
              isPrimary: false,
              isForeign: true,
              isNullable: true,
              references: {
                table: 'users',
                column: 'id'
              }
            },
            {
              name: 'total',
              type: 'number',
              isPrimary: false,
              isForeign: false,
              isNullable: false
            }
          ],
          constraints: []
        }
      ],
      dialect: SQLDialect.SNOWFLAKE,
      version: 1
    });
  });

  it('should parse complex table relationships and constraints', async () => {
    const result = await parseSQLToDDL(complexDDL, SQLDialect.POSTGRESQL);
    
    expect(result).toMatchObject({
      tables: [
        {
          name: 'products',
          columns: expect.arrayContaining([
            {
              name: 'id',
              type: 'serial',
              isPrimary: true
            },
            {
              name: 'category_id',
              type: 'integer',
              isForeign: true,
              references: {
                table: 'categories',
                column: 'id'
              }
            }
          ]),
          constraints: [
            {
              name: 'unique_name',
              type: 'UNIQUE',
              columns: ['name']
            }
          ]
        }
      ]
    });
  });

  it('should throw ValidationError for invalid SQL syntax', async () => {
    await expect(parseSQLToDDL(invalidSQLDDL, SQLDialect.POSTGRESQL))
      .rejects
      .toThrow(ValidationError);
  });

  it('should throw ValidationError for empty input', async () => {
    await expect(parseSQLToDDL('', SQLDialect.POSTGRESQL))
      .rejects
      .toThrow(ValidationError);
  });

  it('should handle large DDL statements efficiently', async () => {
    const largeDDL = Array(100)
      .fill(validPostgreSQLDDL)
      .join('\n');
    
    const startTime = Date.now();
    await parseSQLToDDL(largeDDL, SQLDialect.POSTGRESQL);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(1000); // Should process within 1 second
  });
});

describe('validateSQLSyntax', () => {
  it('should validate correct PostgreSQL syntax', async () => {
    const result = await validateSQLSyntax(validPostgreSQLDDL, SQLDialect.POSTGRESQL);
    expect(result).toBe(true);
  });

  it('should validate correct Snowflake syntax', async () => {
    const result = await validateSQLSyntax(validSnowflakeDDL, SQLDialect.SNOWFLAKE);
    expect(result).toBe(true);
  });

  it('should reject invalid SQL syntax', async () => {
    await expect(validateSQLSyntax(invalidSQLDDL, SQLDialect.POSTGRESQL))
      .rejects
      .toThrow(ValidationError);
  });

  it('should validate complex DDL statements', async () => {
    const result = await validateSQLSyntax(complexDDL, SQLDialect.POSTGRESQL);
    expect(result).toBe(true);
  });

  it('should reject empty input', async () => {
    await expect(validateSQLSyntax('', SQLDialect.POSTGRESQL))
      .rejects
      .toThrow(ValidationError);
  });

  it('should validate SQL injection patterns', async () => {
    const sqlInjection = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255),
        password VARCHAR(255) -- '); DROP TABLE users; --
      );
    `;
    
    await expect(validateSQLSyntax(sqlInjection, SQLDialect.POSTGRESQL))
      .rejects
      .toThrow(ValidationError);
  });

  it('should handle dialect-specific features', async () => {
    const postgresSpecific = `
      CREATE TABLE events (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        search_vector TSVECTOR
      );
    `;
    
    const result = await validateSQLSyntax(postgresSpecific, SQLDialect.POSTGRESQL);
    expect(result).toBe(true);
  });
});

describe('formatSQL', () => {
  it('should format SQL with consistent style', async () => {
    const unformattedSQL = 'CREATE TABLE users(id INTEGER PRIMARY KEY,name VARCHAR(255));';
    const expected = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255)
);`;
    
    const result = await formatSQL(unformattedSQL);
    expect(result.trim()).toBe(expected.trim());
  });

  it('should handle complex nested statements', async () => {
    const result = await formatSQL(complexDDL);
    expect(result).toMatch(/CREATE TABLE products \(\n\s+id SERIAL PRIMARY KEY,/);
    expect(result).toMatch(/CONSTRAINT unique_name UNIQUE\(name\)/);
  });

  it('should preserve comments', async () => {
    const sqlWithComments = `
      -- User table definition
      CREATE TABLE users (
        id SERIAL PRIMARY KEY, -- Primary key
        email VARCHAR(255) -- User email
      );
    `;
    
    const result = await formatSQL(sqlWithComments);
    expect(result).toMatch(/--\s*User table definition/);
    expect(result).toMatch(/--\s*Primary key/);
  });

  it('should throw ValidationError for empty input', async () => {
    await expect(formatSQL('')).rejects.toThrow(ValidationError);
  });

  it('should handle large SQL statements efficiently', async () => {
    const largeSQL = Array(100)
      .fill(validPostgreSQLDDL)
      .join('\n');
    
    const startTime = Date.now();
    await formatSQL(largeSQL);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(1000); // Should format within 1 second
  });

  it('should maintain consistent indentation', async () => {
    const result = await formatSQL(validPostgreSQLDDL);
    const lines = result.split('\n');
    const indentedLines = lines.filter(line => line.startsWith('  '));
    expect(indentedLines.length).toBeGreaterThan(0);
    indentedLines.forEach(line => {
      expect(line).toMatch(/^\s{2}[^\s]/); // Two spaces indentation
    });
  });
});