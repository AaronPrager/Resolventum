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
      where: { userId: req.user.id },
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
    const student = await prisma.student.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      },
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
    body('dateOfBirth').optional({ checkFalsy: true }).isISO8601(),
    body('phone').optional({ checkFalsy: true }),
    body('address').optional({ checkFalsy: true }),
    body('schoolName').optional({ checkFalsy: true }),
    body('subject').optional({ checkFalsy: true }),
    body('parentFullName').optional({ checkFalsy: true }),
    body('parentPhone').optional({ checkFalsy: true }),
    body('parentEmail').optional({ checkFalsy: true }).isEmail(),
    body('email').optional({ checkFalsy: true }).isEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Only include fields that exist in the database schema
      const studentData = {
        userId: req.user.id,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: req.body.dateOfBirth,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        schoolName: req.body.schoolName,
        grade: req.body.grade,
        subject: req.body.subject,
        difficulties: req.body.difficulties,
        pricePerLesson: req.body.pricePerLesson,
        pricePerPackage: req.body.pricePerPackage,
        parentFullName: req.body.parentFullName,
        parentAddress: req.body.parentAddress,
        parentPhone: req.body.parentPhone,
        parentEmail: req.body.parentEmail,
        emergencyContactInfo: req.body.emergencyContactInfo,
        notes: req.body.notes
      };

      const student = await prisma.student.create({
        data: studentData
      });

      res.status(201).json(student);
    } catch (error) {
      console.error('Create student error:', error);
      console.error('Error details:', error.message);
      res.status(500).json({ message: 'Error creating student', error: error.message });
    }
  }
);

// Update student
router.put('/:id', async (req, res) => {
  try {
    // Verify student belongs to user
    const existing = await prisma.student.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Only include fields that exist in the database schema
    const studentData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      dateOfBirth: req.body.dateOfBirth,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      schoolName: req.body.schoolName,
      grade: req.body.grade,
      subject: req.body.subject,
      difficulties: req.body.difficulties,
      pricePerLesson: req.body.pricePerLesson,
      pricePerPackage: req.body.pricePerPackage,
      parentFullName: req.body.parentFullName,
      parentAddress: req.body.parentAddress,
      parentPhone: req.body.parentPhone,
      parentEmail: req.body.parentEmail,
      emergencyContactInfo: req.body.emergencyContactInfo,
      notes: req.body.notes
    };

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: studentData
    });

    res.json(student);
  } catch (error) {
    console.error('Update student error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ message: 'Error updating student', error: error.message });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    // Verify student belongs to user
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

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

