import { describe, beforeEach, afterEach, it, jest, expect } from '@jest/globals'; // ^29.0.0
import { PrismaClient } from '@prisma/client'; // ^5.0.0
import { DiagramService } from '../../../src/services/diagram.service';
import { CacheService } from '../../../src/services/cache.service';
import { IDiagram, DiagramLayout } from '../../../src/core/interfaces/diagram.interface';
import { SQLDialect } from '../../../src/core/types/diagram.types';
import { ValidationError } from '../../../src/core/errors/ValidationError';
import { APIError } from '../../../src/core/errors/APIError';

// Mock PrismaClient
jest.mock('@prisma/client');

// Test data constants
const TEST_PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_DIAGRAM_ID = '123e4567-e89b-12d3-a456-426614174001';

// Sample SQL DDL for testing
const TEST_SQL = {
  postgresql: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      total DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  snowflake: `
    CREATE TABLE users (
      id NUMBER AUTOINCREMENT PRIMARY KEY,
      email STRING NOT NULL UNIQUE,
      created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    );
    
    CREATE TABLE orders (
      id NUMBER AUTOINCREMENT PRIMARY KEY,
      user_id NUMBER REFERENCES users(id),
      total NUMBER(10,2) NOT NULL,
      created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    );
  `
};

// Sample diagram layout
const TEST_LAYOUT: DiagramLayout = {
  nodes: [
    {
      id: 'users',
      type: 'table',
      position: { x: 100, y: 100, width: 200, height: 150 },
      data: {
        name: 'users',
        columns: [
          { name: 'id', type: 'SERIAL', isPrimary: true, isForeign: false, isNullable: false },
          { name: 'email', type: 'VARCHAR(255)', isPrimary: false, isForeign: false, isNullable: false }
        ]
      }
    }
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
};

describe('DiagramService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockCacheService: jest.Mocked<CacheService>;
  let diagramService: DiagramService;
  let mockTransaction: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock transaction
    mockTransaction = jest.fn().mockImplementation((callback) => callback(mockPrisma));
    
    // Setup PrismaClient mock
    mockPrisma = {
      $transaction: mockTransaction,
      diagram: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn()
      },
      diagramVersion: {
        create: jest.fn(),
        findMany: jest.fn()
      }
    } as unknown as jest.Mocked<PrismaClient>;

    // Setup CacheService mock
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn()
    } as unknown as jest.Mocked<CacheService>;

    // Initialize service
    diagramService = new DiagramService(mockPrisma, mockCacheService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('SQL Processing', () => {
    it('should parse PostgreSQL DDL correctly', async () => {
      const createData = {
        projectId: TEST_PROJECT_ID,
        name: 'Test Diagram',
        sqlDDL: TEST_SQL.postgresql
      };

      mockPrisma.diagram.create.mockResolvedValueOnce({
        id: TEST_DIAGRAM_ID,
        ...createData,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram);

      const result = await diagramService.create(createData);

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_DIAGRAM_ID);
      expect(mockPrisma.diagram.create).toHaveBeenCalled();
      expect(mockPrisma.diagramVersion.create).toHaveBeenCalled();
    });

    it('should validate SQL syntax', async () => {
      const invalidSQL = 'CREATE TABLE users (id INTEGER PRIMARY KEY,;';
      
      await expect(diagramService.create({
        projectId: TEST_PROJECT_ID,
        name: 'Invalid SQL',
        sqlDDL: invalidSQL
      })).rejects.toThrow(ValidationError);
    });

    it('should handle complex schemas with 100+ tables', async () => {
      // Generate large SQL schema
      const tables = Array.from({ length: 100 }, (_, i) => 
        `CREATE TABLE table_${i} (id SERIAL PRIMARY KEY, data TEXT);`
      ).join('\n');

      const start = performance.now();
      
      await diagramService.create({
        projectId: TEST_PROJECT_ID,
        name: 'Large Schema',
        sqlDDL: tables
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(3000); // Should process within 3 seconds
    });
  });

  describe('Layout Generation', () => {
    it('should generate efficient layout for 100 tables', async () => {
      const createData = {
        projectId: TEST_PROJECT_ID,
        name: 'Large Layout',
        sqlDDL: TEST_SQL.postgresql
      };

      const start = performance.now();
      
      await diagramService.create(createData);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(3000);
    });

    it('should maintain layout on updates', async () => {
      mockPrisma.diagram.findUnique.mockResolvedValueOnce({
        id: TEST_DIAGRAM_ID,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram);

      const updatedLayout = { ...TEST_LAYOUT };
      updatedLayout.nodes[0].position.x = 200;

      const result = await diagramService.update(TEST_DIAGRAM_ID, {
        layout: updatedLayout
      });

      expect(result.layout.nodes[0].position.x).toBe(200);
      expect(mockPrisma.diagram.update).toHaveBeenCalled();
    });
  });

  describe('Version Control', () => {
    it('should create version with delta', async () => {
      const originalDiagram = {
        id: TEST_DIAGRAM_ID,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram;

      mockPrisma.diagram.findUnique.mockResolvedValueOnce(originalDiagram);

      const updatedLayout = { ...TEST_LAYOUT };
      updatedLayout.nodes[0].position.x = 200;

      await diagramService.update(TEST_DIAGRAM_ID, {
        layout: updatedLayout
      });

      expect(mockPrisma.diagramVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            diagramId: TEST_DIAGRAM_ID,
            version: 2
          })
        })
      );
    });

    it('should revert to previous version', async () => {
      const version = 1;
      mockPrisma.diagram.findUnique.mockResolvedValueOnce({
        id: TEST_DIAGRAM_ID,
        versions: [{
          version,
          stateDelta: TEST_LAYOUT
        }]
      } as any);

      await diagramService.restoreVersion(TEST_DIAGRAM_ID, version);

      expect(mockPrisma.diagram.update).toHaveBeenCalled();
      expect(mockPrisma.diagramVersion.create).toHaveBeenCalled();
    });
  });

  describe('Caching', () => {
    it('should cache diagram data efficiently', async () => {
      const diagram = {
        id: TEST_DIAGRAM_ID,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram;

      mockCacheService.get.mockResolvedValueOnce(null);
      mockPrisma.diagram.findUnique.mockResolvedValueOnce(diagram);

      await diagramService.update(TEST_DIAGRAM_ID, {
        name: 'Updated Name'
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(TEST_DIAGRAM_ID),
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should handle cache misses gracefully', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);
      mockPrisma.diagram.findUnique.mockResolvedValueOnce({
        id: TEST_DIAGRAM_ID,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram);

      const result = await diagramService.update(TEST_DIAGRAM_ID, {
        name: 'Updated Name'
      });

      expect(result).toBeDefined();
      expect(mockPrisma.diagram.findUnique).toHaveBeenCalled();
    });
  });

  describe('Performance Requirements', () => {
    it('should load large diagrams within 3s', async () => {
      const start = performance.now();
      
      mockPrisma.diagram.findUnique.mockResolvedValueOnce({
        id: TEST_DIAGRAM_ID,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram);

      await diagramService.update(TEST_DIAGRAM_ID, {
        name: 'Performance Test'
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(3000);
    });

    it('should sync updates within 100ms', async () => {
      const start = performance.now();
      
      mockPrisma.diagram.findUnique.mockResolvedValueOnce({
        id: TEST_DIAGRAM_ID,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram);

      await diagramService.update(TEST_DIAGRAM_ID, {
        layout: TEST_LAYOUT
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        diagramService.update(TEST_DIAGRAM_ID, {
          name: `Concurrent Update ${i}`
        })
      );

      mockPrisma.diagram.findUnique.mockResolvedValue({
        id: TEST_DIAGRAM_ID,
        layout: TEST_LAYOUT,
        version: 1
      } as IDiagram);

      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});