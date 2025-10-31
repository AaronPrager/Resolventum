import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

router.use(authenticateToken);

// Get all packages
router.get('/', async (req, res) => {
  try {
    const packages = await prisma.package.findMany({
      where: { userId: req.user.id },
      include: {
        student: true
      },
      orderBy: { purchasedAt: 'desc' }
    });

    res.json(packages);
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

// Get packages for a student
router.get('/student/:studentId', async (req, res) => {
  try {
    // Verify student belongs to user
    const student = await prisma.student.findFirst({
      where: { id: req.params.studentId, userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const packages = await prisma.package.findMany({
      where: { 
        studentId: req.params.studentId,
        userId: req.user.id
      },
      orderBy: { purchasedAt: 'desc' }
    });

    res.json(packages);
  } catch (error) {
    console.error('Get student packages error:', error);
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

// Create package
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('Student ID required'),
    body('name').notEmpty().withMessage('Package name required'),
    body('totalLessons').isInt({ min: 1 }).withMessage('Valid lesson count required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required')
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

      const pkg = await prisma.package.create({
        data: {
          ...req.body,
          userId: req.user.id
        },
        include: {
          student: true
        }
      });

      res.status(201).json(pkg);
    } catch (error) {
      console.error('Create package error:', error);
      res.status(500).json({ message: 'Error creating package' });
    }
  }
);

// Update package
router.put('/:id', async (req, res) => {
  try {
    // Verify package belongs to user
    const existing = await prisma.package.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Package not found' });
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

    const pkg = await prisma.package.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        student: true
      }
    });

    res.json(pkg);
  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({ message: 'Error updating package' });
  }
});

// Mark package as completed (use up remaining lessons)
router.post('/:id/complete', async (req, res) => {
  try {
    // Verify package belongs to user
    const existing = await prisma.package.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Package not found' });
    }

    const pkg = await prisma.package.update({
      where: { id: req.params.id },
      data: {
        lessonsUsed: { increment: req.body.lessonsUsed || 1 }
      }
    });

    res.json(pkg);
  } catch (error) {
    console.error('Complete package error:', error);
    res.status(500).json({ message: 'Error updating package' });
  }
});

export default router;

