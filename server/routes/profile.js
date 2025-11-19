import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import prisma from '../prisma/client.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendEmail, isEmailConfigured } from '../utils/emailService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Logo uploads go to Google Drive only

// Configure multer for file uploads (store in memory for processing)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// GET user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if prisma is available
    if (!prisma || !prisma.user) {
      console.error('ERROR: Prisma client or User model not available');
      return res.status(500).json({ 
        message: 'Database connection error',
        error: 'Prisma client not initialized'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        phone: true,
        address: true,
        logoUrl: true,
        venmo: true,
        zelle: true,
        autoEmailEnabled: true,
        autoEmailTime: true,
        autoEmailAddress: true,
        fileStorageType: true,
        googleDriveAccessToken: true,
        googleDriveRefreshToken: true,
        googleDriveTokenExpiry: true,
        googleDriveFolderId: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({ 
      message: 'Error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT update user profile
router.put('/', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    console.log('Profile update request received');
    console.log('File received:', req.file ? `Yes (${req.file.size} bytes, ${req.file.mimetype})` : 'No');
    console.log('Body fields:', { name: req.body.name, email: req.body.email, companyName: req.body.companyName, phone: req.body.phone, address: req.body.address, venmo: req.body.venmo, zelle: req.body.zelle });
    
    const { name, email, companyName, phone, address, venmo, zelle, autoEmailEnabled, autoEmailTime, autoEmailAddress, fileStorageType, googleDriveFolderId } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
      
      updateData.email = email;
    }
    if (companyName !== undefined) updateData.companyName = companyName || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (venmo !== undefined) updateData.venmo = venmo || null;
    if (zelle !== undefined) updateData.zelle = zelle || null;
    if (autoEmailEnabled !== undefined) updateData.autoEmailEnabled = autoEmailEnabled === 'true' || autoEmailEnabled === true;
    if (autoEmailTime !== undefined) updateData.autoEmailTime = autoEmailTime || null;
    if (autoEmailAddress !== undefined) {
      // Validate email format if provided
      if (autoEmailAddress && autoEmailAddress.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(autoEmailAddress)) {
          return res.status(400).json({ message: 'Invalid auto-email address format' });
        }
        updateData.autoEmailAddress = autoEmailAddress.trim();
      } else {
        updateData.autoEmailAddress = null;
      }
    }
    if (fileStorageType !== undefined) {
      // Only allow 'local' or 'googleDrive'
      if (fileStorageType === 'local' || fileStorageType === 'googleDrive') {
        updateData.fileStorageType = fileStorageType;
      }
    }
    if (googleDriveFolderId !== undefined) {
      updateData.googleDriveFolderId = googleDriveFolderId || null;
    }

    // Handle logo upload (Google Drive required)
    if (req.file) {
      try {
        console.log('Processing logo upload...');
        
        // Check if Google Drive is connected
        const currentUser = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { 
            googleDriveAccessToken: true,
            logoUrl: true
          }
        });

        if (!currentUser?.googleDriveAccessToken) {
          return res.status(400).json({ 
            message: 'Google Drive connection required',
            code: 'GOOGLE_DRIVE_NOT_CONNECTED',
            requiresGoogleDrive: true
          });
        }

        // Delete old logo from Google Drive if it exists
        if (currentUser?.logoUrl && currentUser.logoUrl.startsWith('https://drive.google.com')) {
          try {
            const { deleteFileFromDrive } = await import('../utils/googleDrive.js');
            // Extract file ID from Google Drive URL
            const fileIdMatch = currentUser.logoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
              await deleteFileFromDrive(req.user.id, fileIdMatch[1]);
              console.log('Deleted old logo from Google Drive');
            }
          } catch (error) {
            console.warn('Error deleting old logo from Google Drive (non-critical):', error.message);
          }
        }

        // Resize and optimize image to small version (max 200x200px)
        const resizedBuffer = await sharp(req.file.buffer)
          .resize(200, 200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: 85,
            mozjpeg: true
          })
          .toBuffer();

        // Upload to Google Drive
        const { uploadFileToDrive, getOrCreateLessonsFolder } = await import('../utils/googleDrive.js');
        const lessonsFolder = await getOrCreateLessonsFolder(req.user.id);
        const filename = `logo-${req.user.id}-${Date.now()}.jpg`;
        
        const result = await uploadFileToDrive(
          req.user.id,
          resizedBuffer,
          filename,
          'image/jpeg',
          lessonsFolder.folderId
        );

        // Store Google Drive web view link
        updateData.logoUrl = result.webViewLink;
        console.log('Logo uploaded to Google Drive:', result.webViewLink);
      } catch (error) {
        console.error('Error processing logo:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ message: 'Error processing image: ' + error.message });
      }
    }

    // Handle logo removal (if logoUrl is explicitly set to empty string)
    if (req.body.logoUrl === '') {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { logoUrl: true }
      });

      if (user?.logoUrl && user.logoUrl.startsWith('https://drive.google.com')) {
        try {
          const { deleteFileFromDrive } = await import('../utils/googleDrive.js');
          // Extract file ID from Google Drive URL
          const fileIdMatch = user.logoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (fileIdMatch && fileIdMatch[1]) {
            await deleteFileFromDrive(req.user.id, fileIdMatch[1]);
            console.log('Deleted logo from Google Drive');
          }
        } catch (error) {
          console.warn('Error deleting logo from Google Drive (non-critical):', error.message);
        }
      }
      updateData.logoUrl = null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        phone: true,
        address: true,
        logoUrl: true,
        venmo: true,
        zelle: true,
        autoEmailEnabled: true,
        autoEmailTime: true,
        autoEmailAddress: true,
        fileStorageType: true,
        googleDriveAccessToken: true,
        googleDriveRefreshToken: true,
        googleDriveTokenExpiry: true,
        googleDriveFolderId: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// DELETE user account (soft delete)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user info before soft deletion for email notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        phone: true,
        logoUrl: true,
        createdAt: true,
        deleted: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already deleted
    if (user.deleted) {
      return res.status(400).json({ message: 'Account is already deleted' });
    }

    // Count related records for email notification (optional - don't fail if this errors)
    let studentsCount = 0;
    let lessonsCount = 0;
    let paymentsCount = 0;
    let packagesCount = 0;
    
    try {
      [studentsCount, lessonsCount, paymentsCount, packagesCount] = await Promise.all([
        prisma.student.count({ where: { userId } }),
        prisma.lesson.count({ where: { userId } }),
        prisma.payment.count({ where: { userId } }),
        prisma.package.count({ where: { userId } })
      ]);
    } catch (countError) {
      console.warn('Could not count related records for deletion notification:', countError.message);
      // Continue with deletion even if counting fails
    }

    // Soft delete: Mark account as deleted instead of actually deleting
    await prisma.user.update({
      where: { id: userId },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    console.log(`User account marked as deleted: ${user.email} (ID: ${userId})`);

    // Send email notification to resolventum@gmail.com
    try {
      if (isEmailConfigured()) {
        const emailSubject = 'Account Deletion - Resolventum';
        const emailText = `A user account has been marked as deleted in Resolventum:

Name: ${user.name}
Email: ${user.email}
Company Name: ${user.companyName || 'Not provided'}
Phone: ${user.phone || 'Not provided'}
Account Created: ${user.createdAt.toLocaleString()}
Account Deleted: ${new Date().toLocaleString()}

Note: Account data has been preserved but login is disabled.

Account Data:
- ${studentsCount} students
- ${lessonsCount} lessons
- ${paymentsCount} payments
- ${packagesCount} packages

User ID: ${user.id}`;

        const emailHtml = `
          <h2>Account Deletion Notification</h2>
          <p>A user account has been marked as deleted in Resolventum:</p>
          <ul>
            <li><strong>Name:</strong> ${user.name}</li>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Company Name:</strong> ${user.companyName || 'Not provided'}</li>
            <li><strong>Phone:</strong> ${user.phone || 'Not provided'}</li>
            <li><strong>Account Created:</strong> ${user.createdAt.toLocaleString()}</li>
            <li><strong>Account Deleted:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p><strong>Note:</strong> Account data has been preserved but login is disabled.</p>
          <h3>Account Data:</h3>
          <ul>
            <li>${studentsCount} students</li>
            <li>${lessonsCount} lessons</li>
            <li>${paymentsCount} payments</li>
            <li>${packagesCount} packages</li>
          </ul>
          <p><strong>User ID:</strong> ${user.id}</p>
        `;

        await sendEmail({
          to: 'resolventum@gmail.com',
          subject: emailSubject,
          text: emailText,
          html: emailHtml
        });
        console.log('Account deletion notification email sent to resolventum@gmail.com');
      } else {
        console.log('Email service not configured - skipping deletion notification');
      }
    } catch (emailError) {
      // Log error but don't fail deletion if email fails
      console.error('Failed to send account deletion notification email:', emailError);
    }

    res.json({ message: 'Account has been marked as deleted. Login is now disabled.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Error deleting account' });
  }
});

export default router;

