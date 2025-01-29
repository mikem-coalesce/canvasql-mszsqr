import { z } from 'zod'; // v3.22.0
import { 
  SQLDialect, 
  Column, 
  Table, 
  Relationship, 
  ParsedDDL,
  ColumnType 
} from '../types/sql.types';
import { generateDiagramLayout } from './diagram.utils';

// SQL parsing and validation constants
const SQL_STATEMENT_SEPARATOR = ';';
const COMMENT_REGEX = /--.*$|\/\*[\s\S]*?\*\//gm;
const WHITESPACE_REGEX = /\s+/g;

/**
 * Validates SQL DDL syntax and dialect compatibility
 * @param sqlString SQL DDL string to validate
 * @param dialect Target SQL dialect
 * @returns Promise resolving to validation result
 */
export const validateSQLSyntax = async (
  sqlString: string,
  dialect: SQLDialect
): Promise<boolean> => {
  try {
    // Input validation
    if (!sqlString?.trim()) {
      throw new Error('SQL string cannot be empty');
    }

    if (!Object.values(SQLDialect).includes(dialect)) {
      throw new Error(`Unsupported SQL dialect: ${dialect}`);
    }

    // Remove comments and normalize whitespace
    const normalizedSQL = sqlString
      .replace(COMMENT_REGEX, '')
      .replace(WHITESPACE_REGEX, ' ')
      .trim();

    // Split into individual statements
    const statements = normalizedSQL
      .split(SQL_STATEMENT_SEPARATOR)
      .filter(stmt => stmt.trim());

    // Basic syntax validation
    for (const statement of statements) {
      const normalizedStmt = statement.trim().toUpperCase();
      
      // Validate CREATE TABLE statements
      if (normalizedStmt.startsWith('CREATE TABLE')) {
        validateCreateTableSyntax(statement, dialect);
      }
      
      // Validate ALTER TABLE statements
      if (normalizedStmt.startsWith('ALTER TABLE')) {
        validateAlterTableSyntax(statement, dialect);
      }
    }

    return true;
  } catch (error) {
    console.error('SQL validation error:', error);
    return false;
  }
};

/**
 * Enhanced SQL DDL formatter with standardized styling
 * @param sqlString SQL DDL string to format
 * @param dialect Target SQL dialect
 * @returns Formatted SQL string
 */
export const formatSQL = (
  sqlString: string,
  dialect: SQLDialect
): string => {
  try {
    // Input validation
    if (!sqlString?.trim()) {
      return '';
    }

    // Remove existing comments and normalize whitespace
    let formattedSQL = sqlString
      .replace(COMMENT_REGEX, '')
      .replace(WHITESPACE_REGEX, ' ')
      .trim();

    // Standardize keywords to uppercase
    const keywords = [
      'CREATE', 'TABLE', 'ALTER', 'ADD', 'DROP', 'CONSTRAINT',
      'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL',
      'DEFAULT', 'UNIQUE', 'CHECK', 'INDEX', 'CASCADE'
    ];
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formattedSQL = formattedSQL.replace(regex, keyword);
    });

    // Format CREATE TABLE statements
    formattedSQL = formattedSQL.replace(
      /CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\)/gi,
      (match, tableName, columns) => {
        const formattedColumns = columns
          .split(',')
          .map(col => col.trim())
          .map(col => `  ${col}`)
          .join(',\n');
        
        return `CREATE TABLE ${tableName} (\n${formattedColumns}\n)`;
      }
    );

    // Add dialect-specific formatting
    switch (dialect) {
      case SQLDialect.POSTGRESQL:
        formattedSQL = formatPostgreSQLSpecific(formattedSQL);
        break;
      case SQLDialect.SNOWFLAKE:
        formattedSQL = formatSnowflakeSpecific(formattedSQL);
        break;
    }

    return formattedSQL;
  } catch (error) {
    console.error('SQL formatting error:', error);
    return sqlString;
  }
};

/**
 * Extracts table relationships from foreign key constraints
 * @param tables Array of parsed tables
 * @returns Array of table relationships
 */
