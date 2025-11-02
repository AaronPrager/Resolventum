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
    body('totalHours').isFloat({ min: 0.01 }).withMessage('Valid hours required'),
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
          userId: req.user.id,
          isActive: req.body.isActive !== undefined ? req.body.isActive : true // Default to active
        },
        include: {
          student: true
        }
      });

      // After creating the package, apply it to past unpaid lessons
      // Find all past lessons for this student that are not cancelled
      const now = new Date();
      const pastLessons = await prisma.lesson.findMany({
        where: {
          userId: req.user.id,
          studentId: req.body.studentId,
          dateTime: { lt: now }, // Lessons in the past
          NOT: { status: { in: ['cancelled', 'canceled'] } } // Not cancelled
        },
        orderBy: { dateTime: 'asc' } // Process oldest first
      });

      // Calculate package hourly rate
      const packageHourlyRate = pkg.price / pkg.totalHours;
      const studentHourlyRate = student.pricePerLesson || 0;
      let remainingPackageHours = pkg.totalHours - pkg.hoursUsed;
      let hoursDeducted = 0;

      // Process each past lesson and deduct from package if there are remaining hours
      for (const lesson of pastLessons) {
        if (remainingPackageHours <= 0) break;

        const lessonHours = lesson.duration / 60; // Convert minutes to hours
        const hoursToDeduct = Math.min(lessonHours, remainingPackageHours);
        
        if (hoursToDeduct > 0) {
          // Update lesson price to use package rate for the portion covered by package
          const coveredPrice = (packageHourlyRate * (hoursToDeduct * 60)) / 60;
          const remainingHoursInLesson = lessonHours - hoursToDeduct;
          const remainingPrice = studentHourlyRate > 0 
            ? (studentHourlyRate * (remainingHoursInLesson * 60)) / 60 
            : Math.max(0, lesson.price - coveredPrice);
          const newPrice = coveredPrice + remainingPrice;

          // Update lesson with package-based price
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { price: newPrice }
          });

          hoursDeducted += hoursToDeduct;
          remainingPackageHours -= hoursToDeduct;
        }
      }

      // Update package with the hours used
      if (hoursDeducted > 0) {
        await prisma.package.update({
          where: { id: pkg.id },
          data: { hoursUsed: { increment: hoursDeducted } }
        });
        console.log(`Applied ${hoursDeducted.toFixed(2)} hours from new package to ${pastLessons.length} past lessons`);
      }

      // Return updated package
      const updatedPkg = await prisma.package.findUnique({
        where: { id: pkg.id },
        include: {
          student: true
        }
      });

      res.status(201).json({
        ...updatedPkg,
        appliedToPastLessons: hoursDeducted > 0,
        hoursApplied: hoursDeducted,
        pastLessonsCount: pastLessons.length
      });
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

// Mark package as completed (use up remaining hours)
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
        hoursUsed: { increment: req.body.hoursUsed || 0 }
      }
    });

    res.json(pkg);
  } catch (error) {
    console.error('Complete package error:', error);
    res.status(500).json({ message: 'Error updating package' });
  }
});

