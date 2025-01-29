import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { rest } from 'msw';
import { server } from '../mocks/server';
import DiagramService from '../../src/services/diagram.service';
import { DiagramState, DiagramLayout } from '../../src/types/diagram.types';
import { SQLDialect } from '../../src/types/sql.types';
import { CollaborationEventType } from '../../src/types/collaboration.types';

// Test constants
const TEST_PROJECT_ID = "test-project-123";
const TEST_DIAGRAM_ID = "test-diagram-456";
const TEST_USER_ID = "test-user-789";
const SYNC_TIMEOUT = 100;

// Sample SQL DDL for testing
const TEST_SQL_DDL = `
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

// Test service instance
let diagramService: DiagramService;

describe('Diagram Integration Tests', () => {
  beforeAll(async () => {
    // Initialize diagram service
    diagramService = new DiagramService();

    // Setup WebSocket handlers for collaboration testing
    server.listen();
  });

  afterAll(() => {
    // Cleanup
    diagramService.stopCollaboration();
    server.close();
  });

  beforeEach(() => {
    // Reset handlers and state
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('Diagram CRUD Operations', () => {
    it('should create a new diagram with SQL DDL', async () => {
      // Mock create diagram endpoint
      server.use(
        rest.post('/api/diagrams', async (req, res, ctx) => {
          const body = await req.json();
          expect(body.projectId).toBe(TEST_PROJECT_ID);
          expect(body.sqlDDL).toBe(TEST_SQL_DDL);

          return res(
            ctx.status(200),
            ctx.json({
              id: TEST_DIAGRAM_ID,
              projectId: TEST_PROJECT_ID,
              name: 'Test Diagram',
              sqlDDL: TEST_SQL_DDL,
              dialect: SQLDialect.POSTGRESQL,
              layout: {
                nodes: [],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 }
              }
            })
          );
        })
      );

      const result = await diagramService.createDiagram({
        projectId: TEST_PROJECT_ID,
        name: 'Test Diagram',
        sqlDDL: TEST_SQL_DDL,
        dialect: SQLDialect.POSTGRESQL
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_DIAGRAM_ID);
      expect(result.sqlDDL).toBe(TEST_SQL_DDL);
    });

    it('should retrieve an existing diagram', async () => {
      // Mock get diagram endpoint
      server.use(
        rest.get(`/api/diagrams/${TEST_DIAGRAM_ID}`, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              id: TEST_DIAGRAM_ID,
              projectId: TEST_PROJECT_ID,
              name: 'Test Diagram',
              sqlDDL: TEST_SQL_DDL,
              layout: {
                nodes: [],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 }
              }
            })
          );
        })
      );

      const diagram = await diagramService.getDiagram(TEST_DIAGRAM_ID);
      expect(diagram).toBeDefined();
      expect(diagram.id).toBe(TEST_DIAGRAM_ID);
    });

    it('should update diagram layout', async () => {
      const newLayout: DiagramLayout = {
        nodes: [
          {
            id: 'users',
            type: 'table',
            position: { x: 100, y: 100 },
            data: { /* table data */ }
          }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
        gridSize: 20,
        snapToGrid: true
      };

      server.use(
        rest.put(`/api/diagrams/${TEST_DIAGRAM_ID}`, async (req, res, ctx) => {
          const body = await req.json();
          expect(body.layout).toEqual(newLayout);

          return res(
            ctx.status(200),
            ctx.json({
              id: TEST_DIAGRAM_ID,
              layout: newLayout
            })
          );
        })
      );

      const result = await diagramService.updateDiagram(TEST_DIAGRAM_ID, {
        layout: newLayout
      });

      expect(result.layout).toEqual(newLayout);
    });
  });

  describe('SQL Parsing and Validation', () => {
    it('should parse PostgreSQL DDL correctly', async () => {
      server.use(
        rest.post('/api/diagrams/parse', async (req, res, ctx) => {
          const body = await req.json();
          expect(body.sql).toBe(TEST_SQL_DDL);
          expect(body.dialect).toBe(SQLDialect.POSTGRESQL);

          return res(
            ctx.status(200),
            ctx.json({
              tables: [
                {
                  name: 'users',
                  columns: [
                    { name: 'id', type: 'SERIAL', isPrimaryKey: true },
                    { name: 'email', type: 'VARCHAR', length: 255, isUnique: true }
                  ]
                },
                {
                  name: 'orders',
                  columns: [
                    { name: 'id', type: 'SERIAL', isPrimaryKey: true },
                    { name: 'user_id', type: 'INTEGER', isForeignKey: true }
                  ]
                }
              ],
              relationships: [
                {
                  sourceTable: 'orders',
                  targetTable: 'users',
                  sourceColumn: 'user_id',
                  targetColumn: 'id'
                }
              ]
            })
          );
        })
      );

      const parsedDDL = await diagramService.parseSQLDDL(TEST_SQL_DDL, SQLDialect.POSTGRESQL);
      expect(parsedDDL.tables).toHaveLength(2);
      expect(parsedDDL.relationships).toHaveLength(1);
    });

    it('should handle SQL syntax errors gracefully', async () => {
      const invalidSQL = 'CREATE TABLE invalid syntax;';
      
      server.use(
        rest.post('/api/diagrams/parse', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              error: {
                code: 'SYNTAX_ERROR',
                message: 'Invalid SQL syntax near "syntax"'
              }
            })
          );
        })
      );

      await expect(
        diagramService.parseSQLDDL(invalidSQL, SQLDialect.POSTGRESQL)
      ).rejects.toThrow('Invalid SQL syntax');
    });
  });

  describe('Real-time Collaboration', () => {
    it('should establish WebSocket connection for collaboration', async () => {
      const wsUrl = `ws://localhost/collaborate`;
      
      await diagramService.startCollaboration(TEST_DIAGRAM_ID);
      expect(diagramService.provider.connected).toBe(true);
    });

    it('should sync diagram updates in real-time', async () => {
      const updatePromise = new Promise<void>((resolve) => {
        server.use(
          rest.put(`/api/diagrams/${TEST_DIAGRAM_ID}`, async (req, res, ctx) => {
            resolve();
            return res(ctx.status(200), ctx.json({}));
          })
        );
      });

      await diagramService.startCollaboration(TEST_DIAGRAM_ID);

      const update: Partial<DiagramState> = {
        layout: {
          nodes: [{ id: 'new-node', position: { x: 100, y: 100 }, data: {} }],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
          gridSize: 20,
          snapToGrid: true
        }
      };

      await diagramService.updateDiagram(TEST_DIAGRAM_ID, update);
      await updatePromise;
    });

    it('should track user presence and cursor positions', async () => {
      await diagramService.startCollaboration(TEST_DIAGRAM_ID);

      const cursorPosition = { x: 150, y: 150 };
      await diagramService.updateCursorPosition(TEST_USER_ID, cursorPosition);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, SYNC_TIMEOUT));

      const collaborators = diagramService.getCollaborators();
      expect(collaborators).toContainEqual(expect.objectContaining({
        userId: TEST_USER_ID,
        cursorPosition
      }));
    });

    it('should handle offline changes and sync on reconnection', async () => {
      // Simulate offline state
      server.use(
        rest.put(`/api/diagrams/${TEST_DIAGRAM_ID}`, (req, res, ctx) => {
          return res(ctx.status(503));
        })
      );

      const offlineUpdate: Partial<DiagramState> = {
        layout: {
          nodes: [{ id: 'offline-node', position: { x: 200, y: 200 }, data: {} }],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
          gridSize: 20,
          snapToGrid: true
        }
      };

      // Make offline change
      await diagramService.updateDiagram(TEST_DIAGRAM_ID, offlineUpdate);

      // Simulate reconnection
      server.resetHandlers();
      await diagramService.syncOfflineChanges();

      // Verify changes were synced
      const diagram = await diagramService.getDiagram(TEST_DIAGRAM_ID);
      expect(diagram.layout.nodes).toContainEqual(
        expect.objectContaining({ id: 'offline-node' })
      );
    });
  });
});