import { createServer } from '@vercel/node';
import app from '../server/server.js';

// Create serverless handler for Vercel
// This preserves the full path for Express routing
const handler = createServer(app);

export default handler;

