import { PrismaClient } from '@prisma/client';

let prisma;

// Check for DATABASE_URL before initializing
if (!process.env.DATABASE_URL) {
  console.error('CRITICAL ERROR: DATABASE_URL environment variable is missing!');
  console.error('Please set DATABASE_URL in Vercel environment variables');
  // Create a dummy Prisma client that will fail on use
  // This prevents the module from crashing on import
  prisma = {
    $connect: async () => { throw new Error('DATABASE_URL is not set'); },
    $disconnect: async () => {},
    user: { findUnique: () => Promise.reject(new Error('DATABASE_URL is not set')) }
  };
} else {
  // For serverless (Vercel), always create a new instance
  // For local dev, reuse to avoid too many connections
  // Also treat as serverless if running in a serverless environment (AWS Lambda, Vercel, etc.)
  try {
    const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME || !global;
    if (isServerless) {
      console.log('Initializing Prisma Client for serverless environment');
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
    throw error;
  }
}

export default prisma;

