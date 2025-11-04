import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * Apply payment to lessons chronologically
 * Combines payment and existing credit, applies to oldest unpaid lessons first
 * Returns: { lessonsMarkedPaid: number, creditRemaining: number, creditUsed: number }
 */
async function applyPaymentToLessons(userId, studentId, paymentAmount, paymentId = null) {
  // Get student's current credit
  const student = await prisma.student.findFirst({
    where: { id: studentId, userId }
  });
  
  if (!student) {
    throw new Error('Student not found');
  }

  // Combine payment and existing credit
  let availableAmount = paymentAmount + (student.credit || 0);
  let creditUsed = student.credit || 0;
  
  // Get all unpaid lessons for this student, ordered by date (oldest first)
  // We'll check for partial payments in the loop
  const unpaidLessons = await prisma.lesson.findMany({
    where: {
      userId,
      studentId,
      isPaid: false,  // Get lessons that aren't fully paid
      NOT: { status: { in: ['cancelled', 'canceled'] } }
    },
    orderBy: { dateTime: 'asc' }
  });

  const lessonsMarkedPaid = [];
  const lessonsPartiallyPaid = [];
  let creditToSet = 0;
  
  // Apply available amount to lessons chronologically, covering older unpaid/partial first
  for (const lesson of unpaidLessons) {
    if (availableAmount <= 0) break;
    
    const lessonPrice = lesson.price || 0;
    const currentPaidAmount = lesson.paidAmount || 0;
    const remainingNeeded = lessonPrice - currentPaidAmount;
    
    if (remainingNeeded <= 0) {
      // Lesson is already fully paid, skip it
      continue;
    }
    
    if (availableAmount >= remainingNeeded) {
      // Full payment for this lesson - mark as paid and link to payment via junction table
      const amountToApply = remainingNeeded;
      
      // Create or update LessonPayment record
      if (paymentId) {
        await prisma.lessonPayment.upsert({
          where: {
            lessonId_paymentId: {
              lessonId: lesson.id,
              paymentId: paymentId
            }
          },
          update: {
            amount: amountToApply
          },
          create: {
            lessonId: lesson.id,
            paymentId: paymentId,
            amount: amountToApply
          }
        });
      }
      
      // Recalculate total paidAmount from all LessonPayment records for this lesson
      const allLessonPayments = await prisma.lessonPayment.findMany({
        where: { lessonId: lesson.id },
        select: { amount: true }
      });
      const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
      
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { 
          isPaid: totalPaidAmount >= lessonPrice,
          paidAmount: totalPaidAmount
        }
      });
      lessonsMarkedPaid.push({ lessonId: lesson.id, amount: remainingNeeded, totalAmount: lessonPrice });
      availableAmount -= remainingNeeded;
    } else {
      // Partial payment - mark as partially paid and link to payment via junction table
      const amountToApply = availableAmount;
      
      // Create or update LessonPayment record
      if (paymentId) {
        await prisma.lessonPayment.upsert({
          where: {
            lessonId_paymentId: {
              lessonId: lesson.id,
              paymentId: paymentId
            }
          },
          update: {
            amount: amountToApply
          },
          create: {
            lessonId: lesson.id,
            paymentId: paymentId,
            amount: amountToApply
          }
        });
      }
      
      // Recalculate total paidAmount from all LessonPayment records for this lesson
      const allLessonPayments = await prisma.lessonPayment.findMany({
        where: { lessonId: lesson.id },
        select: { amount: true }
      });
      const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
      
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { 
          isPaid: totalPaidAmount >= lessonPrice,
          paidAmount: totalPaidAmount
        }
      });
      lessonsPartiallyPaid.push({ lessonId: lesson.id, amount: availableAmount, paidAmount: totalPaidAmount, remaining: lessonPrice - totalPaidAmount });
      availableAmount = 0;
      break;
    }
  }
  
  // Any remaining amount goes to credit
  if (availableAmount > 0) {
    creditToSet = availableAmount;
  }

  // Update student credit to the final remaining amount
  await prisma.student.update({
    where: { id: studentId },
    data: { credit: creditToSet }
  });

  return {
    lessonsMarkedPaid: lessonsMarkedPaid.length,
    lessonsPartiallyPaid: lessonsPartiallyPaid.length,
    creditRemaining: creditToSet,
    creditUsed
  };
}

