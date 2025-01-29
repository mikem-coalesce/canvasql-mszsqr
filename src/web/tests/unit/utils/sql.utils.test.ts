import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateSQLSyntax,
  formatSQL,
  extractTableRelationships,
  generateERDFromSQL
} from '../../src/utils/sql.utils';
import {
  SQLDialect,
  Column,
  Table,
  Relationship,
  ParsedDDL,
  ERDLayout
} from '../../src/types/sql.types';

// Test data setup
const testValidPostgresSQL = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL
);
`;

const testValidSnowflakeSQL = `
CREATE TABLE customers (
  customer_id NUMBER AUTOINCREMENT PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE invoices (
  invoice_id NUMBER AUTOINCREMENT PRIMARY KEY,
  customer_id NUMBER REFERENCES customers(customer_id),
  amount NUMBER(10,2) NOT NULL,
  status VARCHAR DEFAULT 'pending'
);
`;

const testInvalidSQL = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL
  -- Missing closing parenthesis
`;

describe('validateSQLSyntax', () => {
  it('should validate correct PostgreSQL DDL syntax', async () => {
    const result = await validateSQLSyntax(testValidPostgresSQL, SQLDialect.POSTGRESQL);
    expect(result).toBe(true);
  });

  it('should validate correct Snowflake DDL syntax', async () => {
    const result = await validateSQLSyntax(testValidSnowflakeSQL, SQLDialect.SNOWFLAKE);
    expect(result).toBe(true);
  });

  it('should reject invalid SQL syntax', async () => {
    const result = await validateSQLSyntax(testInvalidSQL, SQLDialect.POSTGRESQL);
    expect(result).toBe(false);
  });

  it('should handle empty SQL string', async () => {
    const result = await validateSQLSyntax('', SQLDialect.POSTGRESQL);
    expect(result).toBe(false);
  });

  it('should handle SQL with only comments', async () => {
    const result = await validateSQLSyntax('-- Just a comment\n/* Another comment */', SQLDialect.POSTGRESQL);
    expect(result).toBe(false);
  });

  it('should validate complex table constraints', async () => {
    const complexSQL = `
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) CHECK (price >= 0),
        CONSTRAINT unique_sku UNIQUE (sku),
        CONSTRAINT valid_price CHECK (price > 0)
      );
    `;
    const result = await validateSQLSyntax(complexSQL, SQLDialect.POSTGRESQL);
    expect(result).toBe(true);
  });
});

describe('formatSQL', () => {
  it('should format PostgreSQL DDL with consistent spacing', () => {
    const unformattedSQL = 'CREATE TABLE users(id SERIAL PRIMARY KEY,email VARCHAR(255));';
    const expectedSQL = 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255)\n);';
    const result = formatSQL(unformattedSQL, SQLDialect.POSTGRESQL);
    expect(result.trim()).toBe(expectedSQL.trim());
  });

  it('should format Snowflake DDL with dialect-specific syntax', () => {
    const unformattedSQL = 'CREATE TABLE users(id number autoincrement,email varchar);';
    const expectedSQL = 'CREATE TABLE users (\n  id NUMBER AUTOINCREMENT,\n  email VARCHAR\n);';
    const result = formatSQL(unformattedSQL, SQLDialect.SNOWFLAKE);
    expect(result.trim()).toBe(expectedSQL.trim());
  });

  it('should handle multiple statements with proper spacing', () => {
    const multiSQL = 'CREATE TABLE a(id int);CREATE TABLE b(id int);';
    const result = formatSQL(multiSQL, SQLDialect.POSTGRESQL);
    expect(result).toContain('CREATE TABLE a');
    expect(result).toContain('CREATE TABLE b');
    expect(result.split('\n').length).toBeGreaterThan(2);
  });

  it('should preserve comments in formatted output', () => {
    const sqlWithComments = `
      -- User table
      CREATE TABLE users(
        id SERIAL PRIMARY KEY, -- Primary key
        email VARCHAR(255) -- User email
      );
    `;
    const result = formatSQL(sqlWithComments, SQLDialect.POSTGRESQL);
    expect(result).toContain('-- User table');
    expect(result).toContain('-- Primary key');
  });
});

