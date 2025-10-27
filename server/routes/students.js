import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all students
router.get('/', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        lessons: {
          orderBy: { dateTime: 'desc' },
          take: 1
        },
        packages: {
          where: { isActive: true }
        },
        _count: {
          select: {
            lessons: true,
            payments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Error fetching students' });
  }
});

// Get single student
router.get('/:id', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        lessons: {
          orderBy: { dateTime: 'desc' }
        },
        packages: {
          orderBy: { purchasedAt: 'desc' }
        },
        payments: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ message: 'Error fetching student' });
  }
});

// Create student
router.post(
  '/',
  [
    body('firstName').notEmpty().withMessage('First name required'),
    body('lastName').notEmpty().withMessage('Last name required'),
    body('phone').optional().isMobilePhone(),
    body('email').optional().isEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const student = await prisma.student.create({
        data: req.body
      });

      res.status(201).json(student);
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ message: 'Error creating student' });
    }
  }
);

// Update student
router.put('/:id', async (req, res) => {
  try {
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(student);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Error updating student' });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    await prisma.student.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Error deleting student' });
  }
});

export default router;

