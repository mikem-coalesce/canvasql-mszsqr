import { PrismaClient, User, Workspace, Project, Diagram } from '@prisma/client'; // ^5.0.0
import { hashPassword } from '../src/core/utils/encryption.util';

// Initialize Prisma client with error handling
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'pretty',
});

/**
 * Creates sample user accounts with secure password hashing
 */
async function createSampleUsers(): Promise<User[]> {
  const users = [
    {
      email: 'admin@example.com',
      name: 'System Admin',
      role: 'ADMIN',
      password: await hashPassword('Admin123!'),
    },
    {
      email: 'architect@example.com',
      name: 'Database Architect',
      role: 'EDITOR',
      password: await hashPassword('Architect123!'),
    },
    {
      email: 'developer@example.com',
      name: 'Developer',
      role: 'EDITOR',
      password: await hashPassword('Developer123!'),
    },
    {
      email: 'viewer@example.com',
      name: 'Project Viewer',
      role: 'VIEWER',
      password: await hashPassword('Viewer123!'),
    },
  ];

  return await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  }).then(() => prisma.user.findMany());
}

/**
 * Creates sample workspaces with proper ownership and settings
 */
async function createSampleWorkspaces(users: User[]): Promise<Workspace[]> {
  const admin = users.find(u => u.role === 'ADMIN')!;
  const architect = users.find(u => u.role === 'EDITOR' && u.name.includes('Architect'))!;

  const workspaces = [
    {
      name: 'E-Commerce Platform',
      ownerId: admin.id,
      settings: {
        allowExport: true,
        allowSharing: true,
        maxProjects: 10,
        theme: 'light',
      },
    },
    {
      name: 'Customer Management',
      ownerId: architect.id,
      settings: {
        allowExport: true,
        allowSharing: true,
        maxProjects: 5,
        theme: 'dark',
      },
    },
  ];

  return await prisma.workspace.createMany({
    data: workspaces,
    skipDuplicates: true,
  }).then(() => prisma.workspace.findMany());
}

/**
 * Creates sample projects with metadata and workspace associations
 */
async function createSampleProjects(workspaces: Workspace[]): Promise<Project[]> {
  const projects = workspaces.flatMap(workspace => [
    {
      name: 'Core Schema',
      description: 'Main database schema design',
      workspaceId: workspace.id,
      metadata: {
        database: 'PostgreSQL',
        version: '14',
        environment: 'development',
        status: 'in_progress',
      },
    },
    {
      name: 'Analytics Schema',
      description: 'Data warehouse schema design',
      workspaceId: workspace.id,
      metadata: {
        database: 'Snowflake',
        version: 'Enterprise',
        environment: 'production',
        status: 'review',
      },
    },
  ]);

  return await prisma.project.createMany({
    data: projects,
    skipDuplicates: true,
  }).then(() => prisma.project.findMany());
}

/**
 * Creates sample ERD diagrams with SQL DDL and version history
 */
async function createSampleDiagrams(projects: Project[]): Promise<Diagram[]> {
  const sampleSqlDDL = `
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

  const diagrams = projects.map(project => ({
    name: `${project.name} ERD`,
    projectId: project.id,
    sqlDdl: sampleSqlDDL,
    layout: {
      nodes: [
        { id: 'users', position: { x: 100, y: 100 } },
        { id: 'orders', position: { x: 300, y: 100 } },
      ],
      edges: [
        { source: 'orders', target: 'users', type: 'foreignKey' },
      ],
    },
    annotations: {
      comments: [],
      highlights: [],
    },
    lastModified: new Date(),
  }));

  return await prisma.diagram.createMany({
    data: diagrams,
    skipDuplicates: true,
  }).then(() => prisma.diagram.findMany());
}

/**
 * Performs cleanup operations and handles resource disposal
 */
async function cleanup(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

/**
 * Main seeding function that orchestrates the creation of sample data
 * with transaction support and error handling
 */
async function main(): Promise<void> {
  console.log('Starting database seed...');

  try {
    // Execute all seeding operations in a transaction
    await prisma.$transaction(async (tx) => {
      // Create sample data in sequence
      const users = await createSampleUsers();
      console.log(`Created ${users.length} sample users`);

      const workspaces = await createSampleWorkspaces(users);
      console.log(`Created ${workspaces.length} sample workspaces`);

      const projects = await createSampleProjects(workspaces);
      console.log(`Created ${projects.length} sample projects`);

      const diagrams = await createSampleDiagrams(projects);
      console.log(`Created ${diagrams.length} sample diagrams`);
    });

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error during database seeding:', error);
    throw error;
  } finally {
    await cleanup();
  }
}

// Execute seeding
main()
  .catch((error) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  });