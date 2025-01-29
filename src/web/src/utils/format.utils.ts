import { format } from 'sql-formatter'; // v4.0.2
import {
  SQLDialect,
  Column,
  Table,
  Relationship
} from '../types/sql.types';
import {
  DiagramState,
  DiagramLayout
} from '../types/diagram.types';

/**
 * Formats SQL DDL statements with proper indentation and dialect-specific rules
 */
export function formatSQLDDL(sql: string, dialect: SQLDialect): string {
  if (!sql?.trim()) {
    throw new Error('SQL statement cannot be empty');
  }

  const dialectConfig = {
    [SQLDialect.POSTGRESQL]: {
      language: 'postgresql',
      keywordCase: 'upper',
      indentStyle: '  ',
      linesBetweenQueries: 2
    },
    [SQLDialect.SNOWFLAKE]: {
      language: 'snowflake',
      keywordCase: 'upper',
      indentStyle: '  ',
      linesBetweenQueries: 2
    }
  };

  try {
    return format(sql, {
      ...dialectConfig[dialect],
      uppercase: true,
      formatOptions: {
        identifierCase: 'preserve'
      }
    });
  } catch (error) {
    throw new Error(`Failed to format SQL: ${error.message}`);
  }
}

/**
 * Formats table name with schema prefix based on SQL dialect rules
 */
export function formatTableName(table: Table, dialect: SQLDialect): string {
  const { schema, name } = table;
  
  const quoteChar = dialect === SQLDialect.POSTGRESQL ? '"' : "'";
  
  const quoteName = (identifier: string) => {
    // Quote if contains special characters or is case-sensitive
    return identifier.match(/[^a-z0-9_]|[A-Z]/) 
      ? `${quoteChar}${identifier}${quoteChar}`
      : identifier;
  };

  return schema 
    ? `${quoteName(schema)}.${quoteName(name)}`
    : quoteName(name);
}

/**
 * Formats column definition with comprehensive type information and constraints
 */
export function formatColumnDefinition(column: Column): string {
  const parts: string[] = [column.name, column.type];

  // Add length/precision/scale if specified
  if (column.length) {
    parts[1] += `(${column.length})`;
  } else if (column.precision) {
    parts[1] += `(${column.precision}${column.scale ? `,${column.scale}` : ''})`;
  }

  // Add constraints
  if (!column.nullable) {
    parts.push('NOT NULL');
  }
  
  if (column.defaultValue) {
    parts.push(`DEFAULT ${column.defaultValue}`);
  }
  
  if (column.isPrimaryKey) {
    parts.push('PRIMARY KEY');
  }
  
  if (column.isAutoIncrement) {
    parts.push('GENERATED ALWAYS AS IDENTITY');
  }
  
  if (column.isUnique) {
    parts.push('UNIQUE');
  }
  
  if (column.isForeignKey && column.references) {
    parts.push(`REFERENCES ${column.references.table}(${column.references.column})`);
  }

  return parts.join(' ');
}

/**
 * Formats relationship description with enhanced visual representation
 */
export function formatRelationship(relationship: Relationship): string {
  const symbols = {
    one_to_one: '1:1 ⟷',
    one_to_many: '1:n →',
    many_to_many: 'n:m ⟷'
  };

  const {
    type,
    sourceTable,
    targetTable,
    sourceColumn,
    targetColumn,
    onDelete,
    onUpdate
  } = relationship;

  const relationSymbol = symbols[type];
  
  let result = `${sourceTable}(${sourceColumn}) ${relationSymbol} ${targetTable}(${targetColumn})`;
  
  // Add referential actions if not default
  if (onDelete !== 'NO ACTION') {
    result += ` ON DELETE ${onDelete}`;
  }
  if (onUpdate !== 'NO ACTION') {
    result += ` ON UPDATE ${onUpdate}`;
  }

  return result;
}

/**
 * Formats complete diagram state with enhanced collaboration support
 */
export function formatDiagramState(state: DiagramState): DiagramState {
  try {
    // Format SQL DDL
    const formattedSQL = formatSQLDDL(state.sqlDDL, state.dialect);

    // Format table names in layout nodes
    const formattedLayout: DiagramLayout = {
      ...state.layout,
      nodes: state.layout.nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          name: formatTableName(node.data, state.dialect)
        }
      })),
      edges: state.layout.edges.map(edge => ({
        ...edge,
        data: {
          ...edge.data,
          label: formatRelationship(edge.data)
        }
      }))
    };

    // Return formatted state
    return {
      ...state,
      sqlDDL: formattedSQL,
      layout: formattedLayout,
      lastModified: new Date().toISOString(),
      version: state.version + 1
    };
  } catch (error) {
    throw new Error(`Failed to format diagram state: ${error.message}`);
  }
}