/**
 * Reverse payment application when payment is deleted
 */
async function reversePaymentApplication(userId, studentId, paymentAmount) {
  // Get student
  const student = await prisma.student.findFirst({
    where: { id: studentId, userId }
  });
  
  if (!student) {
    throw new Error('Student not found');
  }

  let remainingToReverse = paymentAmount;
  
  // Get paid or partially paid lessons for this student, ordered by date (newest first - reverse order)
  const paidLessons = await prisma.lesson.findMany({
    where: {
      userId,
      studentId,
      OR: [
        { isPaid: true },  // Fully paid
        { paidAmount: { gt: 0 } }  // Partially paid
      ],
      NOT: { status: { in: ['cancelled', 'canceled'] } }
    },
    orderBy: { dateTime: 'desc' } // Newest first
  });

  const lessonsUnmarked = [];
  const lessonsPartiallyReversed = [];
  
  // Reverse payments, starting with most recent paid/partially paid lessons
  for (const lesson of paidLessons) {
    if (remainingToReverse <= 0) break;
    
    const lessonPrice = lesson.price || 0;
    const currentPaidAmount = lesson.paidAmount || 0;
    
    if (currentPaidAmount <= 0) {
      // Lesson has no payment, skip
      continue;
    }
    
    if (remainingToReverse >= currentPaidAmount) {
      // Fully reverse payment from this lesson
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { 
          isPaid: false,
          paidAmount: 0
        }
      });
      lessonsUnmarked.push({ lessonId: lesson.id, amount: currentPaidAmount });
      remainingToReverse -= currentPaidAmount;
    } else {
      // Partially reverse - reduce paidAmount but keep lesson partially paid
      const newPaidAmount = currentPaidAmount - remainingToReverse;
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { 
          isPaid: false,
          paidAmount: newPaidAmount
        }
      });
      lessonsPartiallyReversed.push({ lessonId: lesson.id, amount: remainingToReverse, newPaidAmount });
      remainingToReverse = 0;
      break;
    }
  }

  // Any remaining amount goes to credit (student gets credited)
  if (remainingToReverse > 0) {
    await prisma.student.update({
      where: { id: studentId },
      data: { credit: { increment: remainingToReverse } }
    });
  }

  return {
    lessonsUnmarked: lessonsUnmarked.length,
    lessonsPartiallyReversed: lessonsPartiallyReversed.length,
    creditAdded: remainingToReverse
  };
}

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
        student: true,
        lessons: {
          include: {
            lesson: {
              select: {
                id: true,
                dateTime: true,
                subject: true,
                price: true,
                paidAmount: true,
                isPaid: true
              }
            }
          },
          orderBy: {
            lesson: {
              dateTime: 'asc'
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ message: 'Error fetching payments' });
  }
});

