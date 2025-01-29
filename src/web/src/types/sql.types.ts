// @ts-check
import { z } from 'zod'; // v3.22.0 - Runtime type validation

/**
 * Supported SQL dialects in the system
 */
export enum SQLDialect {
  POSTGRESQL = 'postgresql',
  SNOWFLAKE = 'snowflake'
}

/**
 * Comprehensive SQL column data types supported across dialects
 */
export const ColumnType = {
  NUMERIC_TYPES: [
    'INTEGER',
    'BIGINT',
    'DECIMAL',
    'NUMERIC',
    'SMALLINT',
    'REAL',
    'DOUBLE'
  ],
  STRING_TYPES: [
    'VARCHAR',
    'TEXT',
    'CHAR',
    'CHARACTER VARYING',
    'CHARACTER'
  ],
  DATETIME_TYPES: [
    'TIMESTAMP',
    'DATE',
    'TIME',
    'TIMESTAMPTZ',
    'TIMETZ'
  ],
  BOOLEAN_TYPES: [
    'BOOLEAN',
    'BOOL'
  ],
  BINARY_TYPES: [
    'BLOB',
    'BYTEA',
    'BINARY',
    'VARBINARY'
  ],
  SPECIAL_TYPES: [
    'JSON',
    'JSONB',
    'ARRAY',
    'UUID',
    'XML',
    'VARIANT'
  ]
} as const;

/**
 * Table relationship cardinality types
 */
export enum RelationType {
  ONE_TO_ONE = 'one_to_one',
  ONE_TO_MANY = 'one_to_many',
  MANY_TO_MANY = 'many_to_many'
}

/**
 * Database column structure with comprehensive properties
 */
export interface Column {
  name: string;
  type: typeof ColumnType[keyof typeof ColumnType][number];
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  references?: {
    table: string;
    column: string;
  };
}

/**
 * Table constraint definition
 */
export interface TableConstraint {
  type: 'UNIQUE' | 'CHECK' | 'FOREIGN KEY';
  name: string;
  columns: string[];
  definition: string;
}

/**
 * Table index definition
 */
export interface TableIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  method: 'BTREE' | 'HASH' | 'GIST' | 'GIN';
}

/**
 * Enhanced database table structure with constraints and indices
 */
export interface Table {
  name: string;
  schema: string;
  columns: Column[];
  primaryKey: string[];
  constraints: TableConstraint[];
  indices: TableIndex[];
}

/**
 * Enhanced table relationship definition with referential actions
 */
export interface Relationship {
  type: RelationType;
  sourceTable: string;
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
  onUpdate: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Enhanced parsed SQL DDL structure with metadata
 */
export interface ParsedDDL {
  tables: Table[];
  relationships: Relationship[];
  dialect: SQLDialect;
  schemas: string[];
  metadata: {
    version: string;
    timestamp: string;
  };
}

// Zod schemas for runtime validation
export const ColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  length: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
  nullable: z.boolean(),
  defaultValue: z.string().optional(),
  isPrimaryKey: z.boolean(),
  isForeignKey: z.boolean(),
  isUnique: z.boolean(),
  isAutoIncrement: z.boolean(),
  references: z.object({
    table: z.string(),
    column: z.string()
  }).optional()
});

export const TableConstraintSchema = z.object({
  type: z.enum(['UNIQUE', 'CHECK', 'FOREIGN KEY']),
  name: z.string(),
  columns: z.array(z.string()),
  definition: z.string()
});

export const TableIndexSchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
  isUnique: z.boolean(),
  method: z.enum(['BTREE', 'HASH', 'GIST', 'GIN'])
});

export const TableSchema = z.object({
  name: z.string(),
  schema: z.string(),
  columns: z.array(ColumnSchema),
  primaryKey: z.array(z.string()),
  constraints: z.array(TableConstraintSchema),
  indices: z.array(TableIndexSchema)
});

export const RelationshipSchema = z.object({
  type: z.nativeEnum(RelationType),
  sourceTable: z.string(),
  targetTable: z.string(),
  sourceColumn: z.string(),
  targetColumn: z.string(),
  onDelete: z.enum(['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION']),
  onUpdate: z.enum(['CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT', 'NO ACTION'])
});

export const ParsedDDLSchema = z.object({
  tables: z.array(TableSchema),
  relationships: z.array(RelationshipSchema),
  dialect: z.nativeEnum(SQLDialect),
  schemas: z.array(z.string()),
  metadata: z.object({
    version: z.string(),
    timestamp: z.string()
  })
});