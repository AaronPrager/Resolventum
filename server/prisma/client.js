import { PrismaClient } from '@prisma/client';

let prisma;

// For serverless (Vercel), always create a new instance
// For local dev, reuse to avoid too many connections
if (process.env.VERCEL === '1') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;