export const extractTableRelationships = (tables: Table[]): Relationship[] => {
  const relationships: Relationship[] = [];

  tables.forEach(sourceTable => {
    // Extract relationships from foreign key columns
    sourceTable.columns
      .filter(column => column.isForeignKey && column.references)
      .forEach(column => {
        const targetTable = tables.find(t => 
          t.name === column.references!.table
        );

        if (targetTable) {
          const targetColumn = targetTable.columns.find(c => 
            c.name === column.references!.column
          );

          if (targetColumn) {
            relationships.push({
              type: determineRelationType(sourceTable, targetTable, column, targetColumn),
              sourceTable: sourceTable.name,
              targetTable: targetTable.name,
              sourceColumn: column.name,
              targetColumn: targetColumn.name,
              onDelete: 'NO ACTION',
              onUpdate: 'NO ACTION'
            });
          }
        }
      });

    // Extract relationships from table constraints
    sourceTable.constraints
      .filter(constraint => constraint.type === 'FOREIGN KEY')
      .forEach(constraint => {
        const [targetTable, targetColumn] = constraint.definition
          .match(/REFERENCES\s+(\w+)\s*\((\w+)\)/i)
          ?.slice(1) ?? [];

        if (targetTable && targetColumn) {
          relationships.push({
            type: 'one_to_many',
            sourceTable: sourceTable.name,
            targetTable,
            sourceColumn: constraint.columns[0],
            targetColumn,
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION'
          });
        }
      });
  });

  return relationships;
};

/**
 * Generates ERD diagram state from SQL DDL
 * @param sqlString SQL DDL string
 * @param dialect Target SQL dialect
 * @returns Promise resolving to parsed DDL structure
 */
export const generateERDFromSQL = async (
  sqlString: string,
  dialect: SQLDialect
): Promise<ParsedDDL> => {
  try {
    // Validate SQL syntax
    const isValid = await validateSQLSyntax(sqlString, dialect);
    if (!isValid) {
      throw new Error('Invalid SQL syntax');
    }

    // Parse tables and columns
    const tables = parseTables(sqlString, dialect);
    
    // Extract relationships
    const relationships = extractTableRelationships(tables);

    // Generate diagram layout
    const parsedDDL: ParsedDDL = {
      tables,
      relationships,
      dialect,
      schemas: [...new Set(tables.map(t => t.schema))],
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString()
      }
    };

    return parsedDDL;
  } catch (error) {
    console.error('ERD generation error:', error);
    throw error;
  }
};

// Private helper functions

/**
 * Validates CREATE TABLE statement syntax
 */
const validateCreateTableSyntax = (statement: string, dialect: SQLDialect): void => {
  const createTableRegex = /CREATE TABLE\s+(\w+)\s*\(([\s\S]*)\)/i;
  const matches = statement.match(createTableRegex);
  
  if (!matches) {
    throw new Error('Invalid CREATE TABLE syntax');
  }

  const [, tableName, columnDefinitions] = matches;
  
  // Validate column definitions
  columnDefinitions.split(',').forEach(colDef => {
    validateColumnDefinition(colDef.trim(), dialect);
  });
};

/**
 * Validates ALTER TABLE statement syntax
 */
const validateAlterTableSyntax = (statement: string, dialect: SQLDialect): void => {
  const alterTableRegex = /ALTER TABLE\s+(\w+)\s+(ADD|DROP|ALTER)\s+/i;
  if (!alterTableRegex.test(statement)) {
    throw new Error('Invalid ALTER TABLE syntax');
  }
};

/**
 * Validates column definition syntax
 */
const validateColumnDefinition = (columnDef: string, dialect: SQLDialect): void => {
  const columnRegex = /^\s*(\w+)\s+([A-Za-z]+)(\(\d+(?:,\d+)?\))?\s*(.*?)$/i;
  const matches = columnDef.match(columnRegex);
  
  if (!matches) {
    throw new Error(`Invalid column definition: ${columnDef}`);
  }
};

/**
 * Determines relationship type between tables
 */
