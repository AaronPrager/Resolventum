import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if running in Vercel/serverless
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_URL || process.env.VERCEL_REGION;

// Load environment variables (only needed locally, Vercel provides them automatically)
if (!isVercel) {
  // Load .env from project root (parent directory of server/)
  const envPath = path.join(__dirname, '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn(`Warning: Could not load .env file from ${envPath}:`, result.error.message);
  } else {
    console.log(`Loaded environment variables from ${envPath}`);
  }
}

export { isVercel };

