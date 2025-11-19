import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for purchase receipt uploads - use memory storage (files go to Google Drive)
const uploadPurchaseReceipt = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file
  }
});

// Helper function to calculate recurring purchase dates
function calculateRecurringDates(startDate, frequency, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  
  // Handle endDate - extract the intended date in local timezone
  let endYear, endMonth, endDay;
  
  if (typeof endDate === 'string') {
    const datePart = endDate.split('T')[0];
    const parts = datePart.split('-');
    endYear = parseInt(parts[0], 10);
    endMonth = parseInt(parts[1], 10) - 1;
    endDay = parseInt(parts[2], 10);
  } else {
    const endTemp = new Date(endDate);
    endYear = endTemp.getFullYear();
    endMonth = endTemp.getMonth();
    endDay = endTemp.getDate();
  }
  
  const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
  
  const getDateOnly = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const compareDatesOnly = (date1, date2) => {
    const d1Str = getDateOnly(date1);
    const d2Str = getDateOnly(date2);
    return d1Str <= d2Str;
  };
  
  while (compareDatesOnly(currentDate, end)) {
    const dateToAdd = new Date(currentDate);
    dates.push(dateToAdd);
    
    switch (frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        return dates;
    }
  }
  
  return dates;
}

router.use(authenticateToken);

// Get frequent vendors for the user
router.get('/vendors', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { frequentVendors: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const vendors = user.frequentVendors ? JSON.parse(user.frequentVendors) : [];
    res.json(vendors);
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ message: 'Error fetching vendors' });
  }
});

// Add vendor to frequent vendors
router.post('/vendors', async (req, res) => {
  try {
    const { vendor } = req.body;
    
    if (!vendor || !vendor.trim()) {
      return res.status(400).json({ message: 'Vendor name is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { frequentVendors: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const vendorName = vendor.trim();
    const currentVendors = user.frequentVendors ? JSON.parse(user.frequentVendors) : [];
    
    // Remove vendor if it exists (to move it to the front)
    const filteredVendors = currentVendors.filter(v => v.toLowerCase() !== vendorName.toLowerCase());
    
    // Add to the beginning of the array (most recent first)
    const updatedVendors = [vendorName, ...filteredVendors].slice(0, 20); // Keep max 20 vendors

    await prisma.user.update({
      where: { id: req.user.id },
      data: { frequentVendors: JSON.stringify(updatedVendors) }
    });

    res.json(updatedVendors);
  } catch (error) {
    console.error('Add vendor error:', error);
    res.status(500).json({ message: 'Error adding vendor' });
  }
});

// Delete vendor from frequent vendors
router.delete('/vendors/:vendor', async (req, res) => {
  try {
    const vendorName = decodeURIComponent(req.params.vendor);
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { frequentVendors: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentVendors = user.frequentVendors ? JSON.parse(user.frequentVendors) : [];
    const updatedVendors = currentVendors.filter(v => v.toLowerCase() !== vendorName.toLowerCase());

    await prisma.user.update({
      where: { id: req.user.id },
      data: { frequentVendors: JSON.stringify(updatedVendors) }
    });

    res.json(updatedVendors);
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ message: 'Error deleting vendor' });
  }
});

// Get custom categories
router.get('/settings/categories', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { purchaseCategories: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const categories = user.purchaseCategories ? JSON.parse(user.purchaseCategories) : [];
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// Add custom category
router.post('/settings/categories', async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { purchaseCategories: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const categoryName = category.trim();
    const currentCategories = user.purchaseCategories ? JSON.parse(user.purchaseCategories) : [];
    
    // Check if category already exists
    if (currentCategories.some(c => c.toLowerCase() === categoryName.toLowerCase())) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    
    const updatedCategories = [...currentCategories, categoryName];

    await prisma.user.update({
      where: { id: req.user.id },
      data: { purchaseCategories: JSON.stringify(updatedCategories) }
    });

    res.json(updatedCategories);
  } catch (error) {
    console.error('Add category error:', error);
    res.status(500).json({ message: 'Error adding category' });
  }
});

// Delete custom category
router.delete('/settings/categories/:category', async (req, res) => {
  try {
    const categoryName = decodeURIComponent(req.params.category);
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { purchaseCategories: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentCategories = user.purchaseCategories ? JSON.parse(user.purchaseCategories) : [];
    const updatedCategories = currentCategories.filter(c => c.toLowerCase() !== categoryName.toLowerCase());

    await prisma.user.update({
      where: { id: req.user.id },
      data: { purchaseCategories: JSON.stringify(updatedCategories) }
    });

    res.json(updatedCategories);
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Error deleting category' });
  }
});

// Get payment methods
router.get('/settings/payment-methods', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { paymentMethodDetails: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const paymentMethods = user.paymentMethodDetails ? JSON.parse(user.paymentMethodDetails) : [];
    res.json(paymentMethods);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ message: 'Error fetching payment methods' });
  }
});

// Add payment method
router.post('/settings/payment-methods', async (req, res) => {
  try {
    const { type, name, last4, bank, notes } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Payment method name is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { paymentMethodDetails: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentMethods = user.paymentMethodDetails ? JSON.parse(user.paymentMethodDetails) : [];
    const newMethod = {
      id: uuidv4(),
      type: type || 'other',
      name: name.trim(),
      last4: last4 ? last4.trim() : null,
      bank: bank ? bank.trim() : null,
      notes: notes ? notes.trim() : null
    };
    
    const updatedMethods = [...currentMethods, newMethod];

    await prisma.user.update({
      where: { id: req.user.id },
      data: { paymentMethodDetails: JSON.stringify(updatedMethods) }
    });

    res.json(updatedMethods);
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ message: 'Error adding payment method' });
  }
});

