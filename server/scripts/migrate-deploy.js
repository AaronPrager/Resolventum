#!/usr/bin/env node
// Migration script for Vercel deployments
// Uses DIRECT_URL for migrations if available, otherwise falls back to DATABASE_URL

import { execSync } from 'child_process';

const directUrl = process.env.DIRECT_URL;
const databaseUrl = process.env.DATABASE_URL;

// Debug logging (without exposing full connection string)
console.log('Migration script starting...');
console.log('DIRECT_URL set:', !!directUrl);
console.log('DATABASE_URL set:', !!databaseUrl);
if (databaseUrl) {
  // Log first part of connection string for debugging (without exposing credentials)
  const urlParts = databaseUrl.split('@');
  if (urlParts.length > 1) {
    console.log('DATABASE_URL format:', databaseUrl.substring(0, 20) + '...@' + urlParts[1].substring(0, 30) + '...');
  } else {
    console.log('DATABASE_URL format:', databaseUrl.substring(0, 50) + '...');
  }
}

// Check if DATABASE_URL is a Prisma Accelerate connection
const isAccelerateConnection = databaseUrl && (
  databaseUrl.includes('accelerate.prisma-data.net') ||
  databaseUrl.includes('prisma://') ||
  databaseUrl.includes('?pgbouncer=true')
);

if (directUrl) {
  console.log('Using DIRECT_URL for migrations');
  process.env.DATABASE_URL = directUrl;
} else if (isAccelerateConnection) {
  console.warn('⚠️  WARNING: DATABASE_URL appears to be a Prisma Accelerate connection.');
  console.warn('⚠️  Migrations require a direct database connection.');
  console.warn('⚠️  Please set DIRECT_URL in Vercel environment variables.');
  console.warn('⚠️  DIRECT_URL should be your direct PostgreSQL connection string (not pooled).');
  console.warn('⚠️  Attempting to use DATABASE_URL anyway, but this may fail...');
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }
} else {
  console.log('Using DATABASE_URL for migrations');
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set');
    console.error('Make sure DATABASE_URL is set in Vercel environment variables');
    process.exit(1);
  }
}

try {
  console.log('Running prisma migrate deploy...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });
  console.log('✅ Migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('');
  console.error('This might be due to:');
  console.error('1. Network connectivity issues during build');
  console.error('2. Prisma Accelerate connection string format (migrations need DIRECT_URL)');
  console.error('3. Database server not accessible from Vercel build environment');
  console.error('');
  if (isAccelerateConnection && !directUrl) {
    console.error('🔧 SOLUTION: Set DIRECT_URL in Vercel environment variables.');
    console.error('   DIRECT_URL should be your direct PostgreSQL connection string.');
    console.error('   It should look like: postgresql://user:password@host:port/database');
    console.error('   (NOT the Prisma Accelerate connection string)');
    console.error('');
  }
  console.error('⚠️  Build will continue, but migrations may need to be run manually.');
  console.error('⚠️  If the table already exists (from db push), you can mark this migration as applied:');
  console.error('⚠️  Run: npx prisma migrate resolve --applied 20250123000000_add_home_office_deductions');
  // Exit with error to fail the build - migrations are important
  // But the build command has || echo so it will continue anyway
  process.exit(1);
}

