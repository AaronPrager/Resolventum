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

      // Log request details for debugging
      console.log(`[Package Creation] Request received:`);
      console.log(`  Student: ${student.firstName} ${student.lastName} (${req.body.studentId})`);
      console.log(`  Package name: ${req.body.name}`);
      console.log(`  Package price from request: $${req.body.price}`);
      console.log(`  Total hours: ${req.body.totalHours}`);
      console.log(`  Student credit BEFORE package: $${student.credit || 0}`);

      // First create the payment for the package
      const payment = await prisma.payment.create({
        data: {
          userId: req.user.id,
          studentId: req.body.studentId,
          amount: req.body.price,
          method: req.body.method || 'other',
          date: new Date(req.body.purchasedAt),
          notes: `Package: ${req.body.name}`
        }
      });

      console.log(`[Package Creation] Payment created: ${payment.id} for $${payment.amount} on ${payment.date.toISOString()}`);

      // Then create the package linked to the payment
      // Extract only fields that belong to Package model (exclude method and purchasedAt)
      // purchasedAt must be explicitly set to match the payment date (not using default)
      const { method, purchasedAt: reqPurchasedAt, ...packageData } = req.body;
      
      // Use the payment date as the source of truth for purchasedAt to ensure they match
      // This prevents timezone or parsing issues between the form and database
      const purchasedAt = payment.date;
      
      console.log(`[Package Creation] Setting purchasedAt to payment date: ${purchasedAt.toISOString()} (from request: ${reqPurchasedAt})`);
      
      const pkg = await prisma.package.create({
        data: {
          ...packageData,
          purchasedAt: purchasedAt, // Use payment date to ensure consistency
          userId: req.user.id,
          paymentId: payment.id, // Link package to payment
          isActive: req.body.isActive !== undefined ? req.body.isActive : true // Default to active
        },
        include: {
          student: true,
          payment: true
        }
      });

      // Update payment to link to package (bidirectional link)
      await prisma.payment.update({
        where: { id: payment.id },
        data: { packageId: pkg.id }
      });

      console.log(`[Package Creation] Package created:`);
      console.log(`  Package ID: ${pkg.id}`);
      console.log(`  Package price stored: $${pkg.price}`);
      console.log(`  Price matches request: ${pkg.price === parseFloat(req.body.price)}`);

      // Simplified logic: When package is purchased, update student's hourly rate to package rate
      // and recalculate all unpaid past lessons
      const packageHourlyRate = pkg.price / pkg.totalHours;
      
      // Update student's pricePerLesson to package rate and set usePackages to true
      await prisma.student.update({
        where: { id: student.id },
        data: { 
          pricePerLesson: packageHourlyRate,
          usePackages: true // Automatically enable packages when a package is purchased
        }
      });
      
      console.log(`Updated student ${student.firstName} ${student.lastName} hourly rate from $${student.pricePerLesson || 0} to $${packageHourlyRate}, usePackages set to true`);
      
      // Get student's current credit
      const updatedStudent = await prisma.student.findFirst({
        where: { id: student.id, userId: req.user.id }
      });
      
      console.log(`[Package Creation] Student credit check:`);
      console.log(`  Credit after student update: $${updatedStudent.credit || 0}`);
      
      // Apply package payment to lessons chronologically (same logic as regular payments)
      // Combine package price and existing credit
      let availableAmount = pkg.price + (updatedStudent.credit || 0);
      let creditUsed = updatedStudent.credit || 0;
      
      console.log(`[Package Creation] Payment calculation:`);
      console.log(`  pkg.price: $${pkg.price}`);
      console.log(`  updatedStudent.credit: $${updatedStudent.credit || 0}`);
      console.log(`  availableAmount (pkg.price + credit): $${availableAmount}`);
      console.log(`  creditUsed: $${creditUsed}`);
      
      // Get all unpaid lessons for this student, ordered by date (oldest first)
      // We'll check for partial payments in the loop
      const unpaidLessons = await prisma.lesson.findMany({
        where: {
          userId: req.user.id,
          studentId: req.body.studentId,
          isPaid: false  // Get lessons that aren't fully paid
        },
        orderBy: { dateTime: 'asc' }
      });

      console.log(`Found ${unpaidLessons.length} unpaid lessons for student ${req.body.studentId}`);
      console.log(`Package price: $${pkg.price}, Student credit before: $${updatedStudent.credit || 0}, Available: $${pkg.price + (updatedStudent.credit || 0)}`);

      const lessonsMarkedPaid = [];
      const lessonsPartiallyPaid = [];
      let creditToSet = 0;
      
      // Apply available amount to lessons chronologically, covering older unpaid/partial first
      for (const lesson of unpaidLessons) {
        if (availableAmount <= 0) {
          // Out of money, but continue to update prices for remaining lessons
          const lessonHours = lesson.duration / 60;
          const newLessonPrice = packageHourlyRate * lessonHours;
          const roundedNewPrice = Math.round(newLessonPrice * 100) / 100;
          
          if (lesson.price !== roundedNewPrice) {
            await prisma.lesson.update({
              where: { id: lesson.id },
              data: { price: roundedNewPrice }
            });
          }
          continue;
        }
        
        // Recalculate lesson price using the new package rate
        const lessonHours = lesson.duration / 60; // Convert minutes to hours
        const newLessonPrice = packageHourlyRate * lessonHours;
        const roundedNewPrice = Math.round(newLessonPrice * 100) / 100;
        
        const lessonPrice = roundedNewPrice;
        const currentPaidAmount = lesson.paidAmount || 0;
        const remainingNeeded = lessonPrice - currentPaidAmount;
        
        // Update lesson price (always update to package rate for unpaid lessons)
        if (lesson.price !== roundedNewPrice) {
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { price: roundedNewPrice }
          });
        }
        
        if (remainingNeeded <= 0) {
          // Lesson is already fully paid, skip it
          continue;
        }
        
        // Apply payment
        if (availableAmount >= remainingNeeded) {
          // Full payment for this lesson - mark as paid and link to package and payment
          const lessonHours = lesson.duration / 60; // Convert minutes to hours
          const amountToApply = remainingNeeded;
          
          // Create or update LessonPayment record if package payment exists
          if (pkg.paymentId) {
            await prisma.lessonPayment.upsert({
              where: {
                lessonId_paymentId: {
                  lessonId: lesson.id,
                  paymentId: pkg.paymentId
                }
              },
              update: {
                amount: amountToApply
              },
              create: {
                lessonId: lesson.id,
                paymentId: pkg.paymentId,
                amount: amountToApply
              }
            });
          }
          
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { 
              isPaid: true,
              paidAmount: lessonPrice,
              packageId: pkg.id // Link lesson to package
            }
          });
          
          // Increment package hours used
          await prisma.package.update({
            where: { id: pkg.id },
            data: { hoursUsed: { increment: lessonHours } }
          });
          
          lessonsMarkedPaid.push({ lessonId: lesson.id, amount: remainingNeeded, totalAmount: lessonPrice });
          availableAmount -= remainingNeeded;
        } else {
          // Partial payment - mark as partially paid and link to package and payment
          const lessonHours = lesson.duration / 60; // Convert minutes to hours
          const amountToApply = availableAmount;
          const newPaidAmount = currentPaidAmount + availableAmount;
          
          // Create or update LessonPayment record if package payment exists
          if (pkg.paymentId) {
            await prisma.lessonPayment.upsert({
              where: {
                lessonId_paymentId: {
                  lessonId: lesson.id,
                  paymentId: pkg.paymentId
                }
              },
              update: {
                amount: amountToApply
              },
              create: {
                lessonId: lesson.id,
                paymentId: pkg.paymentId,
                amount: amountToApply
              }
            });
          }
          
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { 
              isPaid: false,
              paidAmount: newPaidAmount,
              packageId: pkg.id // Link lesson to package (even if partially paid)
            }
          });
          
          // Increment package hours used (even for partial payments)
          await prisma.package.update({
            where: { id: pkg.id },
            data: { hoursUsed: { increment: lessonHours } }
          });
          
          lessonsPartiallyPaid.push({ lessonId: lesson.id, amount: availableAmount, paidAmount: newPaidAmount, remaining: lessonPrice - newPaidAmount });
          availableAmount = 0;
          // Continue to update prices for remaining lessons even if we're out of money
        }
      }
      
      // Any remaining amount goes to credit
      if (availableAmount > 0) {
        creditToSet = availableAmount;
      }

      // Update student credit to the final remaining amount
      await prisma.student.update({
        where: { id: req.body.studentId },
        data: { credit: creditToSet }
      });
      
      console.log(`Applied package payment:`);
      console.log(`  Package price: $${pkg.price.toFixed(2)}`);
      console.log(`  Existing credit: $${creditUsed.toFixed(2)}`);
      console.log(`  Lessons fully paid: ${lessonsMarkedPaid.length}`);
      console.log(`  Lessons partially paid: ${lessonsPartiallyPaid.length}`);
      console.log(`  Final credit balance: $${creditToSet.toFixed(2)}`);
      if (unpaidLessons.length === 0) {
        console.log(`  Note: No unpaid lessons found - all payment went to credit`);
      }

      // Return updated package and student
      const updatedPkg = await prisma.package.findUnique({
        where: { id: pkg.id },
        include: {
          student: true
        }
      });

      res.status(201).json({
        ...updatedPkg,
        updatedStudentRate: true,
        newHourlyRate: packageHourlyRate,
        applicationResult: {
          lessonsMarkedPaid: lessonsMarkedPaid.length,
          lessonsPartiallyPaid: lessonsPartiallyPaid.length,
          creditRemaining: creditToSet,
          creditUsed: creditUsed,
          currentCredit: creditToSet
        }
      });
    } catch (error) {
      console.error('Create package error:', error);
      res.status(500).json({ message: 'Error creating package' });
    }
  }
);

