// Vercel serverless function entry point
// Import the Express app (ES module)
import app from '../server/server.js';

// Export the app directly for Vercel
// Vercel will automatically handle the Express app
export default app;

