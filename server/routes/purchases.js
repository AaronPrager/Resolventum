import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

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
router.post('/', [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('category').optional().trim(),
  body('vendor').optional().trim(),
  body('paymentMethod').optional({ values: 'falsy' }).custom((value) => {
    if (!value || value === '') return true;
    return ['venmo', 'zelle', 'credit_card', 'cash'].includes(value);
  }).withMessage('Invalid payment method'),
  body('notes').optional().trim(),
  body('isRecurring').optional().isBoolean(),
  body('recurringFrequency').optional({ values: 'falsy' }).custom((value) => {
    if (!value || value === '') return true;
    return ['daily', 'weekly', 'monthly', 'yearly'].includes(value);
  }).withMessage('Invalid recurring frequency'),
  body('recurringEndDate').optional({ values: 'falsy' }).custom((value, { req }) => {
    // Only validate if isRecurring is true
    if (req.body.isRecurring === true) {
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

    // Validate recurring purchase requirements
    if (isRecurring && (!recurringFrequency || !recurringEndDate)) {
      return res.status(400).json({ 
        message: 'Recurring purchases require both frequency and end date' 
      });
    }

    // Assign "Unassigned" category if not provided
    const finalCategory = category && category.trim() ? category.trim() : 'Unassigned';

    // If recurring, create multiple purchases
    if (isRecurring && recurringFrequency && recurringEndDate) {
      const recurringGroupId = uuidv4();
      const startDate = new Date(date);
      const endDate = new Date(recurringEndDate);
      endDate.setHours(23, 59, 59, 999);

      const dates = calculateRecurringDates(startDate, recurringFrequency, endDate);

      const purchasesData = dates.map(purchaseDate => ({
        userId: req.user.id,
        date: purchaseDate,
        description,
        amount: parseFloat(amount),
        category: finalCategory,
        vendor: vendor || null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        isRecurring: true,
        recurringFrequency,
        recurringEndDate: endDate,
        recurringGroupId,
      }));

      const purchases = await prisma.purchase.createMany({
        data: purchasesData,
      });

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
          isRecurring: isRecurring || false,
          recurringFrequency: recurringFrequency || null,
          recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
          recurringGroupId: null,
        },
      });

      return res.status(201).json(purchase);
    }
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({ message: 'Error creating purchase' });
  }
});

// Update purchase
router.put('/:id', [
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('category').optional().trim(),
  body('vendor').optional().trim(),
  body('receiptUrl').optional().trim(),
  body('paymentMethod').optional({ values: 'falsy' }).custom((value) => {
    if (!value || value === '') return true;
    return ['venmo', 'zelle', 'credit_card', 'cash'].includes(value);
  }).withMessage('Invalid payment method'),
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

    const { date, description, amount, category, vendor, paymentMethod, notes, isRecurring, recurringFrequency } = req.body;

    // Assign "Unassigned" category if not provided or empty
    const finalCategory = category !== undefined 
      ? (category && category.trim() ? category.trim() : 'Unassigned')
      : undefined;

    const updateData = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (finalCategory !== undefined) updateData.category = finalCategory;
    if (vendor !== undefined) updateData.vendor = vendor || null;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringFrequency !== undefined) updateData.recurringFrequency = recurringFrequency || null;

    const purchase = await prisma.purchase.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(purchase);
  } catch (error) {
    console.error('Update purchase error:', error);
    res.status(500).json({ message: 'Error updating purchase' });
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