// Update package
// Only allow updating purchasedAt and expiresAt (date and expiration)
router.put('/:id', async (req, res) => {
  try {
    // Verify package belongs to user
    const existing = await prisma.package.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Only allow updating purchasedAt and expiresAt
    const updateData = {};
    if (req.body.purchasedAt) {
      // If package has a linked payment, use payment date as source of truth
      // This ensures package and payment dates stay in sync
      if (existing.paymentId) {
        const payment = await prisma.payment.findUnique({
          where: { id: existing.paymentId },
          select: { date: true }
        });
        if (payment) {
          // Use payment date instead of form date to ensure consistency
          updateData.purchasedAt = payment.date;
          console.log(`[Package Update] Syncing package purchasedAt to payment date: ${payment.date.toISOString()}`);
          console.log(`[Package Update] Form date was: ${req.body.purchasedAt}, but using payment date instead`);
        } else {
          // Payment not found, use form date
          const purchasedAtDate = new Date(req.body.purchasedAt);
          updateData.purchasedAt = purchasedAtDate;
          console.log(`[Package Update] No linked payment found, using form date: ${purchasedAtDate.toISOString()}`);
        }
      } else {
        // No payment linked, use form date
        const purchasedAtDate = new Date(req.body.purchasedAt);
        updateData.purchasedAt = purchasedAtDate;
        console.log(`[Package Update] No payment linked, using form date: ${purchasedAtDate.toISOString()}`);
      }
      console.log(`[Package Update] Updating purchasedAt for package ${req.params.id}:`);
      console.log(`  Current value: ${existing.purchasedAt.toISOString()}`);
      console.log(`  New value: ${updateData.purchasedAt.toISOString()}`);
    }
    if (req.body.expiresAt !== undefined) {
      updateData.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    }

    // Prevent updating studentId, name, totalHours, price
    if (req.body.studentId || req.body.name || req.body.totalHours !== undefined || req.body.price !== undefined) {
      return res.status(400).json({ 
        message: 'Cannot update student, name, total hours, or price. Only date and expiration can be updated.' 
      });
    }

    // Only update if there's actually data to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const pkg = await prisma.package.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        student: true
      }
    });

    console.log(`[Package Update] Package updated successfully:`);
    console.log(`  New purchasedAt: ${pkg.purchasedAt.toISOString()}`);

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

