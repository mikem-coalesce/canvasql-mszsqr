import { describe, it, beforeEach, afterEach, expect, jest } from 'jest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { DiagramService } from '../../src/services/diagram.service';
import { CacheService } from '../../src/services/cache.service';
import { SQLDialect } from '../../src/core/types/diagram.types';
import { ValidationError } from '../../src/core/errors/ValidationError';
import { APIError } from '../../src/core/errors/APIError';
import { IDiagram, ICreateDiagramDTO } from '../../src/core/interfaces/diagram.interface';

describe('DiagramService Integration Tests', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let cacheService: CacheService;
  let diagramService: DiagramService;
  let testProjectId: string;

  beforeEach(async () => {
    // Initialize clients with transaction support
    prisma = new PrismaClient();
    redis = new Redis();
    cacheService = new CacheService();
    diagramService = new DiagramService(prisma, cacheService);

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        workspaceId: 'test-workspace',
        description: 'Test project for diagram tests',
        metadata: {
          tags: [],
          databaseType: 'POSTGRESQL',
          isArchived: false,
          customSettings: {
            enableVersioning: true,
            autoSave: true,
            exportFormat: 'png'
          }
        }
      }
    });
    testProjectId = project.id;

    // Clear cache
    await redis.flushdb();

    // Setup performance monitoring
    jest.spyOn(console, 'time');
    jest.spyOn(console, 'timeEnd');
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.diagramVersion.deleteMany({
      where: { diagram: { projectId: testProjectId } }
    });
    await prisma.diagram.deleteMany({
      where: { projectId: testProjectId }
    });
    await prisma.project.delete({
      where: { id: testProjectId }
    });

    // Clear cache
    await redis.flushdb();

    // Close connections
    await prisma.$disconnect();
    await redis.quit();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('SQL Processing', () => {
    it('should validate PostgreSQL DDL syntax', async () => {
      const validPostgresSQL = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const dto: ICreateDiagramDTO = {
        projectId: testProjectId,
        name: 'Users Diagram',
        sqlDDL: validPostgresSQL
      };

      const result = await diagramService.create(dto);

      expect(result).toBeDefined();
      expect(result.sqlDDL).toContain('SERIAL PRIMARY KEY');
      expect(result.layout.nodes).toHaveLength(1);
      expect(result.layout.nodes[0].data.columns).toHaveLength(3);
    });

    it('should validate Snowflake DDL syntax', async () => {
      const validSnowflakeSQL = `
        CREATE TABLE users (
          id NUMBER AUTOINCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        );
      `;

      const dto: ICreateDiagramDTO = {
        projectId: testProjectId,
        name: 'Users Diagram',
        sqlDDL: validSnowflakeSQL
      };

      const result = await diagramService.create(dto);

      expect(result).toBeDefined();
      expect(result.sqlDDL).toContain('NUMBER AUTOINCREMENT');
      expect(result.layout.nodes).toHaveLength(1);
    });

    it('should handle complex table relationships', async () => {
      const complexSQL = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE
        );

        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          total DECIMAL(10,2) NOT NULL
        );

        CREATE TABLE order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id),
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id)
        );
      `;

      const dto: ICreateDiagramDTO = {
        projectId: testProjectId,
        name: 'E-commerce Schema',
        sqlDDL: complexSQL
      };

      const result = await diagramService.create(dto);

      expect(result.layout.nodes).toHaveLength(3);
      expect(result.layout.edges).toHaveLength(3);
      expect(result.layout.edges[0].type).toBe('one-to-many');
    });

    it('should reject invalid SQL syntax', async () => {
      const invalidSQL = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          CONSTRAINT invalid_constraint
        );
      `;

      const dto: ICreateDiagramDTO = {
        projectId: testProjectId,
        name: 'Invalid Diagram',
        sqlDDL: invalidSQL
      };

      await expect(diagramService.create(dto)).rejects.toThrow(ValidationError);
    });

    it('should benchmark SQL parsing performance', async () => {
      const start = performance.now();
      
      const largeSQL = generateLargeSQL(100); // Helper to generate SQL for 100 tables
      const dto: ICreateDiagramDTO = {
        projectId: testProjectId,
        name: 'Large Schema',
        sqlDDL: largeSQL
      };

      await diagramService.create(dto);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(3000); // Should process within 3 seconds
    });
  });

  describe('Version Control', () => {
    let testDiagramId: string;

    beforeEach(async () => {
      const diagram = await createTestDiagram(testProjectId);
      testDiagramId = diagram.id;
    });

    it('should create diagram versions', async () => {
      const updateData = {
        name: 'Updated Diagram',
        layout: {
          nodes: [/* updated nodes */],
          edges: [/* updated edges */],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      };

      const result = await diagramService.update(testDiagramId, updateData);

      expect(result.versionCount).toBe(2);
      
      const versions = await prisma.diagramVersion.findMany({
        where: { diagramId: testDiagramId }
      });
      expect(versions).toHaveLength(2);
    });

    it('should restore previous versions', async () => {
      // Create multiple versions
      await diagramService.update(testDiagramId, {
        name: 'Version 2'
      });
      await diagramService.update(testDiagramId, {
        name: 'Version 3'
      });

      // Restore to version 1
      const restored = await diagramService.restoreVersion(testDiagramId, 1);

      expect(restored.name).toBe('Test Diagram');
      expect(restored.versionCount).toBe(4); // Original + 2 updates + restore
    });

    it('should handle concurrent version creation', async () => {
      const updates = Array(5).fill(null).map((_, i) => 
        diagramService.update(testDiagramId, {
          name: `Concurrent Update ${i}`
        })
      );

      const results = await Promise.all(updates);
      const versions = await prisma.diagramVersion.findMany({
        where: { diagramId: testDiagramId }
      });

      expect(versions).toHaveLength(6); // Initial + 5 updates
      expect(new Set(versions.map(v => v.version))).toHaveLength(6);
    });
  });

  describe('Cache Management', () => {
    let testDiagramId: string;

    beforeEach(async () => {
      const diagram = await createTestDiagram(testProjectId);
      testDiagramId = diagram.id;
    });

    it('should implement LRU caching', async () => {
      // First access should cache
      const firstAccess = await diagramService.findById(testDiagramId);
      expect(firstAccess).toBeDefined();

      // Second access should hit cache
      const cacheHit = await diagramService.findById(testDiagramId);
      expect(cacheHit).toEqual(firstAccess);

      // Verify cache hit through Redis
      const cached = await redis.get(`diagram:${testDiagramId}`);
      expect(cached).toBeDefined();
    });

    it('should handle cache invalidation', async () => {
      await diagramService.findById(testDiagramId);
      
      // Update should invalidate cache
      await diagramService.update(testDiagramId, {
        name: 'Updated Name'
      });

      // Verify cache was invalidated
      const cached = await redis.get(`diagram:${testDiagramId}`);
      expect(cached).toBeNull();
    });

    it('should maintain cache consistency', async () => {
      // Create initial cache
      await diagramService.findById(testDiagramId);

      // Update diagram
      const updated = await diagramService.update(testDiagramId, {
        name: 'New Name'
      });

      // Verify cache reflects update
      const cached = await diagramService.findById(testDiagramId);
      expect(cached.name).toBe(updated.name);
    });
  });
});

// Helper Functions

async function createTestDiagram(projectId: string): Promise<IDiagram> {
  const sql = `
    CREATE TABLE test_table (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    );
  `;

  const dto: ICreateDiagramDTO = {
    projectId,
    name: 'Test Diagram',
    sqlDDL: sql
  };

  return diagramService.create(dto);
}

function generateLargeSQL(tableCount: number): string {
  let sql = '';
  for (let i = 0; i < tableCount; i++) {
    sql += `
      CREATE TABLE table_${i} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  }
  return sql;
}