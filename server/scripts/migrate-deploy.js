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

if (directUrl) {
  console.log('Using DIRECT_URL for migrations');
  process.env.DATABASE_URL = directUrl;
} else {
  console.log('DIRECT_URL not set, using DATABASE_URL for migrations');
  if (!databaseUrl) {
    console.error('ERROR: Neither DIRECT_URL nor DATABASE_URL is set');
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
  console.log('Migrations completed successfully');
} catch (error) {
  console.error('Migration failed:', error.message);
  console.error('This might be due to:');
  console.error('1. Network connectivity issues during build');
  console.error('2. Prisma Accelerate connection string format (migrations may need direct connection)');
  console.error('3. Database server not accessible from Vercel build environment');
  console.error('');
  console.error('If migrations were already applied, you can skip this step in the build command.');
  process.exit(1);
}

