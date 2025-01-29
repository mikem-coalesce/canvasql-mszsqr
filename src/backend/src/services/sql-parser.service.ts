import { parseSQLToDDL, validateSQLSyntax, formatSQL } from '../core/utils/sql-parser.util';
import { SQLDialect } from '../core/types/diagram.types';
import { ValidationError } from '../core/errors/ValidationError';
import LRUCache from 'lru-cache'; // v7.18.0
import { performance } from 'perf_hooks';
import { DiagramState, Node, Edge, DiagramValidationSchema } from '../core/types/diagram.types';

/**
 * Service class providing high-level SQL parsing and ERD generation functionality
 * with enhanced performance, security and error handling capabilities
 */
export class SQLParserService {
  private readonly supportedDialects: Set<SQLDialect>;
  private readonly parserCache: LRUCache<string, DiagramState>;
  private readonly maxTableLimit: number;
  private readonly performanceMetrics: {
    parseTime: number;
    transformTime: number;
    totalTime: number;
  };

  /**
   * Initializes the SQL parser service with configuration
   * @param maxTableLimit - Maximum number of tables to process (default: 100)
   */
  constructor(maxTableLimit: number = 100) {
    // Initialize supported dialects
    this.supportedDialects = new Set([SQLDialect.POSTGRESQL, SQLDialect.SNOWFLAKE]);

    // Initialize LRU cache for parsed SQL statements
    this.parserCache = new LRUCache({
      max: 100, // Cache up to 100 parsed diagrams
      maxSize: 50 * 1024 * 1024, // 50MB max cache size
      sizeCalculation: (value) => JSON.stringify(value).length,
      ttl: 1000 * 60 * 60 // 1 hour TTL
    });

    this.maxTableLimit = maxTableLimit;
    this.performanceMetrics = {
      parseTime: 0,
      transformTime: 0,
      totalTime: 0
    };
  }

  /**
   * Generates ERD diagram state from SQL DDL input with enhanced performance and security
   * @param sqlString - SQL DDL string to parse
   * @param dialect - SQL dialect to use
   * @returns Promise resolving to diagram state
   * @throws ValidationError for invalid input or processing errors
   */
  async generateERDFromSQL(sqlString: string, dialect: SQLDialect): Promise<DiagramState> {
    const startTime = performance.now();

    try {
      // Input validation
      if (!sqlString?.trim()) {
        throw new ValidationError({ sql: ['SQL string cannot be empty'] });
      }

      if (!this.isSupportedDialect(dialect).supported) {
        throw new ValidationError({ dialect: [`Unsupported SQL dialect: ${dialect}`] });
      }

      // Check cache for previously parsed SQL
      const cacheKey = `${dialect}:${sqlString}`;
      const cachedResult = this.parserCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Parse SQL to DDL structure
      const parseStartTime = performance.now();
      const parsedDDL = await parseSQLToDDL(sqlString, dialect);
      this.performanceMetrics.parseTime = performance.now() - parseStartTime;

      // Validate table limit
      if (parsedDDL.tables.length > this.maxTableLimit) {
        throw new ValidationError({
          tables: [`Number of tables (${parsedDDL.tables.length}) exceeds limit of ${this.maxTableLimit}`]
        });
      }

      // Transform to diagram state
      const transformStartTime = performance.now();
      const diagramState = this.transformToDigramState(parsedDDL);
      this.performanceMetrics.transformTime = performance.now() - transformStartTime;

      // Validate diagram state
      const validationResult = DiagramValidationSchema.safeParse(diagramState);
      if (!validationResult.success) {
        throw new ValidationError({
          diagram: ['Failed to generate valid diagram state from SQL']
        });
      }

      // Cache result if within size limits
      const resultSize = JSON.stringify(diagramState).length;
      if (resultSize <= 5 * 1024 * 1024) { // 5MB max size per entry
        this.parserCache.set(cacheKey, diagramState);
      }

      this.performanceMetrics.totalTime = performance.now() - startTime;
      return diagramState;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError({
        sql: [`Failed to generate ERD: ${error.message}`]
      });
    }
  }