describe('extractTableRelationships', () => {
  const mockTables: Table[] = [
    {
      name: 'users',
      schema: 'public',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
          isAutoIncrement: true
        },
        {
          name: 'email',
          type: 'VARCHAR',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
          isUnique: true,
          isAutoIncrement: false
        }
      ],
      primaryKey: ['id'],
      constraints: [],
      indices: []
    },
    {
      name: 'orders',
      schema: 'public',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          isPrimaryKey: true,
          isForeignKey: false,
          isUnique: true,
          isAutoIncrement: true
        },
        {
          name: 'user_id',
          type: 'INTEGER',
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: true,
          isUnique: false,
          isAutoIncrement: false,
          references: {
            table: 'users',
            column: 'id'
          }
        }
      ],
      primaryKey: ['id'],
      constraints: [],
      indices: []
    }
  ];

  it('should extract one-to-many relationships', () => {
    const relationships = extractTableRelationships(mockTables);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toEqual({
      type: 'one_to_many',
      sourceTable: 'orders',
      targetTable: 'users',
      sourceColumn: 'user_id',
      targetColumn: 'id',
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION'
    });
  });

  it('should handle tables with no relationships', () => {
    const tablesWithoutRelations = [mockTables[0]];
    const relationships = extractTableRelationships(tablesWithoutRelations);
    expect(relationships).toHaveLength(0);
  });

  it('should handle circular relationships', () => {
    const circularTables = [...mockTables];
    circularTables[0].columns.push({
      name: 'last_order_id',
      type: 'INTEGER',
      nullable: true,
      isPrimaryKey: false,
      isForeignKey: true,
      isUnique: false,
      isAutoIncrement: false,
      references: {
        table: 'orders',
        column: 'id'
      }
    });
    const relationships = extractTableRelationships(circularTables);
    expect(relationships).toHaveLength(2);
  });
});

describe('generateERDFromSQL', () => {
  it('should generate complete ERD from PostgreSQL DDL', async () => {
    const result = await generateERDFromSQL(testValidPostgresSQL, SQLDialect.POSTGRESQL);
    
    expect(result).toMatchObject({
      tables: expect.arrayContaining([
        expect.objectContaining({
          name: 'users',
          columns: expect.arrayContaining([
            expect.objectContaining({
              name: 'id',
              type: 'INTEGER',
              isPrimaryKey: true
            })
          ])
        })
      ]),
      relationships: expect.arrayContaining([
        expect.objectContaining({
          sourceTable: 'orders',
          targetTable: 'users'
        })
      ]),
      dialect: SQLDialect.POSTGRESQL,
      schemas: expect.arrayContaining(['public'])
    });
  });

  it('should generate complete ERD from Snowflake DDL', async () => {
    const result = await generateERDFromSQL(testValidSnowflakeSQL, SQLDialect.SNOWFLAKE);
    
    expect(result).toMatchObject({
      tables: expect.arrayContaining([
        expect.objectContaining({
          name: 'customers',
          columns: expect.arrayContaining([
            expect.objectContaining({
              name: 'customer_id',
              type: 'NUMBER',
              isPrimaryKey: true
            })
          ])
        })
      ]),
      dialect: SQLDialect.SNOWFLAKE
    });
  });

  it('should throw error for invalid SQL', async () => {
    await expect(generateERDFromSQL(testInvalidSQL, SQLDialect.POSTGRESQL))
      .rejects.toThrow('Invalid SQL syntax');
  });

  it('should handle empty SQL input', async () => {
    await expect(generateERDFromSQL('', SQLDialect.POSTGRESQL))
      .rejects.toThrow();
  });

  it('should handle complex schema with multiple relationships', async () => {
    const complexSQL = `
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      );

      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id),
        name VARCHAR(200) NOT NULL,
        price DECIMAL(10,2) NOT NULL
      );

      CREATE TABLE inventory (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT positive_quantity CHECK (quantity >= 0)
      );
    `;

    const result = await generateERDFromSQL(complexSQL, SQLDialect.POSTGRESQL);
    expect(result.tables).toHaveLength(3);
    expect(result.relationships).toHaveLength(2);
  });
});