// Get package usage report
router.get('/:id/usage', async (req, res) => {
  try {
    const userId = req.user.id;
    const packageId = req.params.id;

    // Verify package belongs to user
    const pkg = await prisma.package.findFirst({
      where: { id: packageId, userId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            pricePerLesson: true
          }
        }
      }
    });

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Calculate package hourly rate
    const packageHourlyRate = pkg.price / pkg.totalHours;
    const studentHourlyRate = pkg.student.pricePerLesson || 0;

    // Find lessons that likely used this package
    // Lessons created/updated after package purchase that have prices matching package rate
    const lessonsAfterPurchase = await prisma.lesson.findMany({
      where: {
        userId,
        studentId: pkg.studentId,
        dateTime: {
          gte: pkg.purchasedAt // Lessons on or after package purchase
        },
        NOT: { status: { in: ['cancelled', 'canceled'] } }
      },
      orderBy: { dateTime: 'asc' },
      select: {
        id: true,
        dateTime: true,
        duration: true,
        subject: true,
        price: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Calculate which lessons likely used package hours
    // A lesson likely used the package if:
    // 1. Its price matches the package rate (or close to it)
    // 2. It was created/updated after the package was purchased
    const packageUsage = [];
    let totalHoursTracked = 0;

    for (const lesson of lessonsAfterPurchase) {
      const lessonHours = lesson.duration / 60;
      const lessonPricePerHour = lesson.price / lessonHours;
      
      // Check if lesson price matches package rate (within 5% tolerance)
      const priceDifference = Math.abs(lessonPricePerHour - packageHourlyRate);
      const tolerance = packageHourlyRate * 0.05; // 5% tolerance
      
      const likelyUsedPackage = lessonPricePerHour <= packageHourlyRate + tolerance && 
                                lessonPricePerHour >= packageHourlyRate - tolerance;
      
      // Also consider if lesson was updated after package purchase (might have been retroactively applied)
      const wasUpdatedAfterPackage = lesson.updatedAt >= pkg.purchasedAt;
      
      if (likelyUsedPackage || (wasUpdatedAfterPackage && lessonPricePerHour <= packageHourlyRate + tolerance)) {
        packageUsage.push({
          lessonId: lesson.id,
          date: lesson.dateTime,
          subject: lesson.subject,
          duration: lesson.duration,
          hours: lessonHours,
          price: lesson.price,
          pricePerHour: lessonPricePerHour,
          status: lesson.status,
          likelyUsedPackage: true
        });
        totalHoursTracked += lessonHours;
      }
    }

    // Calculate statistics
    const hoursRemaining = pkg.totalHours - pkg.hoursUsed;
    const utilizationPercent = (pkg.hoursUsed / pkg.totalHours) * 100;

    res.json({
      package: {
        id: pkg.id,
        name: pkg.name,
        student: `${pkg.student.firstName} ${pkg.student.lastName}`,
        totalHours: pkg.totalHours,
        hoursUsed: pkg.hoursUsed,
        hoursRemaining,
        price: pkg.price,
        packageHourlyRate,
        studentHourlyRate,
        purchasedAt: pkg.purchasedAt,
        expiresAt: pkg.expiresAt,
        isActive: pkg.isActive,
        utilizationPercent
      },
      usage: packageUsage,
      summary: {
        totalLessonsTracked: packageUsage.length,
        totalHoursTracked,
        hoursUsedFromPackage: pkg.hoursUsed,
        hoursRemainingInPackage: hoursRemaining
      }
    });
  } catch (error) {
    console.error('Package usage report error:', error);
    res.status(500).json({ message: 'Error fetching package usage report' });
  }
});

// Clean up orphaned packages (packages without corresponding payments)
router.post('/cleanup-orphaned', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all packages for this user
    const allPackages = await prisma.package.findMany({
      where: { userId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Get all payments that are for packages
    const packagePayments = await prisma.payment.findMany({
      where: {
        userId,
        notes: {
          startsWith: 'Package: '
        }
      }
    });

    // Create a map of payment -> package for matching
    const paymentPackageMap = new Map();
    packagePayments.forEach(payment => {
      const packageName = payment.notes.replace('Package: ', '').trim();
      const key = `${payment.studentId}-${packageName}-${payment.amount}`;
      if (!paymentPackageMap.has(key)) {
        paymentPackageMap.set(key, []);
      }
      paymentPackageMap.get(key).push({
        paymentId: payment.id,
        paymentDate: payment.date,
        packageName
      });
    });

    // Find orphaned packages (packages without matching payments)
    const orphanedPackages = [];
    for (const pkg of allPackages) {
      const key = `${pkg.studentId}-${pkg.name}-${pkg.price}`;
      const matchingPayments = paymentPackageMap.get(key) || [];
      
      // Check if any payment matches (same day)
      const packageDate = new Date(pkg.purchasedAt);
      const packageDayStart = new Date(packageDate.getFullYear(), packageDate.getMonth(), packageDate.getDate());
      const packageDayEnd = new Date(packageDate.getFullYear(), packageDate.getMonth(), packageDate.getDate() + 1);
      
      const hasMatchingPayment = matchingPayments.some(mp => {
        const paymentDate = new Date(mp.paymentDate);
        return paymentDate >= packageDayStart && paymentDate < packageDayEnd;
      });

      if (!hasMatchingPayment) {
        orphanedPackages.push(pkg);
      }
    }

    // If user confirms, delete orphaned packages
    if (req.body.confirm === true && orphanedPackages.length > 0) {
      const idsToDelete = orphanedPackages.map(p => p.id);
      await prisma.package.deleteMany({
        where: {
          id: { in: idsToDelete },
          userId
        }
      });

      res.json({
        message: `Deleted ${orphanedPackages.length} orphaned packages`,
        deleted: orphanedPackages.map(p => ({
          id: p.id,
          name: p.name,
          student: `${p.student.firstName} ${p.student.lastName}`
        }))
      });
    } else {
      res.json({
        message: `Found ${orphanedPackages.length} orphaned packages`,
        orphaned: orphanedPackages.map(p => ({
          id: p.id,
          name: p.name,
          student: `${p.student.firstName} ${p.student.lastName}`,
          price: p.price,
          purchasedAt: p.purchasedAt,
          isActive: p.isActive
        })),
        action: 'Send with { "confirm": true } to delete these packages'
      });
    }
  } catch (error) {
    console.error('Cleanup orphaned packages error:', error);
    res.status(500).json({ message: 'Error cleaning up orphaned packages' });
  }
});

// Delete all packages
router.delete('/all', async (req, res) => {
  try {
    const userId = req.user.id;

    // Count packages before deletion
    const count = await prisma.package.count({
      where: { userId }
    });

    // Delete all packages for this user
    await prisma.package.deleteMany({
      where: { userId }
    });

    res.json({
      message: `Deleted ${count} packages`,
      deletedCount: count
    });
  } catch (error) {
    console.error('Delete all packages error:', error);
    res.status(500).json({ message: 'Error deleting packages' });
  }
});

export default router;