  /**
   * Validates and formats SQL with comprehensive error reporting
   * @param sqlString - SQL string to validate and format
   * @param dialect - SQL dialect to use
   * @param options - Formatting options
   * @returns Promise resolving to validation result and formatted SQL
   */
  async validateAndFormatSQL(
    sqlString: string,
    dialect: SQLDialect,
    options: FormatOptions = {}
  ): Promise<SQLValidationResult> {
    try {
      // Validate SQL syntax
      const isValid = await validateSQLSyntax(sqlString, dialect);

      // Format SQL if valid
      const formattedSQL = isValid ? await formatSQL(sqlString) : sqlString;

      return {
        isValid,
        formattedSQL,
        errors: [],
        dialect,
        tableCount: this.countTables(sqlString),
        performance: { ...this.performanceMetrics }
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          isValid: false,
          formattedSQL: sqlString,
          errors: Object.entries(error.toJSON().errors).map(([field, messages]) => ({
            field,
            messages: messages as string[]
          })),
          dialect,
          tableCount: this.countTables(sqlString),
          performance: { ...this.performanceMetrics }
        };
      }
      throw error;
    }
  }

  /**
   * Validates dialect support with detailed feedback
   * @param dialect - SQL dialect to validate
   * @returns Detailed dialect support information
   */
  isSupportedDialect(dialect: SQLDialect): DialectValidationResult {
    const supported = this.supportedDialects.has(dialect);
    return {
      supported,
      dialect,
      features: supported ? this.getDialectFeatures(dialect) : [],
      alternatives: supported ? [] : Array.from(this.supportedDialects)
    };
  }

  /**
   * Transforms parsed DDL to diagram state
   * @param parsedDDL - Parsed DDL structure
   * @returns Diagram state
   * @private
   */
  private transformToDigramState(parsedDDL: ParsedDDL): DiagramState {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let xPosition = 0;
    let yPosition = 0;

    // Transform tables to nodes
    parsedDDL.tables.forEach((table, index) => {
      // Calculate node position with grid layout
      if (index > 0 && index % 3 === 0) {
        xPosition = 0;
        yPosition += 300;
      }

      const node: Node = {
        id: `table-${table.name}`,
        type: 'table',
        position: {
          x: xPosition,
          y: yPosition,
          width: 250,
          height: 40 + table.columns.length * 30
        },
        data: {
          name: table.name,
          columns: table.columns.map(col => ({
            name: col.name,
            type: col.type,
            isPrimary: col.isPrimary,
            isForeign: col.isForeign,
            isNullable: col.isNullable,
            references: col.references
          })),
          constraints: table.constraints,
          indices: [],
          schema: table.schema,
          isTemporary: table.isTemporary
        },
        style: {
          backgroundColor: '#ffffff',
          borderColor: '#000000',
          borderWidth: 1,
          borderStyle: 'solid',
          opacity: 1
        }
      };

      nodes.push(node);
      xPosition += 300;
    });

    // Generate edges from foreign key relationships
    parsedDDL.tables.forEach(table => {
      table.columns
        .filter(col => col.isForeign && col.references)
        .forEach(col => {
          const edge: Edge = {
            id: `edge-${table.name}-${col.name}`,
            source: `table-${table.name}`,
            target: `table-${col.references!.table}`,
            type: 'one-to-many',
            data: {
              constraintName: `fk_${table.name}_${col.name}`,
              onDelete: 'NO ACTION',
              onUpdate: 'NO ACTION'
            },
            style: {
              strokeColor: '#000000',
              strokeWidth: 1,
              strokeStyle: 'solid',
              opacity: 1,
              animated: false
            }
          };
          edges.push(edge);
        });
    });

    return {
      nodes,
      edges,
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      },
      version: 1,
      sqlDialect: parsedDDL.dialect,
      lastModified: new Date(),
      annotations: {}
    };
  }

  /**
   * Counts tables in SQL string
   * @param sqlString - SQL string to analyze
   * @returns Number of CREATE TABLE statements
   * @private
   */
  private countTables(sqlString: string): number {
    return (sqlString.match(/CREATE\s+TABLE/gi) || []).length;
  }

  /**
   * Gets supported features for a dialect
   * @param dialect - SQL dialect
   * @returns Array of supported features
   * @private
   */
  private getDialectFeatures(dialect: SQLDialect): string[] {
    const features = {
      [SQLDialect.POSTGRESQL]: [
        'Tables',
        'Views',
        'Schemas',
        'Custom Types',
        'Check Constraints',
        'Foreign Keys',
        'Unique Constraints',
        'Indices'
      ],
      [SQLDialect.SNOWFLAKE]: [
        'Tables',
        'Views',
        'Schemas',
        'Foreign Keys',
        'Unique Constraints',
        'Clustering Keys'
      ]
    };
    return features[dialect] || [];
  }
}

interface FormatOptions {
  uppercase?: boolean;
  indent?: number;
  linesBetweenQueries?: number;
}

interface SQLValidationResult {
  isValid: boolean;
  formattedSQL: string;
  errors: Array<{
    field: string;
    messages: string[];
  }>;
  dialect: SQLDialect;
  tableCount: number;
  performance: {
    parseTime: number;
    transformTime: number;
    totalTime: number;
  };
}

interface DialectValidationResult {
  supported: boolean;
  dialect: SQLDialect;
  features: string[];
  alternatives: SQLDialect[];
}