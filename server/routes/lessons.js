import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all lessons
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, studentId } = req.query;

    const where = {};
    if (studentId) where.studentId = studentId;
    if (startDate && endDate) {
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        student: true
      },
      orderBy: { dateTime: 'desc' }
    });

    res.json(lessons);
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ message: 'Error fetching lessons' });
  }
});

// Get single lesson
router.get('/:id', async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        student: true
      }
    });

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    res.json(lesson);
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ message: 'Error fetching lesson' });
  }
});

// Create lesson
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('Student ID required'),
    body('dateTime').isISO8601().withMessage('Valid date/time required'),
    body('duration').isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes'),
    body('subject').notEmpty().withMessage('Subject required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const lesson = await prisma.lesson.create({
        data: req.body,
        include: {
          student: true
        }
      });

      res.status(201).json(lesson);
    } catch (error) {
      console.error('Create lesson error:', error);
      res.status(500).json({ message: 'Error creating lesson' });
    }
  }
);

// Update lesson
router.put('/:id', async (req, res) => {
  try {
    const lesson = await prisma.lesson.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        student: true
      }
    });

    res.json(lesson);
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ message: 'Error updating lesson' });
  }
});

// Delete lesson
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lesson.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ message: 'Error deleting lesson' });
  }
});

// Get upcoming lessons (for reminders)
router.get('/upcoming/tomorrow', async (req, res) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setHours(23, 59, 59, 999);

    const lessons = await prisma.lesson.findMany({
      where: {
        dateTime: {
          gte: tomorrow,
          lte: dayAfter
        },
        status: 'scheduled'
      },
      include: {
        student: true
      }
    });

    res.json(lessons);
  } catch (error) {
    console.error('Get upcoming lessons error:', error);
    res.status(500).json({ message: 'Error fetching upcoming lessons' });
  }
});

export default router;

