import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all students
// Query params: includeArchived=true to include archived students
router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    
    const whereClause = {
      userId: req.user.id,
      ...(includeArchived ? {} : { archived: false }) // Default to non-archived only
    };

    const students = await prisma.student.findMany({
      where: whereClause,
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

// Get all families (groups of students with the same familyId)
router.get('/families', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: {
        userId: req.user.id,
        familyId: { not: null },
        archived: false
      },
      select: {
        familyId: true,
        id: true,
        firstName: true,
        lastName: true
      }
    });

    // Group by familyId
    const familiesMap = new Map();
    students.forEach(student => {
      if (!familiesMap.has(student.familyId)) {
        familiesMap.set(student.familyId, []);
      }
      familiesMap.get(student.familyId).push({
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName
      });
    });

    // Convert to array format
    const families = Array.from(familiesMap.entries()).map(([familyId, members]) => ({
      familyId,
      members
    }));

    res.json(families);
  } catch (error) {
    console.error('Get families error:', error);
    res.status(500).json({ message: 'Error fetching families' });
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
        usePackages: req.body.usePackages !== undefined ? Boolean(req.body.usePackages) : false,
        parentFullName: req.body.parentFullName,
        parentAddress: req.body.parentAddress,
        parentPhone: req.body.parentPhone,
        parentEmail: req.body.parentEmail,
        emergencyContactInfo: req.body.emergencyContactInfo,
        notes: req.body.notes,
        familyId: req.body.familyId || null // Allow setting familyId
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
      usePackages: req.body.usePackages !== undefined ? Boolean(req.body.usePackages) : existing.usePackages,
      parentFullName: req.body.parentFullName,
      parentAddress: req.body.parentAddress,
      parentPhone: req.body.parentPhone,
      parentEmail: req.body.parentEmail,
      emergencyContactInfo: req.body.emergencyContactInfo,
      notes: req.body.notes,
      familyId: req.body.familyId !== undefined ? req.body.familyId : existing.familyId // Allow updating familyId
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

// Recalculate all lesson prices for a student based on current packages
router.post('/:id/recalculate-prices', async (req, res) => {
  try {
    // Verify student belongs to user
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get all lessons for this student (not cancelled, ordered by date)
    const lessons = await prisma.lesson.findMany({
      where: {
        studentId: req.params.id,
        userId: req.user.id,
        NOT: { status: { in: ['cancelled', 'canceled'] } }
      },
      orderBy: { dateTime: 'asc' }
    });

    // Get all active packages for this student (ordered by purchase date)
    const packages = await prisma.package.findMany({
      where: {
        userId: req.user.id,
        studentId: req.params.id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      orderBy: { purchasedAt: 'asc' }
    });

    const studentHourlyRate = student.pricePerLesson || 0;
    let updatedCount = 0;

    // We need to recalculate based on chronological application of packages
    // Start with packages at their current database state, but recalculate as if we're applying them fresh
    // The key is: lessons created AFTER package purchase should use package rate if package has hours
    
    // Track package hours as we go through lessons chronologically
    const packageState = packages.map(pkg => ({
      id: pkg.id,
      price: pkg.price,
      totalHours: pkg.totalHours,
      hoursUsedSoFar: 0 // Track cumulative usage as we process lessons in order
    }));

    // Recalculate each lesson price based on package availability at that point in time
    // Process lessons in chronological order
    for (const lesson of lessons) {
      const lessonHours = lesson.duration / 60; // Convert minutes to hours
      let newPrice = 0;
      let remainingHours = lessonHours;

      // Check which packages were available when this lesson was scheduled
      // A package is available if:
      // 1. It was purchased before or on the lesson date
      // 2. It is currently active (for recalculation, we consider all active packages regardless of purchase date)
      //    since we're recalculating what the prices SHOULD be based on current package state
      const availablePackages = packageState.map((pkgState, idx) => {
        const pkg = packages[idx];
        return {
          ...pkgState,
          purchasedAt: new Date(pkg.purchasedAt),
          originalIndex: idx
        };
      }).filter((pkgStateWithDate, idx) => {
        // For recalculation, consider all active packages
        // Lessons created before package purchase will use student rate
        // Lessons created after package purchase should use package rate if hours available
        return pkgStateWithDate.purchasedAt <= new Date(lesson.dateTime);
      });

      // Try to use available packages in order to cover the lesson
      for (let i = 0; i < availablePackages.length && remainingHours > 0; i++) {
        const pkgStateWithDate = availablePackages[i];
        const availableHours = pkgStateWithDate.totalHours - pkgStateWithDate.hoursUsedSoFar;

        if (availableHours <= 0) continue;

        const packageHourlyRate = pkgStateWithDate.price / pkgStateWithDate.totalHours;
        const hoursFromThisPackage = Math.min(remainingHours, availableHours);
        newPrice += packageHourlyRate * hoursFromThisPackage;
        remainingHours -= hoursFromThisPackage;
        
        // Update tracked usage for the original package state
        packageState[pkgStateWithDate.originalIndex].hoursUsedSoFar += hoursFromThisPackage;
      }

      // If any hours remain uncovered, use student rate
      if (remainingHours > 0) {
        newPrice += studentHourlyRate * remainingHours;
      }

      // Update lesson price if it changed (rounded to 2 decimals)
      const roundedNewPrice = Math.round(newPrice * 100) / 100;
      const roundedOldPrice = Math.round((lesson.price || 0) * 100) / 100;

      if (roundedNewPrice !== roundedOldPrice) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { price: roundedNewPrice }
        });
        updatedCount++;
        console.log(`Updated lesson ${lesson.id} (${lesson.dateTime.toISOString().split('T')[0]}) from $${roundedOldPrice} to $${roundedNewPrice}`);
      }
    }

    res.json({
      message: `Recalculated prices for ${lessons.length} lessons (${updatedCount} updated)`,
      totalLessons: lessons.length,
      updatedCount,
      studentName: `${student.firstName} ${student.lastName}`
    });
  } catch (error) {
    console.error('Recalculate prices error:', error);
    res.status(500).json({ message: 'Error recalculating lesson prices' });
  }
});

