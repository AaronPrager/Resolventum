import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

router.use(authenticateToken);

// Get all payments
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, studentId } = req.query;

    const where = { userId: req.user.id };
    if (studentId) {
      // Verify student belongs to user
      const student = await prisma.student.findFirst({
        where: { id: studentId, userId: req.user.id }
      });
      if (student) {
        where.studentId = studentId;
      }
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        student: true
      },
      orderBy: { date: 'desc' }
    });

    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ message: 'Error fetching payments' });
  }
});

// Create payment
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('Student ID required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
    body('method').notEmpty().withMessage('Payment method required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify student belongs to user
      const student = await prisma.student.findFirst({
        where: { id: req.body.studentId, userId: req.user.id }
      });

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      const payment = await prisma.payment.create({
        data: {
          ...req.body,
          userId: req.user.id
        },
        include: {
          student: true
        }
      });

      res.status(201).json(payment);
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ message: 'Error creating payment' });
    }
  }
);

// Update payment
router.put('/:id', async (req, res) => {
  try {
    // Verify payment belongs to user
    const existing = await prisma.payment.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // If studentId is being changed, verify new student belongs to user
    if (req.body.studentId && req.body.studentId !== existing.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: req.body.studentId, userId: req.user.id }
      });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
    }

    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        student: true
      }
    });

    res.json(payment);
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ message: 'Error updating payment' });
  }
});

// Delete payment
router.delete('/:id', async (req, res) => {
  try {
    // Verify payment belongs to user
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    await prisma.payment.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ message: 'Error deleting payment' });
  }
});

export default router;