// Update payment method
router.put('/settings/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, name, last4, bank, notes } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Payment method name is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { paymentMethodDetails: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentMethods = user.paymentMethodDetails ? JSON.parse(user.paymentMethodDetails) : [];
    const updatedMethods = currentMethods.map(m => 
      m.id === id 
        ? { ...m, type, name: name.trim(), last4: last4 ? last4.trim() : null, bank: bank ? bank.trim() : null, notes: notes ? notes.trim() : null }
        : m
    );

    await prisma.user.update({
      where: { id: req.user.id },
      data: { paymentMethodDetails: JSON.stringify(updatedMethods) }
    });

    res.json(updatedMethods);
  } catch (error) {
    console.error('Update payment method error:', error);
    res.status(500).json({ message: 'Error updating payment method' });
  }
});

// Delete payment method
router.delete('/settings/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { paymentMethodDetails: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentMethods = user.paymentMethodDetails ? JSON.parse(user.paymentMethodDetails) : [];
    const updatedMethods = currentMethods.filter(m => m.id !== id);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { paymentMethodDetails: JSON.stringify(updatedMethods) }
    });

    res.json(updatedMethods);
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ message: 'Error deleting payment method' });
  }
});

// Get all purchases
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    
    const whereClause = {
      userId: req.user.id,
    };

    // Filter by date range if provided
    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      whereClause.date = {
        gte: new Date(startDate),
      };
    } else if (endDate) {
      whereClause.date = {
        lte: new Date(endDate),
      };
    }

    // Filter by category if provided
    if (category) {
      whereClause.category = category;
    }

    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    });

    res.json(purchases);
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ message: 'Error fetching purchases' });
  }
});

// Get single purchase
router.get('/:id', async (req, res) => {
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    res.json(purchase);
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({ message: 'Error fetching purchase' });
  }
});

