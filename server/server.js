// Load environment variables FIRST before any other imports
import { isVercel } from './config.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log environment check (for debugging in serverless environments)
if (isVercel) {
  console.log('Serverless Environment Check:', {
    VERCEL: process.env.VERCEL,
    VERCEL_URL: process.env.VERCEL_URL,
    NODE_ENV: process.env.NODE_ENV,
    HAS_DATABASE_URL: !!process.env.DATABASE_URL,
    HAS_JWT_SECRET: !!process.env.JWT_SECRET ? 'Set' : 'Missing',
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length || 0
  });
}

// Import Prisma client (handles serverless properly)
import './prisma/client.js';
import prisma from './prisma/client.js';

// Log Prisma client status on startup (non-blocking)
setTimeout(() => {
  try {
    // Test if Prisma client has User model
    if (prisma && typeof prisma.user !== 'undefined') {
      console.log('✅ Prisma client loaded - User model available');
    } else {
      console.error('❌ Prisma client or User model not available');
      console.error('Available models:', Object.keys(prisma).filter(key => !key.startsWith('$')));
    }
  } catch (error) {
    console.error('❌ Error checking Prisma client:', error.message);
  }
}, 100);

// Import routes
import authRoutes from './routes/auth.js';
import studentsRoutes from './routes/students.js';
import lessonsRoutes from './routes/lessons.js';
import packagesRoutes from './routes/packages.js';
import paymentsRoutes from './routes/payments.js';
import invoicesRoutes from './routes/invoices.js';
import reportsRoutes from './routes/reports.js';
import profileRoutes from './routes/profile.js';
import googleDriveRoutes from './routes/googledrive.js';
import purchasesRoutes from './routes/purchases.js';
import homeOfficeDeductionsRoutes from './routes/homeOfficeDeductions.js';

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
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
app.use('/api/profile', profileRoutes);
app.use('/api/googledrive', googleDriveRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/home-office-deductions', homeOfficeDeductionsRoutes);

// Serve uploaded files
// Serve uploaded files (before error handlers)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

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

// Only start server if not in serverless environment (for local development)
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Always export app (for both local and Vercel)
export default app;

