import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import prisma from '../prisma/client.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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
        zelle: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// PUT update user profile
router.put('/', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    console.log('Profile update request received');
    console.log('File received:', req.file ? `Yes (${req.file.size} bytes, ${req.file.mimetype})` : 'No');
    console.log('Body fields:', { name: req.body.name, email: req.body.email, companyName: req.body.companyName, phone: req.body.phone, address: req.body.address, venmo: req.body.venmo, zelle: req.body.zelle });
    
    const { name, email, companyName, phone, address, venmo, zelle } = req.body;
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

    // Handle logo upload
    if (req.file) {
      try {
        console.log('Processing logo upload...');
        
        // Delete old logo if it exists
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { logoUrl: true }
        });

        if (user?.logoUrl) {
          const oldLogoPath = path.join(__dirname, '../uploads/logos', path.basename(user.logoUrl));
          if (fs.existsSync(oldLogoPath)) {
            console.log('Deleting old logo:', oldLogoPath);
            fs.unlinkSync(oldLogoPath);
          }
        }

        // Resize and optimize image to small version (max 200x200px)
        const filename = `${req.user.id}-${Date.now()}.jpg`;
        const outputPath = path.join(uploadsDir, filename);
        
        console.log('Resizing image to:', outputPath);
        console.log('Input buffer size:', req.file.buffer.length);

        await sharp(req.file.buffer)
          .resize(200, 200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: 85,
            mozjpeg: true
          })
          .toFile(outputPath);

        console.log('Image saved successfully to:', outputPath);
        console.log('File exists:', fs.existsSync(outputPath));

        // Store relative path for logo URL
        updateData.logoUrl = `/uploads/logos/${filename}`;
        console.log('Logo URL set to:', updateData.logoUrl);
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

      if (user?.logoUrl) {
        const oldLogoPath = path.join(__dirname, '../uploads/logos', path.basename(user.logoUrl));
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
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
        zelle: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

export default router;