// Delete all lessons for a student
router.delete('/:id/lessons', async (req, res) => {
  try {
    // Verify student belongs to user
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Count lessons before deletion
    const count = await prisma.lesson.count({
      where: {
        studentId: req.params.id,
        userId: req.user.id
      }
    });

    // Delete all lessons for this student
    await prisma.lesson.deleteMany({
      where: {
        studentId: req.params.id,
        userId: req.user.id
      }
    });

    res.json({
      message: `Deleted ${count} lessons for ${student.firstName} ${student.lastName}`,
      deletedCount: count
    });
  } catch (error) {
    console.error('Delete student lessons error:', error);
    res.status(500).json({ message: 'Error deleting student lessons' });
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

// Archive/Unarchive student
router.patch('/:id/archive', async (req, res) => {
  try {
    const { archived } = req.body; // true to archive, false to unarchive
    
    const student = await prisma.student.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const updatedStudent = await prisma.student.update({
      where: { id: req.params.id },
      data: { archived: archived === true }
    });

    res.json({
      message: archived ? 'Student archived successfully' : 'Student unarchived successfully',
      student: updatedStudent
    });
  } catch (error) {
    console.error('Archive student error:', error);
    res.status(500).json({ message: 'Error archiving student' });
  }
});

// Update student credit
router.patch('/:id/credit', async (req, res) => {
  try {
    const { credit, action } = req.body; // credit: amount, action: 'set' | 'add' | 'subtract'
    
    // Validate credit amount
    if (credit === undefined || credit === null) {
      return res.status(400).json({ message: 'Credit amount is required' });
    }
    
    const creditAmount = parseFloat(credit);
    if (isNaN(creditAmount)) {
      return res.status(400).json({ message: 'Credit must be a valid number' });
    }
    
    // Verify student belongs to user
    const student = await prisma.student.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const currentCredit = student.credit || 0;
    let newCredit;
    
    // Determine new credit value based on action
    switch (action) {
      case 'add':
        newCredit = currentCredit + creditAmount;
        break;
      case 'subtract':
        newCredit = currentCredit - creditAmount;
        break;
      case 'set':
      default:
        newCredit = creditAmount;
        break;
    }

    const updatedStudent = await prisma.student.update({
      where: { id: req.params.id },
      data: { credit: newCredit }
    });

    console.log(`[Credit Update] Student ${student.firstName} ${student.lastName}: ${action || 'set'} credit from $${currentCredit.toFixed(2)} to $${newCredit.toFixed(2)}`);

    res.json({
      message: `Credit ${action || 'set'} successfully`,
      previousCredit: currentCredit,
      newCredit: newCredit,
      student: updatedStudent
    });
  } catch (error) {
    console.error('Update credit error:', error);
    res.status(500).json({ message: 'Error updating credit' });
  }
});

export default router;