// Create purchase
router.post('/', uploadPurchaseReceipt.single('receipt'), [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('category').optional().trim(),
  body('vendor').optional().trim(),
  body('paymentMethod').optional({ values: 'falsy' }).trim(),
  body('notes').optional().trim(),
  body('isRecurring').optional().isBoolean(),
  body('recurringFrequency').optional({ values: 'falsy' }).custom((value) => {
    if (!value || value === '') return true;
    return ['daily', 'weekly', 'monthly', 'yearly'].includes(value);
  }).withMessage('Invalid recurring frequency'),
  body('recurringEndDate').optional({ values: 'falsy' }).custom((value, { req }) => {
    // Only validate if isRecurring is true (handle both boolean and string)
    const isRecurring = req.body.isRecurring === true || req.body.isRecurring === 'true';
    if (isRecurring) {
      if (!value || value === '') return false; // Required when recurring
      // Validate ISO8601 format
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!iso8601Regex.test(value) && !dateRegex.test(value)) {
        return false;
      }
      return !isNaN(Date.parse(value));
    }
    return true; // Optional when not recurring
  }).withMessage('Valid recurring end date is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, description, amount, category, vendor, paymentMethod, notes, isRecurring, recurringFrequency, recurringEndDate } = req.body;

    // Convert isRecurring to boolean if it's a string (from FormData)
    const isRecurringBool = isRecurring === true || isRecurring === 'true';

    // Validate recurring purchase requirements
    if (isRecurringBool && (!recurringFrequency || !recurringEndDate)) {
      return res.status(400).json({ 
        message: 'Recurring purchases require both frequency and end date' 
      });
    }

    // Assign "Unassigned" category if not provided
    const finalCategory = category && category.trim() ? category.trim() : 'Unassigned';

    // Get user's file storage preference
    // Check if Google Drive is connected (required for file uploads)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        googleDriveAccessToken: true 
      }
    });

    // If file is being uploaded, Google Drive must be connected
    if (req.file) {
      if (!user?.googleDriveAccessToken) {
        return res.status(400).json({ 
          message: 'Google Drive connection required',
          code: 'GOOGLE_DRIVE_NOT_CONNECTED',
          requiresGoogleDrive: true
        });
      }
    }
    
    // Handle receipt file upload (Google Drive required - checked above)
    let receiptFilesMetadata = [];
    if (req.file) {
      const { uploadFileToDrive, getOrCreatePurchasesFolder } = await import('../utils/googleDrive.js');
      const purchasesFolder = await getOrCreatePurchasesFolder(req.user.id);

      try {
        // Use file.buffer (memory storage) instead of file.path
        const result = await uploadFileToDrive(
          req.user.id,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          purchasesFolder.folderId
        );
        
        receiptFilesMetadata.push({
          fileName: req.file.originalname,
          fileId: result.fileId,
          webViewLink: result.webViewLink,
          storageType: 'googleDrive',
          uploadedAt: new Date().toISOString()
        });
        
        console.log(`Successfully uploaded receipt "${req.file.originalname}" to Google Drive`);
      } catch (error) {
        console.error('Error uploading receipt to Google Drive:', error);
        return res.status(500).json({ 
          message: `Failed to upload file "${req.file.originalname}" to Google Drive: ${error.message}` 
        });
      }
    }

    const receiptFilesJson = receiptFilesMetadata.length > 0 ? JSON.stringify(receiptFilesMetadata) : null;

    // If recurring, create multiple purchases
    if (isRecurringBool && recurringFrequency && recurringEndDate) {
      const recurringGroupId = uuidv4();
      const startDate = new Date(date);
      const endDate = new Date(recurringEndDate);
      endDate.setHours(23, 59, 59, 999);

      const dates = calculateRecurringDates(startDate, recurringFrequency, endDate);

      const purchasesData = dates.map((purchaseDate, index) => ({
        userId: req.user.id,
        date: purchaseDate,
        description,
        amount: parseFloat(amount),
        category: finalCategory,
        vendor: vendor || null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        receiptFiles: index === 0 ? receiptFilesJson : null, // Only attach receipt to first purchase
        isRecurring: true,
        recurringFrequency,
        recurringEndDate: endDate,
        recurringGroupId,
      }));

      const purchases = await prisma.purchase.createMany({
        data: purchasesData,
      });

      // Update frequent vendors if vendor is provided
      if (vendor && vendor.trim()) {
        await updateFrequentVendors(req.user.id, vendor.trim());
      }

      // Fetch the created purchases to return
      const createdPurchases = await prisma.purchase.findMany({
        where: { recurringGroupId },
        orderBy: { date: 'asc' },
      });

      return res.status(201).json({ 
        message: `Created ${purchases.count} recurring purchases`,
        purchases: createdPurchases 
      });
    } else {
      // Single purchase
      const purchase = await prisma.purchase.create({
        data: {
          userId: req.user.id,
          date: new Date(date),
          description,
          amount: parseFloat(amount),
          category: finalCategory,
          vendor: vendor || null,
          paymentMethod: paymentMethod || null,
          notes: notes || null,
          receiptFiles: receiptFilesJson,
          isRecurring: isRecurringBool || false,
          recurringFrequency: recurringFrequency || null,
          recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
          recurringGroupId: null,
        },
      });


      // Update frequent vendors if vendor is provided (non-blocking)
      if (vendor && vendor.trim()) {
        updateFrequentVendors(req.user.id, vendor.trim()).catch(err => {
          console.error('Error updating frequent vendors (non-critical):', err);
        });
      }

      // Return the purchase (receiptFiles is already stored as JSON string)
      return res.status(201).json(purchase);
    }
  } catch (error) {
    console.error('Create purchase error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error creating purchase',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to update frequent vendors
async function updateFrequentVendors(userId, vendorName) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { frequentVendors: true }
    });

    if (!user) return;

    const currentVendors = user.frequentVendors ? JSON.parse(user.frequentVendors) : [];
    
    // Remove vendor if it exists (to move it to the front)
    const filteredVendors = currentVendors.filter(v => v.toLowerCase() !== vendorName.toLowerCase());
    
    // Add to the beginning of the array (most recent first)
    const updatedVendors = [vendorName, ...filteredVendors].slice(0, 20); // Keep max 20 vendors

    await prisma.user.update({
      where: { id: userId },
      data: { frequentVendors: JSON.stringify(updatedVendors) }
    });
  } catch (error) {
    console.error('Error updating frequent vendors:', error);
    // Don't throw - this is a non-critical operation
  }
}

