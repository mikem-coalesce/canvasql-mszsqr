import { parse } from 'sqlite-parser'; // v3.0.0
import { format } from 'sql-formatter'; // v12.0.0
import { SQLDialect } from '../types/diagram.types';
import { ValidationError } from '../errors/ValidationError';

// Types for parsed SQL structures
interface ParsedColumn {
  name: string;
  type: string;
  isPrimary: boolean;
  isForeign: boolean;
  isNullable: boolean;
  defaultValue?: string;
  references?: {
    table: string;
    column: string;
  };
}

interface ParsedConstraint {
  name: string;
  type: 'UNIQUE' | 'CHECK' | 'FOREIGN KEY';
  columns: string[];
  definition?: string;
}

interface ParsedTable {
  name: string;
  schema?: string;
  columns: ParsedColumn[];
  constraints: ParsedConstraint[];
  isTemporary: boolean;
}

interface ParsedDDL {
  tables: ParsedTable[];
  dialect: SQLDialect;
  version: number;
}

// SQL Dialect-specific parsing configurations
const dialectConfigs = {
  [SQLDialect.POSTGRESQL]: {
    typeMap: new Map([
      ['int', 'integer'],
      ['varchar', 'character varying'],
      ['timestamp', 'timestamp without time zone']
    ]),
    maxIdentifierLength: 63,
    supportsSchemas: true
  },
  [SQLDialect.SNOWFLAKE]: {
    typeMap: new Map([
      ['int', 'number'],
      ['varchar', 'string'],
      ['timestamp', 'timestamp_ntz']
    ]),
    maxIdentifierLength: 255,
    supportsSchemas: true
  }
};

/**
 * Parses SQL DDL statements into a structured format with dialect-specific handling
 * @param sqlString - Raw SQL DDL string to parse
 * @param dialect - SQL dialect to use for parsing
 * @returns Promise resolving to parsed DDL structure
 * @throws ValidationError for invalid SQL syntax
 */
export async function parseSQLToDDL(
  sqlString: string,
  dialect: SQLDialect
): Promise<ParsedDDL> {
  // Input validation
  if (!sqlString?.trim()) {
    throw new ValidationError({ sql: ['SQL string cannot be empty'] });
  }

  try {
    // Preprocess SQL based on dialect
    const preprocessedSQL = preprocessSQL(sqlString, dialect);

    // Parse SQL using sqlite-parser
    const ast = await parse(preprocessedSQL);

    // Extract and validate tables
    const tables = extractTables(ast, dialect);

    // Process relationships and constraints
    processRelationships(tables);

    // Apply dialect-specific post-processing
    const processedTables = postProcessTables(tables, dialect);

    return {
      tables: processedTables,
      dialect,
      version: 1
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError({
      sql: [`Failed to parse SQL: ${error.message}`]
    });
  }
}

/**
 * Validates SQL syntax with comprehensive dialect-specific rules
 * @param sqlString - SQL string to validate
 * @param dialect - SQL dialect to validate against
 * @returns Promise resolving to boolean indicating validity
 * @throws ValidationError with detailed error context
 */
export async function validateSQLSyntax(
  sqlString: string,
  dialect: SQLDialect
): Promise<boolean> {
  const errors: Record<string, string[]> = {};

  // Basic validation
  if (!sqlString?.trim()) {
    errors.sql = ['SQL string cannot be empty'];
    throw new ValidationError(errors);
  }

  // Size validation
  if (sqlString.length > 1000000) {
    errors.sql = ['SQL string exceeds maximum length of 1MB'];
    throw new ValidationError(errors);
  }

  try {
    // Attempt to parse SQL
    const config = dialectConfigs[dialect];
    const ast = await parse(sqlString);

    // Validate identifiers
    validateIdentifiers(ast, config.maxIdentifierLength, errors);

    // Validate data types
    validateDataTypes(ast, dialect, errors);

    // Validate constraints
    validateConstraints(ast, dialect, errors);

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }

    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError({
      sql: [`Invalid SQL syntax: ${error.message}`]
    });
  }
}

/**
 * Formats SQL with dialect-aware formatting rules
 * @param sqlString - SQL string to format
 * @returns Promise resolving to formatted SQL string
 * @throws ValidationError for invalid SQL
 */
export async function formatSQL(sqlString: string): Promise<string> {
  if (!sqlString?.trim()) {
    throw new ValidationError({ sql: ['SQL string cannot be empty'] });
  }

  try {
    return format(sqlString, {
      language: 'postgresql', // Default to PostgreSQL formatting
      uppercase: true, // Uppercase keywords
      linesBetweenQueries: 2,
      indentStyle: 'standard',
      keywordCase: 'upper'
    });
  } catch (error) {
    throw new ValidationError({
      sql: [`Failed to format SQL: ${error.message}`]
    });
  }
}

// Helper functions

function preprocessSQL(sql: string, dialect: SQLDialect): string {
  const config = dialectConfigs[dialect];
  let processed = sql;

  // Replace dialect-specific types
  config.typeMap.forEach((standardType, dialectType) => {
    const regex = new RegExp(`\\b${dialectType}\\b`, 'gi');
    processed = processed.replace(regex, standardType);
  });

  return processed;
}

