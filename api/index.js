import { createServer } from '@vercel/node';
import app from '../server/server.js';

// Create serverless handler for Vercel
// This preserves the full path for Express routing
export default createServer(app);

