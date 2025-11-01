import { PrismaClient } from '@prisma/client';

let prisma;

// For serverless (Vercel), always create a new instance
// For local dev, reuse to avoid too many connections
try {
  if (process.env.VERCEL === '1') {
    console.log('Initializing Prisma Client for Vercel serverless');
    prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  } else {
    if (!global.prisma) {
      global.prisma = new PrismaClient();
    }
    prisma = global.prisma;
  }
  console.log('Prisma Client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Prisma Client:', error.message);
  console.error('Error stack:', error.stack);
  // Re-throw so we know what's wrong
  throw error;
}

export default prisma;

