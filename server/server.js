import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Load environment variables (only needed locally, Vercel provides them automatically)
if (process.env.VERCEL !== '1') {
  dotenv.config();
}

// Log environment check (for debugging in Vercel)
if (process.env.VERCEL === '1') {
  console.log('Vercel Environment Check:', {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    HAS_DATABASE_URL: !!process.env.DATABASE_URL,
    HAS_JWT_SECRET: !!process.env.JWT_SECRET ? 'Set' : 'Missing',
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length || 0
  });
}

// Import Prisma client (handles serverless properly)
import './prisma/client.js';

// Import scheduled jobs (will skip in Vercel)
import { initializeScheduledJobs } from './jobs/reminderScheduler.js';

// Import routes
import authRoutes from './routes/auth.js';
import studentsRoutes from './routes/students.js';
import lessonsRoutes from './routes/lessons.js';
import packagesRoutes from './routes/packages.js';
import paymentsRoutes from './routes/payments.js';
import invoicesRoutes from './routes/invoices.js';
import reportsRoutes from './routes/reports.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check (simple - no database needed)
app.get('/api/health', (req, res) => {
  try {
    res.json({ 
      status: 'ok', 
      message: 'Tutoring Management API is running',
      env: {
        vercel: process.env.VERCEL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/reports', reportsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Only start server if not in Vercel (for local development)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    // Initialize scheduled jobs (SMS reminders)
    initializeScheduledJobs();
  });
}

// Always export app (for both local and Vercel)
export default app;