// Delete all packages (must come before /:id route)
router.delete('/all', async (req, res) => {
  try {
    const userId = req.user.id;

    // Count packages before deletion
    const count = await prisma.package.count({
      where: { userId }
    });

    // First, unlink all lessons from packages and reset their payment status
    const lessonsLinkedToPackages = await prisma.lesson.findMany({
      where: {
        userId,
        packageId: { not: null }
      },
      select: { id: true }
    });

    if (lessonsLinkedToPackages.length > 0) {
      await prisma.lesson.updateMany({
        where: {
          userId,
          packageId: { not: null }
        },
        data: {
          packageId: null,
          isPaid: false,
          paidAmount: 0
        }
      });
      console.log(`[Delete All Packages] Unlinked ${lessonsLinkedToPackages.length} lessons from packages`);
    }

    // Delete all packages for this user
    await prisma.package.deleteMany({
      where: { userId }
    });

    console.log(`[Delete All Packages] Deleted ${count} packages for user ${userId}`);

    res.json({
      message: `Deleted ${count} packages and unlinked ${lessonsLinkedToPackages.length} lessons`,
      deletedCount: count,
      lessonsUnlinked: lessonsLinkedToPackages.length
    });
  } catch (error) {
    console.error('Delete all packages error:', error);
    res.status(500).json({ message: 'Error deleting packages' });
  }
});