// Update purchase
router.put('/:id', uploadPurchaseReceipt.single('receipt'), [
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('category').optional().trim(),
  body('vendor').optional().trim(),
  body('paymentMethod').optional({ values: 'falsy' }).trim(),
  body('notes').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify purchase belongs to user
    const existingPurchase = await prisma.purchase.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!existingPurchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const { date, description, amount, category, vendor, paymentMethod, notes, isRecurring, recurringFrequency, recurringEndDate } = req.body;

    // Convert isRecurring to boolean if it's a string (from FormData)
    const isRecurringBool = isRecurring !== undefined 
      ? (isRecurring === true || isRecurring === 'true')
      : undefined;
    
    // Check if changing from non-recurring to recurring
    const wasNonRecurring = !existingPurchase.isRecurring;
    const isChangingToRecurring = wasNonRecurring && isRecurringBool === true;
    
    // Check if updating recurring end date for an existing recurring purchase
    const isUpdatingRecurringEndDate = existingPurchase.isRecurring && 
                                       existingPurchase.recurringGroupId &&
                                       recurringEndDate !== undefined &&
                                       recurringEndDate !== null;
    
    // Check if end date actually changed
    let endDateChanged = false;
    if (isUpdatingRecurringEndDate) {
      const existingEndDate = existingPurchase.recurringEndDate 
        ? new Date(existingPurchase.recurringEndDate).toISOString().split('T')[0]
        : null;
      const newEndDate = new Date(recurringEndDate).toISOString().split('T')[0];
      endDateChanged = existingEndDate !== newEndDate;
    }

    // Assign "Unassigned" category if not provided or empty
    const finalCategory = category !== undefined 
      ? (category && category.trim() ? category.trim() : 'Unassigned')
      : undefined;

    // Check if Google Drive is connected (required for file uploads)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        googleDriveAccessToken: true 
      }
    });

    // If file is being uploaded, Google Drive must be connected
    if (req.file) {
      if (!user?.googleDriveAccessToken) {
        return res.status(400).json({ 
          message: 'Google Drive connection required',
          code: 'GOOGLE_DRIVE_NOT_CONNECTED',
          requiresGoogleDrive: true
        });
      }
    }

    // Handle receipt file upload (Google Drive required - checked above)
    let receiptFilesMetadata = existingPurchase.receiptFiles ? JSON.parse(existingPurchase.receiptFiles) : [];
    if (req.file) {
      const { uploadFileToDrive, getOrCreatePurchasesFolder } = await import('../utils/googleDrive.js');
      const purchasesFolder = await getOrCreatePurchasesFolder(req.user.id);

      try {
        // Use file.buffer (memory storage) instead of file.path
        const result = await uploadFileToDrive(
          req.user.id,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          purchasesFolder.folderId
        );
        
        receiptFilesMetadata.push({
          fileName: req.file.originalname,
          fileId: result.fileId,
          webViewLink: result.webViewLink,
          storageType: 'googleDrive',
          uploadedAt: new Date().toISOString()
        });
        
        console.log(`Successfully uploaded receipt "${req.file.originalname}" to Google Drive`);
      } catch (error) {
        console.error('Error uploading receipt to Google Drive:', error);
        return res.status(500).json({ 
          message: `Failed to upload file "${req.file.originalname}" to Google Drive: ${error.message}` 
        });
      }
    }

    // If changing from non-recurring to recurring, create multiple purchases
    if (isChangingToRecurring && recurringFrequency && recurringEndDate) {
      // Validate recurring purchase requirements
      if (!recurringFrequency || !recurringEndDate) {
        return res.status(400).json({
          message: 'Recurring purchases require both frequency and end date'
        });
      }

      // Get values to use (from update or existing purchase)
      const purchaseDate = date !== undefined ? new Date(date) : existingPurchase.date;
      const purchaseDescription = description !== undefined ? description : existingPurchase.description;
      const purchaseAmount = amount !== undefined ? parseFloat(amount) : existingPurchase.amount;
      const purchaseCategory = finalCategory !== undefined ? finalCategory : (existingPurchase.category || 'Unassigned');
      const purchaseVendor = vendor !== undefined ? (vendor || null) : existingPurchase.vendor;
      const purchasePaymentMethod = paymentMethod !== undefined ? (paymentMethod || null) : existingPurchase.paymentMethod;
      const purchaseNotes = notes !== undefined ? (notes || null) : existingPurchase.notes;

      const recurringGroupId = uuidv4();
      const startDate = purchaseDate;
      const endDate = new Date(recurringEndDate);
      endDate.setHours(23, 59, 59, 999);

      const dates = calculateRecurringDates(startDate, recurringFrequency, endDate);

      // Preserve existing receipt files if no new file was uploaded
      if (!req.file && existingPurchase.receiptFiles) {
        receiptFilesMetadata = JSON.parse(existingPurchase.receiptFiles);
      }
      
      const receiptFilesJson = receiptFilesMetadata.length > 0 ? JSON.stringify(receiptFilesMetadata) : null;

      const purchasesData = dates.map((purchaseDateItem, index) => ({
        userId: req.user.id,
        date: purchaseDateItem,
        description: purchaseDescription,
        amount: purchaseAmount,
        category: purchaseCategory,
        vendor: purchaseVendor,
        paymentMethod: purchasePaymentMethod,
        notes: purchaseNotes,
        receiptFiles: index === 0 ? receiptFilesJson : null, // Only attach receipt to first purchase
        isRecurring: true,
        recurringFrequency,
        recurringEndDate: endDate,
        recurringGroupId,
      }));

      // Delete the original purchase
      await prisma.purchase.delete({
        where: { id: req.params.id }
      });

      // Create multiple purchases
      const purchases = await prisma.purchase.createMany({
        data: purchasesData,
      });

      // Update frequent vendors if vendor is provided (non-blocking)
      if (vendor !== undefined && vendor && vendor.trim()) {
        updateFrequentVendors(req.user.id, vendor.trim()).catch(err => {
          console.error('Error updating frequent vendors (non-critical):', err);
        });
      }

      // Fetch the created purchases to return
      const createdPurchases = await prisma.purchase.findMany({
        where: { recurringGroupId },
        orderBy: { date: 'asc' },
      });

      return res.status(200).json({ 
        message: `Created ${purchases.count} recurring purchases`,
        purchases: createdPurchases 
      });
    }

    // If updating recurring end date, delete all and recreate
    if (isUpdatingRecurringEndDate && endDateChanged) {
      // Get all purchases in the recurring group
      const allGroupPurchases = await prisma.purchase.findMany({
        where: { 
          recurringGroupId: existingPurchase.recurringGroupId,
          userId: req.user.id
        },
        orderBy: { date: 'asc' }
      });

      if (allGroupPurchases.length === 0) {
        return res.status(404).json({ message: 'Recurring purchase group not found' });
      }

      // Get the first purchase to preserve receipt files and other data
      const firstPurchase = allGroupPurchases[0];

      // Get values to use (from update or existing purchase)
      const purchaseDate = date !== undefined ? new Date(date) : firstPurchase.date;
      const purchaseDescription = description !== undefined ? description : firstPurchase.description;
      const purchaseAmount = amount !== undefined ? parseFloat(amount) : firstPurchase.amount;
      const purchaseCategory = finalCategory !== undefined ? finalCategory : (firstPurchase.category || 'Unassigned');
      const purchaseVendor = vendor !== undefined ? (vendor || null) : firstPurchase.vendor;
      const purchasePaymentMethod = paymentMethod !== undefined ? (paymentMethod || null) : firstPurchase.paymentMethod;
      const purchaseNotes = notes !== undefined ? (notes || null) : firstPurchase.notes;
      const purchaseFrequency = recurringFrequency !== undefined ? recurringFrequency : firstPurchase.recurringFrequency;

      if (!purchaseFrequency) {
        return res.status(400).json({
          message: 'Recurring frequency is required'
        });
      }

      const startDate = purchaseDate;
      const endDate = new Date(recurringEndDate);
      endDate.setHours(23, 59, 59, 999);

      const dates = calculateRecurringDates(startDate, purchaseFrequency, endDate);

      // Preserve receipt files from first purchase if no new file was uploaded
      let receiptFilesToUse = null;
      if (!req.file && firstPurchase.receiptFiles) {
        receiptFilesToUse = firstPurchase.receiptFiles;
      } else if (receiptFilesMetadata.length > 0) {
        receiptFilesToUse = JSON.stringify(receiptFilesMetadata);
      }

      const purchasesData = dates.map((purchaseDateItem, index) => ({
        userId: req.user.id,
        date: purchaseDateItem,
        description: purchaseDescription,
        amount: purchaseAmount,
        category: purchaseCategory,
        vendor: purchaseVendor,
        paymentMethod: purchasePaymentMethod,
        notes: purchaseNotes,
        receiptFiles: index === 0 ? receiptFilesToUse : null, // Only attach receipt to first purchase
        isRecurring: true,
        recurringFrequency: purchaseFrequency,
        recurringEndDate: endDate,
        recurringGroupId: existingPurchase.recurringGroupId, // Keep same group ID
      }));

      // Delete all purchases in the group
      await prisma.purchase.deleteMany({
        where: { 
          recurringGroupId: existingPurchase.recurringGroupId,
          userId: req.user.id
        }
      });

      // Create new purchases with updated end date
      const purchases = await prisma.purchase.createMany({
        data: purchasesData,
      });

      // Update frequent vendors if vendor is provided (non-blocking)
      if (vendor !== undefined && vendor && vendor.trim()) {
        updateFrequentVendors(req.user.id, vendor.trim()).catch(err => {
          console.error('Error updating frequent vendors (non-critical):', err);
        });
      }

      // Fetch the created purchases to return
      const createdPurchases = await prisma.purchase.findMany({
        where: { recurringGroupId: existingPurchase.recurringGroupId },
        orderBy: { date: 'asc' },
      });

      return res.status(200).json({ 
        message: `Updated recurring purchases: ${purchases.count} purchases created`,
        purchases: createdPurchases 
      });
    }

    // Regular update (not changing to recurring or end date)
    const updateData = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (finalCategory !== undefined) updateData.category = finalCategory;
    if (vendor !== undefined) updateData.vendor = vendor || null;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (isRecurringBool !== undefined) updateData.isRecurring = isRecurringBool;
    if (recurringFrequency !== undefined) updateData.recurringFrequency = recurringFrequency || null;
    if (recurringEndDate !== undefined) updateData.recurringEndDate = recurringEndDate ? new Date(recurringEndDate) : null;
    if (req.file) updateData.receiptFiles = JSON.stringify(receiptFilesMetadata);

    const purchase = await prisma.purchase.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Update frequent vendors if vendor is provided (non-blocking)
    if (vendor !== undefined && vendor && vendor.trim()) {
      updateFrequentVendors(req.user.id, vendor.trim()).catch(err => {
        console.error('Error updating frequent vendors (non-critical):', err);
      });
    }

    return res.status(200).json(purchase);
  } catch (error) {
    console.error('Update purchase error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error updating purchase',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete receipt file from purchase
router.delete('/:id/receipts', authenticateToken, async (req, res) => {
  try {
    const { fileIndex } = req.query;
    
    if (fileIndex === undefined) {
      return res.status(400).json({ message: 'File index is required' });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (!purchase.receiptFiles) {
      return res.status(404).json({ message: 'No receipt files found' });
    }

    const receiptFiles = JSON.parse(purchase.receiptFiles);
    const fileIndexNum = parseInt(fileIndex, 10);

    if (isNaN(fileIndexNum) || fileIndexNum < 0 || fileIndexNum >= receiptFiles.length) {
      return res.status(400).json({ message: 'Invalid file index' });
    }

    const fileToDelete = receiptFiles[fileIndexNum];

    // Delete the file from storage
    if (fileToDelete.storageType === 'googleDrive' && fileToDelete.fileId) {
      try {
        const { deleteFileFromDrive } = await import('../utils/googleDrive.js');
        await deleteFileFromDrive(req.user.id, fileToDelete.fileId);
        console.log(`Deleted Google Drive receipt: ${fileToDelete.fileName}`);
      } catch (error) {
        console.error('Error deleting Google Drive file:', error);
        // Continue to remove from metadata even if deletion fails
      }
    }

    // Remove the file from the metadata array
    const updatedFiles = receiptFiles.filter((_, index) => index !== fileIndexNum);

    // Update the purchase
    const updateData = {
      receiptFiles: updatedFiles.length > 0 ? JSON.stringify(updatedFiles) : null
    };

    await prisma.purchase.update({
      where: { id: req.params.id },
      data: updateData
    });

    // Fetch updated purchase
    const updatedPurchase = await prisma.purchase.findUnique({
      where: { id: req.params.id }
    });

    res.json(updatedPurchase);
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json({ message: 'Error deleting receipt' });
  }
});

// Delete purchase
router.delete('/:id', async (req, res) => {
  try {
    const { deleteFuture } = req.query; // Query param: ?deleteFuture=true

    // Verify purchase belongs to user
    const purchase = await prisma.purchase.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // If deleteFuture is true and purchase is part of a recurring group, delete this and all future purchases
    if (deleteFuture === 'true' && purchase.recurringGroupId) {
      // Find all purchases in the same group with date >= current purchase date (to be deleted)
      const futurePurchases = await prisma.purchase.findMany({
        where: {
          recurringGroupId: purchase.recurringGroupId,
          userId: req.user.id,
          date: {
            gte: purchase.date,
          },
        },
      });

      // Find remaining purchases in the series (those before the current purchase date)
      const remainingPurchases = await prisma.purchase.findMany({
        where: {
          recurringGroupId: purchase.recurringGroupId,
          userId: req.user.id,
          date: {
            lt: purchase.date,
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      // If there are remaining purchases, update their recurringEndDate to the last remaining purchase date
      if (remainingPurchases.length > 0) {
        const lastRemainingDate = remainingPurchases[0].date;
        const newEndDate = new Date(lastRemainingDate);
        newEndDate.setHours(23, 59, 59, 999);

        await prisma.purchase.updateMany({
          where: {
            recurringGroupId: purchase.recurringGroupId,
            userId: req.user.id,
            date: {
              lt: purchase.date,
            },
          },
          data: {
            recurringEndDate: newEndDate,
          },
        });
      }

      // Delete all future purchases (including the current one)
      await prisma.purchase.deleteMany({
        where: {
          id: {
            in: futurePurchases.map(p => p.id),
          },
        },
      });

      return res.json({ 
        message: `Deleted ${futurePurchases.length} purchase(s) (this and future)`,
        deletedCount: futurePurchases.length
      });
    } else {
      // Delete only this purchase
      await prisma.purchase.delete({
        where: { id: req.params.id },
      });

      return res.json({ message: 'Purchase deleted successfully' });
    }
  } catch (error) {
    console.error('Delete purchase error:', error);
    res.status(500).json({ message: 'Error deleting purchase' });
  }
});

export default router;

