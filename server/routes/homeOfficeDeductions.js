import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

// Category options
const CATEGORIES = [
  { value: 'mortgage_interest', label: 'Mortgage Interest' },
  { value: 'property_taxes', label: 'Property Taxes' },
  { value: 'utilities_electric', label: 'Utilities - Electric' },
  { value: 'utilities_gas', label: 'Utilities - Gas' },
  { value: 'utilities_water', label: 'Utilities - Water' },
  { value: 'home_insurance', label: 'Home Insurance' },
  { value: 'maintenance_repairs', label: 'Maintenance & Repairs' },
  { value: 'depreciation', label: 'Depreciation' }
];

// Get all home office deductions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { year, category } = req.query;
    const where = { userId: req.user.id };
    
    if (year) {
      const yearInt = parseInt(year);
      where.period = {
        gte: new Date(yearInt, 0, 1),
        lt: new Date(yearInt + 1, 0, 1)
      };
    }
    
    if (category) {
      where.category = category;
    }
    
    const deductions = await prisma.homeOfficeDeduction.findMany({
      where,
      orderBy: [
        { period: 'desc' },
        { category: 'asc' }
      ]
    });
    
    res.json(deductions);
  } catch (error) {
    console.error('Get home office deductions error:', error);
    res.status(500).json({ message: 'Error fetching home office deductions' });
  }
});

// Get categories
router.get('/categories', authenticateToken, (req, res) => {
  res.json(CATEGORIES);
});

// Get summary by year
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ message: 'Year is required' });
    }
    
    const yearInt = parseInt(year);
    const deductions = await prisma.homeOfficeDeduction.findMany({
      where: {
        userId: req.user.id,
        period: {
          gte: new Date(yearInt, 0, 1),
          lt: new Date(yearInt + 1, 0, 1)
        }
      }
    });
    
    // Group by category and calculate totals
    const summary = {};
    let totalDeductible = 0;
    
    deductions.forEach(deduction => {
      if (!summary[deduction.category]) {
        const categoryInfo = CATEGORIES.find(c => c.value === deduction.category);
        summary[deduction.category] = {
          category: deduction.category,
          label: categoryInfo ? categoryInfo.label : deduction.category,
          totalAmount: 0,
          totalDeductible: 0
        };
      }
      
      summary[deduction.category].totalAmount += deduction.amount;
      summary[deduction.category].totalDeductible += deduction.deductibleAmount;
      totalDeductible += deduction.deductibleAmount;
    });
    
    res.json({
      year: yearInt,
      byCategory: Object.values(summary),
      totalDeductible
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ message: 'Error fetching summary' });
  }
});

// Create home office deduction
router.post('/', authenticateToken, [
  body('category').isIn(CATEGORIES.map(c => c.value)).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('periodType').isIn(['monthly', 'yearly']).withMessage('Period type must be monthly or yearly'),
  body('period').isISO8601().withMessage('Valid period date is required'),
  body('deductionPercent').isFloat({ min: 0, max: 100 }).withMessage('Deduction percentage must be between 0 and 100'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { category, amount, periodType, period, deductionPercent, notes } = req.body;
    
    // Normalize period date
    const periodDate = new Date(period);
    let normalizedPeriod;
    if (periodType === 'monthly') {
      normalizedPeriod = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
    } else {
      normalizedPeriod = new Date(periodDate.getFullYear(), 0, 1);
    }
    
    // Calculate deductible amount
    const deductibleAmount = amount * (deductionPercent / 100);
    
    const deduction = await prisma.homeOfficeDeduction.create({
      data: {
        userId: req.user.id,
        category,
        amount: parseFloat(amount),
        periodType,
        period: normalizedPeriod,
        deductionPercent: parseFloat(deductionPercent),
        deductibleAmount,
        notes: notes || null
      }
    });
    
    res.status(201).json(deduction);
  } catch (error) {
    console.error('Create home office deduction error:', error);
    res.status(500).json({ message: 'Error creating home office deduction' });
  }
});

// Update home office deduction
router.put('/:id', authenticateToken, [
  body('category').optional().isIn(CATEGORIES.map(c => c.value)).withMessage('Invalid category'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('periodType').optional().isIn(['monthly', 'yearly']).withMessage('Period type must be monthly or yearly'),
  body('period').optional().isISO8601().withMessage('Valid period date is required'),
  body('deductionPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('Deduction percentage must be between 0 and 100'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Verify deduction belongs to user
    const existing = await prisma.homeOfficeDeduction.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    
    if (!existing) {
      return res.status(404).json({ message: 'Home office deduction not found' });
    }
    
    const { category, amount, periodType, period, deductionPercent, notes } = req.body;
    
    const updateData = {};
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (periodType !== undefined) updateData.periodType = periodType;
    if (deductionPercent !== undefined) updateData.deductionPercent = parseFloat(deductionPercent);
    if (notes !== undefined) updateData.notes = notes || null;
    
    // Handle period normalization
    if (period !== undefined) {
      const periodDate = new Date(period);
      const finalPeriodType = periodType !== undefined ? periodType : existing.periodType;
      if (finalPeriodType === 'monthly') {
        updateData.period = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
      } else {
        updateData.period = new Date(periodDate.getFullYear(), 0, 1);
      }
    }
    
    // Recalculate deductible amount if amount or deductionPercent changed
    const finalAmount = amount !== undefined ? parseFloat(amount) : existing.amount;
    const finalDeductionPercent = deductionPercent !== undefined ? parseFloat(deductionPercent) : existing.deductionPercent;
    updateData.deductibleAmount = finalAmount * (finalDeductionPercent / 100);
    
    const deduction = await prisma.homeOfficeDeduction.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    res.json(deduction);
  } catch (error) {
    console.error('Update home office deduction error:', error);
    res.status(500).json({ message: 'Error updating home office deduction' });
  }
});

// Delete home office deduction
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Verify deduction belongs to user
    const existing = await prisma.homeOfficeDeduction.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    
    if (!existing) {
      return res.status(404).json({ message: 'Home office deduction not found' });
    }
    
    await prisma.homeOfficeDeduction.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Home office deduction deleted successfully' });
  } catch (error) {
    console.error('Delete home office deduction error:', error);
    res.status(500).json({ message: 'Error deleting home office deduction' });
  }
});

export default router;