// Delete a single package (must come after /all route)
router.delete('/:id', async (req, res) => {
  try {
    // Verify package belongs to user
    const existing = await prisma.package.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        lessons: true // Get all lessons linked to this package
      }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Credit back all lessons that were paid with this package
    const linkedLessons = existing.lessons || [];
    
    if (linkedLessons.length > 0) {
      console.log(`[Package Delete] Crediting back ${linkedLessons.length} lessons linked to package ${existing.id}`);
      
      // Unlink and credit back all lessons
      for (const lesson of linkedLessons) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: {
            packageId: null, // Unlink from package
            isPaid: false,   // Mark as unpaid
            paidAmount: 0    // Reset paid amount
          }
        });
        console.log(`[Package Delete] Credited back lesson ${lesson.id}: unmarked as paid, removed package link`);
      }
    }

    await prisma.package.delete({
      where: { id: req.params.id }
    });

    res.json({ 
      message: 'Package deleted successfully',
      lessonsCreditedBack: linkedLessons.length
    });
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ message: 'Error deleting package' });
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

    // Get lessons directly linked to this package
    const linkedLessons = await prisma.lesson.findMany({
      where: {
        userId,
        studentId: pkg.studentId,
        packageId: packageId // Directly linked lessons
      },
      orderBy: { dateTime: 'asc' },
      select: {
        id: true,
        dateTime: true,
        duration: true,
        subject: true,
        price: true,
        isPaid: true,
        paidAmount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Format lessons for response
    const packageUsage = linkedLessons.map(lesson => {
      const lessonHours = lesson.duration / 60;
      const lessonPricePerHour = lesson.price / lessonHours;
      
      return {
        lessonId: lesson.id,
        date: lesson.dateTime,
        subject: lesson.subject,
        duration: lesson.duration,
        hours: lessonHours,
        price: lesson.price,
        pricePerHour: lessonPricePerHour,
        isPaid: lesson.isPaid,
        paidAmount: lesson.paidAmount,
        likelyUsedPackage: true // These are confirmed linked to package
      };
    });

    const totalHoursTracked = packageUsage.reduce((sum, lesson) => sum + lesson.hours, 0);

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

export default router;