const determineRelationType = (
  sourceTable: Table,
  targetTable: Table,
  sourceColumn: Column,
  targetColumn: Column
): RelationType => {
  const isSourceUnique = sourceColumn.isUnique || sourceColumn.isPrimaryKey;
  const isTargetUnique = targetColumn.isUnique || targetColumn.isPrimaryKey;

  if (isSourceUnique && isTargetUnique) {
    return 'one_to_one';
  } else if (isTargetUnique) {
    return 'many_to_one';
  } else {
    return 'many_to_many';
  }
};

/**
 * Parses SQL DDL into table structures
 */
const parseTables = (sqlString: string, dialect: SQLDialect): Table[] => {
  const tables: Table[] = [];
  const createTableRegex = /CREATE TABLE\s+(?:(\w+)\.)?(\w+)\s*\(([\s\S]*?)\)/gi;
  
  let matches;
  while ((matches = createTableRegex.exec(sqlString)) !== null) {
    const [, schema = 'public', tableName, columnDefinitions] = matches;
    
    const table: Table = {
      name: tableName,
      schema,
      columns: parseColumns(columnDefinitions, dialect),
      primaryKey: [],
      constraints: parseConstraints(columnDefinitions),
      indices: []
    };
    
    tables.push(table);
  }
  
  return tables;
};

/**
 * Parses column definitions from CREATE TABLE statement
 */
const parseColumns = (columnDefinitions: string, dialect: SQLDialect): Column[] => {
  const columns: Column[] = [];
  const columnRegex = /(\w+)\s+([A-Za-z]+(?:\(\d+(?:,\d+)?\))?)\s*(.*?)(?:,|$)/gi;
  
  let matches;
  while ((matches = columnRegex.exec(columnDefinitions)) !== null) {
    const [, name, type, constraints] = matches;
    
    columns.push({
      name,
      type: normalizeDataType(type, dialect),
      nullable: !constraints.includes('NOT NULL'),
      isPrimaryKey: constraints.includes('PRIMARY KEY'),
      isForeignKey: constraints.includes('REFERENCES'),
      isUnique: constraints.includes('UNIQUE'),
      isAutoIncrement: constraints.includes('AUTO_INCREMENT') || 
                      constraints.includes('SERIAL')
    });
  }
  
  return columns;
};

/**
 * Parses table constraints from CREATE TABLE statement
 */
const parseConstraints = (columnDefinitions: string): TableConstraint[] => {
  const constraints: TableConstraint[] = [];
  const constraintRegex = /CONSTRAINT\s+(\w+)\s+(PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)\s*\((.*?)\)\s*(.*?)(?:,|$)/gi;
  
  let matches;
  while ((matches = constraintRegex.exec(columnDefinitions)) !== null) {
    const [, name, type, columns, definition] = matches;
    
    constraints.push({
      type: type as 'UNIQUE' | 'CHECK' | 'FOREIGN KEY',
      name,
      columns: columns.split(',').map(c => c.trim()),
      definition: definition.trim()
    });
  }
  
  return constraints;
};

/**
 * Normalizes SQL data types across dialects
 */
const normalizeDataType = (type: string, dialect: SQLDialect): string => {
  const normalizedType = type.toUpperCase();
  
  switch (dialect) {
    case SQLDialect.POSTGRESQL:
      if (normalizedType.includes('SERIAL')) return 'INTEGER';
      if (normalizedType === 'TEXT') return 'VARCHAR';
      break;
    case SQLDialect.SNOWFLAKE:
      if (normalizedType === 'VARIANT') return 'JSON';
      break;
  }
  
  return normalizedType;
};

/**
 * Applies PostgreSQL-specific formatting rules
 */
const formatPostgreSQLSpecific = (sql: string): string => {
  return sql
    .replace(/SERIAL/gi, 'SERIAL PRIMARY KEY')
    .replace(/TEXT/gi, 'VARCHAR');
};

/**
 * Applies Snowflake-specific formatting rules
 */
const formatSnowflakeSpecific = (sql: string): string => {
  return sql
    .replace(/VARCHAR\s*\(\s*MAX\s*\)/gi, 'VARCHAR')
    .replace(/IDENTITY\s*\(\s*1\s*,\s*1\s*\)/gi, 'AUTOINCREMENT');
};