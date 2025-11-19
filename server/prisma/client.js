import { PrismaClient } from '@prisma/client';

let prisma;
let prismaInitialized = false;

function initializePrisma() {
  if (prismaInitialized) {
    return prisma;
  }

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
    prismaInitialized = true;
    return prisma;
  }

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
    
    // Verify that the client has expected models
    const hasUserModel = typeof prisma.user !== 'undefined';
    const hasHomeOfficeModel = typeof prisma.homeOfficeDeduction !== 'undefined';
    
    console.log('Prisma Client initialized successfully');
    console.log(`  - User model: ${hasUserModel ? '✅' : '❌'}`);
    console.log(`  - HomeOfficeDeduction model: ${hasHomeOfficeModel ? '✅' : '❌'}`);
    
    if (!hasUserModel) {
      console.error('CRITICAL: User model not found in Prisma client!');
      console.error('Available properties:', Object.keys(prisma).filter(key => !key.startsWith('$')));
    }
    
    prismaInitialized = true;
    return prisma;
  } catch (error) {
    console.error('Failed to initialize Prisma Client:', error.message);
    console.error('Error stack:', error.stack);
    // Don't throw - return a dummy client that will fail gracefully
    prisma = {
      $connect: async () => { throw new Error('Prisma initialization failed: ' + error.message); },
      $disconnect: async () => {},
      $queryRaw: async () => { throw new Error('Prisma initialization failed: ' + error.message); },
      user: { findUnique: () => Promise.reject(new Error('Prisma initialization failed: ' + error.message)) }
    };
    prismaInitialized = true;
    return prisma;
  }
}

// Create a proxy that initializes Prisma on first access
const prismaProxy = new Proxy({}, {
  get(target, prop) {
    try {
      const client = initializePrisma();
      const value = client[prop];
      
      // If accessing a model that doesn't exist, log error
      if (prop && !prop.startsWith('$') && !prop.startsWith('_') && value === undefined) {
        console.error(`⚠️  Prisma model '${prop}' not found in client`);
        console.error('Available models:', Object.keys(client).filter(key => !key.startsWith('$') && !key.startsWith('_')));
      }
      
      return value;
    } catch (error) {
      console.error(`Error accessing Prisma property '${prop}':`, error.message);
      throw error;
    }
  }
});

export default prismaProxy;