function extractTables(ast: any, dialect: SQLDialect): ParsedTable[] {
  const tables: ParsedTable[] = [];

  // Traverse AST and extract table definitions
  ast.statements.forEach((statement: any) => {
    if (statement.type === 'create' && statement.variant === 'table') {
      const table: ParsedTable = {
        name: statement.name.value,
        schema: statement.name.schema,
        columns: extractColumns(statement.definition),
        constraints: extractConstraints(statement.definition),
        isTemporary: statement.temporary || false
      };
      tables.push(table);
    }
  });

  return tables;
}

function extractColumns(definition: any): ParsedColumn[] {
  return definition.columns.map((col: any) => ({
    name: col.name.value,
    type: col.datatype.value,
    isPrimary: isPrimaryKey(col),
    isForeign: isForeignKey(col),
    isNullable: !col.constraints?.some((c: any) => c.type === 'not null'),
    defaultValue: extractDefaultValue(col),
    references: extractReferences(col)
  }));
}

function extractConstraints(definition: any): ParsedConstraint[] {
  return definition.constraints?.map((constraint: any) => ({
    name: constraint.name?.value || '',
    type: constraint.type.toUpperCase(),
    columns: constraint.columns.map((col: any) => col.value),
    definition: constraint.definition
  })) || [];
}

function processRelationships(tables: ParsedTable[]): void {
  tables.forEach(table => {
    table.constraints
      .filter(c => c.type === 'FOREIGN KEY')
      .forEach(fk => {
        const referencedTable = tables.find(t => 
          t.name === fk.definition.split('REFERENCES')[1].trim().split('(')[0].trim()
        );
        if (referencedTable) {
          // Update foreign key columns
          fk.columns.forEach(colName => {
            const column = table.columns.find(c => c.name === colName);
            if (column) {
              column.isForeign = true;
            }
          });
        }
      });
  });
}

function postProcessTables(tables: ParsedTable[], dialect: SQLDialect): ParsedTable[] {
  const config = dialectConfigs[dialect];
  
  return tables.map(table => ({
    ...table,
    columns: table.columns.map(col => ({
      ...col,
      type: standardizeDataType(col.type, dialect)
    }))
  }));
}

function standardizeDataType(type: string, dialect: SQLDialect): string {
  const config = dialectConfigs[dialect];
  return config.typeMap.get(type.toLowerCase()) || type;
}

// Utility functions for column parsing
function isPrimaryKey(column: any): boolean {
  return column.constraints?.some((c: any) => c.type === 'primary key') || false;
}

function isForeignKey(column: any): boolean {
  return column.constraints?.some((c: any) => c.type === 'foreign key') || false;
}

function extractDefaultValue(column: any): string | undefined {
  const defaultConstraint = column.constraints?.find((c: any) => c.type === 'default');
  return defaultConstraint?.value?.value;
}

function extractReferences(column: any): { table: string; column: string } | undefined {
  const reference = column.constraints?.find((c: any) => c.type === 'references');
  if (reference) {
    return {
      table: reference.table.value,
      column: reference.columns[0].value
    };
  }
  return undefined;
}

// Validation helper functions
function validateIdentifiers(ast: any, maxLength: number, errors: Record<string, string[]>): void {
  ast.statements.forEach((statement: any) => {
    if (statement.name.value.length > maxLength) {
      errors.identifiers = errors.identifiers || [];
      errors.identifiers.push(
        `Identifier "${statement.name.value}" exceeds maximum length of ${maxLength}`
      );
    }
  });
}

function validateDataTypes(ast: any, dialect: SQLDialect, errors: Record<string, string[]>): void {
  const config = dialectConfigs[dialect];
  
  ast.statements.forEach((statement: any) => {
    if (statement.type === 'create' && statement.variant === 'table') {
      statement.definition.columns.forEach((column: any) => {
        const dataType = column.datatype.value.toLowerCase();
        if (!config.typeMap.has(dataType) && !isValidCustomType(dataType, dialect)) {
          errors.dataTypes = errors.dataTypes || [];
          errors.dataTypes.push(
            `Invalid data type "${dataType}" for dialect ${dialect}`
          );
        }
      });
    }
  });
}

function validateConstraints(ast: any, dialect: SQLDialect, errors: Record<string, string[]>): void {
  ast.statements.forEach((statement: any) => {
    if (statement.type === 'create' && statement.variant === 'table') {
      statement.definition.constraints?.forEach((constraint: any) => {
        if (!isValidConstraint(constraint, dialect)) {
          errors.constraints = errors.constraints || [];
          errors.constraints.push(
            `Invalid constraint type "${constraint.type}" for dialect ${dialect}`
          );
        }
      });
    }
  });
}

function isValidCustomType(type: string, dialect: SQLDialect): boolean {
  // Add dialect-specific custom type validation
  const customTypes = {
    [SQLDialect.POSTGRESQL]: ['json', 'jsonb', 'uuid', 'timestamptz'],
    [SQLDialect.SNOWFLAKE]: ['variant', 'object', 'array']
  };
  
  return customTypes[dialect].includes(type);
}

function isValidConstraint(constraint: any, dialect: SQLDialect): boolean {
  const validConstraints = ['PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK', 'NOT NULL'];
  return validConstraints.includes(constraint.type.toUpperCase());
}