// Get single payment
router.get('/:id', async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        student: true,
        lessons: {
          include: {
            lesson: {
              select: {
                id: true,
                dateTime: true,
                subject: true,
                price: true,
                paidAmount: true,
                isPaid: true
              }
            }
          },
          orderBy: {
            lesson: {
              dateTime: 'asc'
            }
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            purchasedAt: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ message: 'Error fetching payment' });
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

      // Check if payment should be applied to family
      const applyToFamily = req.body.applyToFamily === true || req.body.applyToFamily === 'true';
      
      // Get family members if applying to family
      let familyStudents = [student];
      if (applyToFamily && student.familyId) {
        const familyMembers = await prisma.student.findMany({
          where: { 
            familyId: student.familyId,
            userId: req.user.id,
            archived: false
          }
        });
        familyStudents = familyMembers;
      }

      // Check if this is a package payment (only valid for single student, not family)
      const isPackagePayment = req.body.notes && req.body.notes.startsWith('Package: ');
      
      if (isPackagePayment && applyToFamily) {
        return res.status(400).json({ 
          message: 'Package payments cannot be applied to families. Please select a single student.' 
        });
      }
      
      // Validate package payment
      if (isPackagePayment) {
        // Check if student uses packages
        if (!student.usePackages) {
          return res.status(400).json({ 
            message: 'Student does not use packages. Please enable packages for this student first.' 
          });
        }
        
        // Validate that payment amount matches student's pricePerPackage
        if (!student.pricePerPackage) {
          return res.status(400).json({ 
            message: 'Student does not have a package price set. Please set pricePerPackage for this student.' 
          });
        }
        
        // Check if payment amount matches pricePerPackage (allow small floating point differences)
        const amountDiff = Math.abs(req.body.amount - student.pricePerPackage);
        if (amountDiff > 0.01) { // Allow 1 cent difference for floating point
          return res.status(400).json({ 
            message: `Package payment amount ($${req.body.amount.toFixed(2)}) must match student's package price ($${student.pricePerPackage.toFixed(2)})` 
          });
        }
      }

      // Create payments for all family members if applyToFamily is true
      const createdPayments = [];
      
      for (const familyStudent of familyStudents) {
        // Create payment data for this student
        const paymentData = {
          studentId: familyStudent.id,
          amount: req.body.amount,
          method: req.body.method,
          date: req.body.date,
          notes: req.body.notes || null,
          userId: req.user.id
        };

        // Create the payment
        const payment = await prisma.payment.create({
          data: paymentData,
          include: {
            student: true
          }
        });

        createdPayments.push(payment);

        // Apply payment to lessons (unless it's a package payment)
        if (!isPackagePayment) {
          try {
            await applyPaymentToLessons(
              req.user.id,
              familyStudent.id,
              req.body.amount,
              payment.id // Pass payment ID to link lessons
            );
          } catch (applicationError) {
            console.error(`Payment application error for student ${familyStudent.id}:`, applicationError);
            // Continue with other students even if one fails
          }
        }
      }

      // If applying to family, return the first payment with a summary
      if (applyToFamily && familyStudents.length > 1) {
        // Fetch updated credits for all family members
        const familyCredits = await Promise.all(
          familyStudents.map(async (s) => {
            const student = await prisma.student.findUnique({
              where: { id: s.id },
              select: { credit: true, firstName: true, lastName: true }
            });
            return {
              studentId: s.id,
              studentName: `${student.firstName} ${student.lastName}`,
              credit: student?.credit || 0
            };
          })
        );

        res.status(201).json({
          ...createdPayments[0],
          isFamilyPayment: true,
          familyPayments: createdPayments.map(p => ({
            id: p.id,
            studentId: p.studentId,
            studentName: `${p.student.firstName} ${p.student.lastName}`
          })),
          familyCredits,
          message: `Payment recorded for ${familyStudents.length} family member${familyStudents.length > 1 ? 's' : ''}`
        });
      } else {
        // Single student payment
        const payment = createdPayments[0];
        
        if (!isPackagePayment) {
          // Fetch updated student to get current credit
          const updatedStudent = await prisma.student.findUnique({
            where: { id: req.body.studentId },
            select: { credit: true }
          });

          res.status(201).json({
            ...payment,
            currentCredit: updatedStudent?.credit || 0
          });
        } else {
          // Package payment - don't apply to lessons (package creation handles payment application)
          res.status(201).json({
            ...payment,
            message: 'Package payment created. The package payment amount will be applied when the package is created.'
          });
        }
      }
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

    // Check if this is a package payment (either by notes or by packageId)
    const isPackagePayment = (existing.packageId !== null) || (existing.notes && existing.notes.startsWith('Package: '));
    const amountChanged = req.body.amount !== undefined && req.body.amount !== existing.amount;

    // Prevent amount changes for package payments
    if (isPackagePayment && amountChanged) {
      return res.status(400).json({ 
        message: 'Cannot change the amount of a package payment. Package payments are linked to their packages.' 
      });
    }

    // Old logic removed - no longer updating package prices when payment amount changes
    if (false && isPackagePayment && amountChanged) {
      const packageName = existing.notes.replace('Package: ', '').trim();
      
      // Find the associated package
      const paymentDate = new Date(existing.date);
      const dayStart = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate());
      const dayEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate() + 1);
      
      const associatedPackage = await prisma.package.findFirst({
        where: {
          userId: req.user.id,
          studentId: existing.studentId,
          name: packageName,
          price: existing.amount,
          purchasedAt: {
            gte: dayStart,
            lt: dayEnd
          }
        }
      });

      if (!associatedPackage) {
        // Try loose match
        const looseMatch = await prisma.package.findFirst({
          where: {
            userId: req.user.id,
            studentId: existing.studentId,
            name: packageName,
            price: existing.amount
          }
        });
        
        if (looseMatch) {
          // Update package price
          await prisma.package.update({
            where: { id: looseMatch.id },
            data: { price: req.body.amount }
          });
          console.log(`[Payment Update] Updated package ${looseMatch.id} price from $${existing.amount} to $${req.body.amount}`);
        }
      } else {
        // Update package price
        await prisma.package.update({
          where: { id: associatedPackage.id },
          data: { price: req.body.amount }
        });
        console.log(`[Payment Update] Updated package ${associatedPackage.id} price from $${existing.amount} to $${req.body.amount}`);
      }

      // For package payments, if amount changed, we need to adjust credit
      // Reverse the old amount, then apply the new amount
      if (amountChanged) {
        const student = await prisma.student.findFirst({
          where: { id: existing.studentId, userId: req.user.id }
        });

        if (student) {
          // Calculate the difference
          const amountDifference = req.body.amount - existing.amount;
          
          if (amountDifference !== 0) {
            // Adjust credit by the difference
            // If amount increased, credit increases; if decreased, credit decreases
            const newCredit = Math.max(0, (student.credit || 0) + amountDifference);
            await prisma.student.update({
              where: { id: existing.studentId },
              data: { credit: newCredit }
            });
            console.log(`[Payment Update] Adjusted credit by $${amountDifference.toFixed(2)}. Old: $${student.credit || 0}, New: $${newCredit}`);
          }
        }
      }
    }

    // Update the payment
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
// Link lesson to payment
router.patch('/:id/link-lesson', async (req, res) => {
  try {
    const { lessonId } = req.body;

    if (!lessonId) {
      return res.status(400).json({ message: 'lessonId is required' });
    }

    // Verify payment belongs to user
    const payment = await prisma.payment.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Verify lesson belongs to user and same student
    const lesson = await prisma.lesson.findFirst({
      where: { 
        id: lessonId,
        userId: req.user.id,
        studentId: payment.studentId
      }
    });

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found or does not belong to this student' });
    }

    // Calculate paid amount - use payment amount or remaining lesson price, whichever is smaller
    const lessonPrice = lesson.price || 0;
    const currentPaidAmount = lesson.paidAmount || 0;
    const remainingNeeded = lessonPrice - currentPaidAmount;
    const paymentAmount = payment.amount || 0;
    const amountToApply = Math.min(paymentAmount, remainingNeeded);

    // Create or update LessonPayment record
    await prisma.lessonPayment.upsert({
      where: {
        lessonId_paymentId: {
          lessonId: lessonId,
          paymentId: payment.id
        }
      },
      update: {
        amount: amountToApply
      },
      create: {
        lessonId: lessonId,
        paymentId: payment.id,
        amount: amountToApply
      }
    });

    // Recalculate total paidAmount from all LessonPayment records for this lesson
    const allLessonPayments = await prisma.lessonPayment.findMany({
      where: { lessonId: lessonId },
      select: { amount: true }
    });
    const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);

    // Update lesson payment status
    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        isPaid: totalPaidAmount >= lessonPrice,
        paidAmount: totalPaidAmount,
        packageId: null // Clear package link if linking to a regular payment
      },
      include: {
        student: true,
        payments: {
          include: {
            payment: {
              select: {
                id: true,
                date: true,
                amount: true,
                method: true,
                notes: true
              }
            }
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            totalHours: true,
            hoursUsed: true,
            price: true,
            purchasedAt: true,
            expiresAt: true
          }
        }
      }
    });

    // Fetch updated payment with linked lessons
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        student: true,
        lessons: {
          include: {
            lesson: {
              include: {
                student: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: {
            lesson: {
              dateTime: 'asc'
            }
          }
        }
      }
    });

    res.json(updatedPayment);
  } catch (error) {
    console.error('Link lesson to payment error:', error);
    res.status(500).json({ message: 'Error linking lesson to payment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Verify payment belongs to user
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check if this payment is linked to a package
    const isPackagePayment = payment.packageId !== null;
    
    if (isPackagePayment) {
      // Find the package linked to this payment
      const packageToDelete = await prisma.package.findFirst({
        where: {
          id: payment.packageId,
          userId: req.user.id
        }
      });

      if (packageToDelete) {
        console.log(`[Payment Delete] Found linked package - Package ${packageToDelete.id} (${packageToDelete.name}, purchased ${packageToDelete.purchasedAt})`);
        
        // Before deleting package, reverse the credit and payments that were applied when package was created
        // The package price was applied to lessons or added to credit when created
        // We need to reverse that application by:
        // 1. Unmarking any lessons that were paid with this package payment
        // 2. Subtracting the credit that was added
        try {
          // Get current student credit
          const student = await prisma.student.findFirst({
            where: { id: payment.studentId, userId: req.user.id }
          });
          
          if (student) {
            console.log(`[Payment Delete] Student current credit: $${student.credit || 0}`);
            console.log(`[Payment Delete] Package payment amount to reverse: $${payment.amount}`);
            
            // When a package payment is deleted, we need to:
            // 1. Reverse any lessons that were paid with this package payment
            // 2. Subtract the FULL package amount from credit (since that's what was added/used)
            
            let remainingToReverse = payment.amount;
            
            // Get paid lessons and reverse them (newest first, to match payment application order)
            const allLessons = await prisma.lesson.findMany({
              where: {
                userId: req.user.id,
                studentId: payment.studentId,
                isPaid: true,
                NOT: { status: { in: ['cancelled', 'canceled'] } }
              },
              orderBy: { dateTime: 'desc' }
            });
            
            const partiallyPaidLessons = await prisma.lesson.findMany({
              where: {
                userId: req.user.id,
                studentId: payment.studentId,
                isPaid: false,
                NOT: { status: { in: ['cancelled', 'canceled'] } }
              },
              orderBy: { dateTime: 'desc' }
            });
            
            const paidLessons = [
              ...allLessons,
              ...partiallyPaidLessons.filter(l => (l.paidAmount || 0) > 0)
            ].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
            
            console.log(`[Payment Delete] Found ${paidLessons.length} paid/partially paid lessons to potentially reverse`);
            
            // Reverse payments from lessons (newest first)
            for (const lesson of paidLessons) {
              if (remainingToReverse <= 0) break;
              
              const currentPaidAmount = lesson.paidAmount || 0;
              if (currentPaidAmount <= 0) continue;
              
              if (remainingToReverse >= currentPaidAmount) {
                await prisma.lesson.update({
                  where: { id: lesson.id },
                  data: { isPaid: false, paidAmount: 0 }
                });
                console.log(`[Payment Delete] Reversed lesson ${lesson.id}: unmarked as paid (was $${currentPaidAmount})`);
                remainingToReverse -= currentPaidAmount;
              } else {
                const newPaidAmount = currentPaidAmount - remainingToReverse;
                await prisma.lesson.update({
                  where: { id: lesson.id },
                  data: { isPaid: false, paidAmount: newPaidAmount }
                });
                console.log(`[Payment Delete] Partially reversed lesson ${lesson.id}: $${currentPaidAmount} -> $${newPaidAmount}`);
                remainingToReverse = 0;
                break;
              }
            }
            
            // Always subtract the FULL package payment amount from credit
            const creditToSubtract = payment.amount;
            const newCredit = Math.max(0, (student.credit || 0) - creditToSubtract);
            
            await prisma.student.update({
              where: { id: payment.studentId },
              data: { credit: newCredit }
            });
            
            console.log(`[Payment Delete] Credit adjustment: Old: $${student.credit || 0}, Subtracted: $${creditToSubtract}, New: $${newCredit}`);
          }
          
          // Delete the package
          await prisma.package.delete({
            where: { id: packageToDelete.id }
          });
          console.log(`[Payment Delete] Package ${packageToDelete.id} deleted along with payment ${payment.id}`);
        } catch (reversalError) {
          console.error('[Payment Delete] Error reversing package payment:', reversalError);
          // Continue with payment deletion even if reversal fails
        }
      } else {
        console.warn(`[Payment Delete] Payment ${payment.id} has packageId ${payment.packageId} but package not found`);
      }
    } else if (payment.notes && payment.notes.startsWith('Package: ')) {
      // Fallback: old logic for payments created before linking (for backward compatibility)
      const packageName = payment.notes.replace('Package: ', '').trim();
      
      console.log(`[Payment Delete] Checking for package to delete (fallback): name="${packageName}", price=$${payment.amount}, student=${payment.studentId}`);
      
      const paymentDate = new Date(payment.date);
      const dayStart = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate());
      const dayEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate() + 1);
      
      try {
        const packageToDelete = await prisma.package.findFirst({
          where: {
            userId: req.user.id,
            studentId: payment.studentId,
            name: packageName,
            price: payment.amount,
            purchasedAt: {
              gte: dayStart,
              lt: dayEnd
            }
          }
        });

        if (packageToDelete) {
          console.log(`[Payment Delete] Found exact match - Package ${packageToDelete.id} (${packageToDelete.name}, purchased ${packageToDelete.purchasedAt})`);
          
          // Before deleting package, reverse the credit and payments that were applied when package was created
          // The package price was applied to lessons or added to credit when created
          // We need to reverse that application by:
          // 1. Unmarking any lessons that were paid with this package payment
          // 2. Subtracting the credit that was added
          try {
            // Get current student credit
            const student = await prisma.student.findFirst({
              where: { id: payment.studentId, userId: req.user.id }
            });
            
            if (student) {
              console.log(`[Payment Delete] Student current credit: $${student.credit || 0}`);
              console.log(`[Payment Delete] Package payment amount to reverse: $${payment.amount}`);
              
              // When a package payment is deleted, we need to:
              // 1. Reverse any lessons that were paid with this package payment
              // 2. Subtract the FULL package amount from credit (since that's what was added/used)
              
              // For package payments, the package price was applied to lessons or went to credit
              // We reverse lessons first, then subtract the full amount from credit
              
              let remainingToReverse = payment.amount;
              
              // Get paid lessons and reverse them (newest first, to match payment application order)
              // Query for lessons that are marked as paid, then filter by paidAmount in code if needed
              const allLessons = await prisma.lesson.findMany({
                where: {
                  userId: req.user.id,
                  studentId: payment.studentId,
                  isPaid: true, // Get lessons marked as paid
                  NOT: { status: { in: ['cancelled', 'canceled'] } }
                },
                orderBy: { dateTime: 'desc' } // Newest first - reverse order
              });
              
              // Also get lessons with paidAmount > 0 (partially paid) that might not be marked as isPaid
              const partiallyPaidLessons = await prisma.lesson.findMany({
                where: {
                  userId: req.user.id,
                  studentId: payment.studentId,
                  isPaid: false,
                  NOT: { status: { in: ['cancelled', 'canceled'] } }
                },
                orderBy: { dateTime: 'desc' }
              });
              
              // Combine and filter to only include lessons with paidAmount > 0
              const paidLessons = [
                ...allLessons,
                ...partiallyPaidLessons.filter(l => (l.paidAmount || 0) > 0)
              ].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)); // Sort by newest first
              
              console.log(`[Payment Delete] Found ${paidLessons.length} paid/partially paid lessons to potentially reverse`);
              
              // Reverse payments from lessons (newest first)
              for (const lesson of paidLessons) {
                if (remainingToReverse <= 0) break;
                
                const currentPaidAmount = lesson.paidAmount || 0;
                if (currentPaidAmount <= 0) continue;
                
                if (remainingToReverse >= currentPaidAmount) {
                  await prisma.lesson.update({
                    where: { id: lesson.id },
                    data: { isPaid: false, paidAmount: 0 }
                  });
                  console.log(`[Payment Delete] Reversed lesson ${lesson.id}: unmarked as paid (was $${currentPaidAmount})`);
                  remainingToReverse -= currentPaidAmount;
                } else {
                  const newPaidAmount = currentPaidAmount - remainingToReverse;
                  await prisma.lesson.update({
                    where: { id: lesson.id },
                    data: { isPaid: false, paidAmount: newPaidAmount }
                  });
                  console.log(`[Payment Delete] Partially reversed lesson ${lesson.id}: $${currentPaidAmount} -> $${newPaidAmount}`);
                  remainingToReverse = 0;
                  break;
                }
              }
              
              // Always subtract the FULL package payment amount from credit
              // This is because when package was created, the full amount was applied/added
              // Some may have gone to lessons (which we just reversed), but we still need to subtract from credit
              const creditToSubtract = payment.amount;
              const newCredit = Math.max(0, (student.credit || 0) - creditToSubtract);
              
              await prisma.student.update({
                where: { id: payment.studentId },
                data: { credit: newCredit }
              });
              
              console.log(`[Payment Delete] Credit adjustment: Old: $${student.credit || 0}, Subtracted: $${creditToSubtract}, New: $${newCredit}`);
              console.log(`[Payment Delete] Remaining amount that went to lessons (reversed): $${payment.amount - remainingToReverse}`);
            }
          } catch (reversalError) {
            console.error('[Payment Delete] Error reversing package payment:', reversalError);
            // Continue with package deletion even if reversal fails
          }
          
          // Delete the package
          const deleteResult = await prisma.package.delete({
            where: { id: packageToDelete.id }
          });
          console.log(`[Payment Delete] Package ${packageToDelete.id} (${packageToDelete.name}) successfully deleted:`, deleteResult);
        } else {
          // Check if there are multiple packages with same name/price but different dates
          const packagesWithSameNamePrice = await prisma.package.findMany({
            where: {
              userId: req.user.id,
              studentId: payment.studentId,
              name: packageName,
              price: payment.amount
            },
            orderBy: { purchasedAt: 'desc' }
          });
          
          if (packagesWithSameNamePrice.length > 0) {
            console.warn(`[Payment Delete] Found ${packagesWithSameNamePrice.length} packages with same name/price but different dates. Not deleting to avoid data loss.`);
            console.warn(`[Payment Delete] Package IDs: ${packagesWithSameNamePrice.map(p => p.id).join(', ')}`);
            console.warn(`[Payment Delete] Payment date: ${payment.date}, Package dates: ${packagesWithSameNamePrice.map(p => p.purchasedAt).join(', ')}`);
            // Don't delete if there are multiple matches - too risky
          } else {
            // Try a looser match - maybe date/time don't match exactly
            const looseMatch = await prisma.package.findFirst({
              where: {
                userId: req.user.id,
                studentId: payment.studentId,
                name: packageName,
                price: payment.amount
              }
            });
            
            if (looseMatch) {
              console.log(`[Payment Delete] Found loose match (date mismatch) - Package ${looseMatch.id} (${looseMatch.name}, purchased ${looseMatch.purchasedAt}, payment date ${payment.date})`);
              
              // Reverse the package payment application (same logic as exact match)
              try {
                const student = await prisma.student.findFirst({
                  where: { id: payment.studentId, userId: req.user.id }
                });
                
                if (student) {
                  console.log(`[Payment Delete] Student current credit (loose match): $${student.credit || 0}`);
                  console.log(`[Payment Delete] Package payment amount to reverse (loose match): $${payment.amount}`);
                  
                  let remainingToReverse = payment.amount;
                  
                  // Get paid and partially paid lessons
                  const allLessons = await prisma.lesson.findMany({
                    where: {
                      userId: req.user.id,
                      studentId: payment.studentId,
                      isPaid: true,
                      NOT: { status: { in: ['cancelled', 'canceled'] } }
                    },
                    orderBy: { dateTime: 'desc' }
                  });
                  
                  const partiallyPaidLessons = await prisma.lesson.findMany({
                    where: {
                      userId: req.user.id,
                      studentId: payment.studentId,
                      isPaid: false,
                      NOT: { status: { in: ['cancelled', 'canceled'] } }
                    },
                    orderBy: { dateTime: 'desc' }
                  });
                  
                  const paidLessons = [
                    ...allLessons,
                    ...partiallyPaidLessons.filter(l => (l.paidAmount || 0) > 0)
                  ].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
                  
                  // Reverse lessons
                  for (const lesson of paidLessons) {
                    if (remainingToReverse <= 0) break;
                    
                    const currentPaidAmount = lesson.paidAmount || 0;
                    if (currentPaidAmount <= 0) continue;
                    
                    if (remainingToReverse >= currentPaidAmount) {
                      await prisma.lesson.update({
                        where: { id: lesson.id },
                        data: { isPaid: false, paidAmount: 0 }
                      });
                      remainingToReverse -= currentPaidAmount;
                    } else {
                      const newPaidAmount = currentPaidAmount - remainingToReverse;
                      await prisma.lesson.update({
                        where: { id: lesson.id },
                        data: { isPaid: false, paidAmount: newPaidAmount }
                      });
                      remainingToReverse = 0;
                      break;
                    }
                  }
                  
                  // Always subtract FULL package amount from credit
                  const creditToSubtract = payment.amount;
                  const newCredit = Math.max(0, (student.credit || 0) - creditToSubtract);
                  
                  await prisma.student.update({
                    where: { id: payment.studentId },
                    data: { credit: newCredit }
                  });
                  
                  console.log(`[Payment Delete] Credit adjustment (loose match): Old: $${student.credit || 0}, Subtracted: $${creditToSubtract}, New: $${newCredit}`);
                }
              } catch (reversalError) {
                console.error('[Payment Delete] Error reversing package payment:', reversalError);
                // Continue with package deletion even if reversal fails
              }
              
              // Delete the package even if date doesn't match exactly
              const deleteResult = await prisma.package.delete({
                where: { id: looseMatch.id }
              });
              console.log(`[Payment Delete] Package ${looseMatch.id} (${looseMatch.name}) deleted (loose match):`, deleteResult);
            } else {
              console.warn(`[Payment Delete] Could not find package to delete for payment ${payment.id}. Package name: ${packageName}, Student: ${payment.studentId}, Amount: $${payment.amount}`);
            }
          }
        }
      } catch (packageError) {
        console.error('[Payment Delete] Error deleting package:', packageError);
        // Continue to delete payment even if package deletion fails
      }
    } else {
      // Regular payment - reverse the payment application
      try {
        const reversalResult = await reversePaymentApplication(
          req.user.id,
          payment.studentId,
          payment.amount
        );
        console.log('Payment reversal result:', reversalResult);
      } catch (reversalError) {
        console.error('Payment reversal error:', reversalError);
        // Continue with payment deletion even if reversal fails
      }
    }

    // Delete the payment
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

