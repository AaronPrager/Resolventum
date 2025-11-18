#!/usr/bin/env node
// Build script for Vercel deployments
// Handles Prisma client generation and migrations

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverDir = __dirname.replace('/scripts', '');
const rootDir = join(serverDir, '..');

// Load environment variables from .env file (if it exists)
dotenv.config({ path: join(rootDir, '.env') });

process.chdir(serverDir);

console.log('🔨 Starting build process...');
console.log('📦 Installing dependencies...');
execSync('npm ci', { stdio: 'inherit' });

console.log('🧹 Clearing cached Prisma client...');
try {
  execSync('rm -rf node_modules/.prisma node_modules/@prisma/client', { stdio: 'inherit' });
} catch (error) {
  // Ignore if directories don't exist
}

console.log('⚙️  Generating Prisma client...');
execSync('npx prisma generate', { stdio: 'inherit' });

console.log('🔄 Running database migrations...');
try {
  execSync('npm run db:migrate:deploy', { stdio: 'inherit' });
  console.log('✅ Migrations completed');
} catch (error) {
  console.warn('⚠️  Migrations skipped or failed - continuing build');
}

console.log('⚙️  Regenerating Prisma client after migrations...');
execSync('npx prisma generate', { stdio: 'inherit' });

console.log('✅ Server build completed');

