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

  // Track payment amount separately from credit
  // Credit is used first, then payment amount
  const existingCredit = student.credit || 0;
  let availableAmount = paymentAmount + existingCredit;
  let creditUsed = 0; // Track how much credit was actually used
  let paymentAmountRemaining = paymentAmount; // Track how much of the actual payment is left
  
  // Get all lessons that need payment (paidAmount < price), ordered by date (oldest first)
  // We'll check for partial payments in the loop
  // Note: We fetch all lessons and filter by paidAmount < price in code to handle edge cases
  // where isPaid might be incorrectly set
  const allLessons = await prisma.lesson.findMany({
    where: {
      userId,
      studentId,
    },
    select: {
      id: true,
      dateTime: true,
      price: true,
      paidAmount: true,
      isPaid: true
    },
    orderBy: { dateTime: 'asc' }
  });
  
  // Filter to only lessons that need more payment (paidAmount < price)
  const unpaidLessons = allLessons.filter(lesson => {
    const lessonPrice = lesson.price || 0;
    const currentPaidAmount = lesson.paidAmount || 0;
    return currentPaidAmount < lessonPrice;
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
      // Use credit first, then payment amount
      let creditToUse = Math.min(existingCredit - creditUsed, remainingNeeded);
      let paymentToUse = remainingNeeded - creditToUse;
      creditUsed += creditToUse;
      paymentAmountRemaining -= paymentToUse;
      
      // Only create LessonPayment record if payment amount was used
      if (paymentId && paymentToUse > 0) {
        await prisma.lessonPayment.upsert({
          where: {
            lessonId_paymentId: {
              lessonId: lesson.id,
              paymentId: paymentId
            }
          },
          update: {
            amount: paymentToUse
          },
          create: {
            lessonId: lesson.id,
            paymentId: paymentId,
            amount: paymentToUse
          }
        });
      }
      
      // Recalculate total paidAmount from all LessonPayment records for this lesson
      // Note: credit is NOT included in paidAmount - it's tracked separately in student.credit
      // paidAmount should only reflect actual payment amounts from LessonPayment records
      // Credit reduces what needs to be paid but doesn't go into paidAmount
      const allLessonPayments = await prisma.lessonPayment.findMany({
        where: { lessonId: lesson.id },
        select: { amount: true }
      });
      const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
      // Cap at lesson price (can't pay more than the lesson costs)
      const finalPaidAmount = Math.min(totalPaidAmount, lessonPrice);
      
      // A lesson is "paid" if paidAmount + available credit >= lesson price
      // But for simplicity, we'll check if paidAmount >= lessonPrice (which means it's fully paid from payments)
      // If credit was used, it doesn't change paidAmount, but it does reduce the student's credit balance
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { 
          isPaid: finalPaidAmount >= lessonPrice,
          paidAmount: finalPaidAmount
        }
      });
      lessonsMarkedPaid.push({ lessonId: lesson.id, amount: remainingNeeded, totalAmount: lessonPrice });
      availableAmount -= remainingNeeded;
    } else {
      // Partial payment - mark as partially paid and link to payment via junction table
      // Use credit first, then payment amount
      let creditToUse = Math.min(existingCredit - creditUsed, availableAmount);
      let paymentToUse = availableAmount - creditToUse;
      creditUsed += creditToUse;
      paymentAmountRemaining -= paymentToUse;
      
      // Only create LessonPayment record if payment amount was used
      if (paymentId && paymentToUse > 0) {
        await prisma.lessonPayment.upsert({
          where: {
            lessonId_paymentId: {
              lessonId: lesson.id,
              paymentId: paymentId
            }
          },
          update: {
            amount: paymentToUse
          },
          create: {
            lessonId: lesson.id,
            paymentId: paymentId,
            amount: paymentToUse
          }
        });
      }
      
      // Recalculate total paidAmount from all LessonPayment records for this lesson
      const allLessonPayments = await prisma.lessonPayment.findMany({
        where: { lessonId: lesson.id },
        select: { amount: true }
      });
      const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
      
      // paidAmount should only be from LessonPayment records, not credit
      // Credit is tracked separately and doesn't go into paidAmount
      // Cap at lesson price (can't pay more than the lesson costs)
      const finalPaidAmount = Math.min(totalPaidAmount, lessonPrice);
      
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { 
          isPaid: finalPaidAmount >= lessonPrice,
          paidAmount: finalPaidAmount
        }
      });
      lessonsPartiallyPaid.push({ lessonId: lesson.id, amount: availableAmount, paidAmount: finalPaidAmount, remaining: lessonPrice - finalPaidAmount });
      availableAmount = 0;
      break;
    }
  }
  
  // Any remaining payment amount goes to credit (credit used is already deducted)
  // Final credit = original credit - credit used + any remaining payment amount
  creditToSet = existingCredit - creditUsed + paymentAmountRemaining;

  // Update student credit to the final remaining amount
  await prisma.student.update({
    where: { id: studentId },
    data: { credit: creditToSet }
  });

  // Log payment application details for debugging
  if (paymentId) {
    console.log(`[Payment Application] Payment ${paymentId}:`);
    console.log(`  - Payment amount: $${paymentAmount.toFixed(2)}`);
    console.log(`  - Existing credit: $${existingCredit.toFixed(2)}`);
    console.log(`  - Credit used: $${creditUsed.toFixed(2)}`);
    console.log(`  - Payment amount remaining: $${paymentAmountRemaining.toFixed(2)}`);
    console.log(`  - Final credit: $${creditToSet.toFixed(2)}`);
    console.log(`  - Lessons fully paid: ${lessonsMarkedPaid.length}`);
    console.log(`  - Lessons partially paid: ${lessonsPartiallyPaid.length}`);
  }

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
    const { startDate, endDate, studentId, familyId, method } = req.query;

    const where = { userId: req.user.id };
    
    // Filter by payment method if provided
    if (method) {
      where.method = method;
    }
    if (familyId) {
      // Filter by family - show family payments and individual payments for family members
      // Verify family exists
      const familyStudents = await prisma.student.findMany({
        where: { 
          familyId: familyId,
          userId: req.user.id,
          archived: false
        },
        select: { id: true }
      });
      if (familyStudents.length > 0) {
        const familyStudentIds = familyStudents.map(s => s.id);
        where.OR = [
          { familyId: familyId }, // Family payments
          { 
            studentId: { in: familyStudentIds },
            familyId: null // Individual payments for family members (not family payments)
          }
        ];
      }
    } else if (studentId) {
      // Verify student belongs to user
      const student = await prisma.student.findFirst({
        where: { id: studentId, userId: req.user.id }
      });
      if (student) {
        // Show payments for this student OR family payments for this student's family
        if (student.familyId) {
          where.OR = [
            { studentId: studentId },
            { familyId: student.familyId }
          ];
        } else {
        where.studentId = studentId;
        }
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
          select: {
            amount: true,
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

    // For family payments, fetch and include family members
    const paymentsWithFamily = await Promise.all(payments.map(async (payment) => {
      if (payment.familyId) {
        const familyStudents = await prisma.student.findMany({
          where: { 
            familyId: payment.familyId,
            userId: req.user.id,
            archived: false
          },
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        });
        return {
          ...payment,
          isFamilyPayment: true,
          familyStudents
        };
      }
      return payment;
    }));

    res.json(paymentsWithFamily);
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
          select: {
            amount: true,
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

    // If this is a family payment, include family members
    if (payment.familyId) {
      const familyStudents = await prisma.student.findMany({
        where: { 
          familyId: payment.familyId,
          userId: req.user.id,
          archived: false
        },
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      });
      
      return res.json({
        ...payment,
        isFamilyPayment: true,
        familyStudents
      });
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
      let familyStudents = [];
      let familyId = null;
      if (applyToFamily && student.familyId) {
        const familyMembers = await prisma.student.findMany({
          where: { 
            familyId: student.familyId,
            userId: req.user.id,
            archived: false
          }
        });
        familyStudents = familyMembers;
        familyId = student.familyId;
        
        if (familyStudents.length <= 1) {
          return res.status(400).json({ 
            message: 'No other family members found. Family payments require at least 2 family members.' 
          });
        }
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

      // Create ONE payment for the family (or single student)
      const paymentData = {
        studentId: student.id, // Primary student for reference
        familyId: familyId, // Set familyId if this is a family payment
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

      // Apply payment to lessons for all family members (or single student)
      if (!isPackagePayment) {
        if (applyToFamily && familyId) {
          // Apply payment to lessons for all family members
          // Split the payment amount across all family members' unpaid lessons
          const totalAmount = req.body.amount;
          
          // Get all unpaid lessons for all family members, ordered by date
          const allUnpaidLessons = [];
          for (const familyStudent of familyStudents) {
            const unpaidLessons = await prisma.lesson.findMany({
              where: {
                userId: req.user.id,
                studentId: familyStudent.id,
                isPaid: false,
              },
              orderBy: { dateTime: 'asc' }
            });
            
            // Add student info to each lesson for tracking
            unpaidLessons.forEach(lesson => {
              allUnpaidLessons.push({
                ...lesson,
                studentId: familyStudent.id
              });
            });
          }
          
          // Sort all lessons chronologically
          allUnpaidLessons.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
          
          // Apply payment to lessons chronologically across all family members
          // Track payment and credit separately
          let paymentAmountRemaining = totalAmount;
          
          // Get current credits for all family members
          const familyCredits = {};
          let totalCreditAvailable = 0;
          for (const familyStudent of familyStudents) {
            const s = await prisma.student.findFirst({
              where: { id: familyStudent.id, userId: req.user.id }
            });
            familyCredits[familyStudent.id] = s?.credit || 0;
            totalCreditAvailable += familyCredits[familyStudent.id] || 0;
          }
          
          let availableAmount = paymentAmountRemaining + totalCreditAvailable;
          let totalCreditUsed = 0;
          
          const lessonsMarkedPaid = [];
          const lessonsPartiallyPaid = [];
          
          // Apply available amount to lessons chronologically
          for (const lesson of allUnpaidLessons) {
            if (availableAmount <= 0) break;
            
            const lessonPrice = lesson.price || 0;
            const currentPaidAmount = lesson.paidAmount || 0;
            const remainingNeeded = lessonPrice - currentPaidAmount;
            
            if (remainingNeeded <= 0) {
              continue;
            }
            
            if (availableAmount >= remainingNeeded) {
              // Full payment for this lesson
              // Use credit first, then payment
              const creditAvailable = totalCreditAvailable - totalCreditUsed;
              const creditToUse = Math.min(creditAvailable, remainingNeeded);
              const paymentToUse = remainingNeeded - creditToUse;
              totalCreditUsed += creditToUse;
              paymentAmountRemaining -= paymentToUse;
              
              // Only create LessonPayment record if payment amount was used
              if (paymentToUse > 0) {
                await prisma.lessonPayment.upsert({
                  where: {
                    lessonId_paymentId: {
                      lessonId: lesson.id,
                      paymentId: payment.id
                    }
                  },
                  update: {
                    amount: paymentToUse
                  },
                  create: {
                    lessonId: lesson.id,
                    paymentId: payment.id,
                    amount: paymentToUse
                  }
                });
              }
              
              // Recalculate total paidAmount (from payments only, not credit)
              const allLessonPayments = await prisma.lessonPayment.findMany({
                where: { lessonId: lesson.id },
                select: { amount: true }
              });
              const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
              const finalPaidAmount = Math.min(totalPaidAmount, lessonPrice);
              
              await prisma.lesson.update({
                where: { id: lesson.id },
                data: { 
                  isPaid: finalPaidAmount >= lessonPrice,
                  paidAmount: finalPaidAmount
                }
              });
              
              lessonsMarkedPaid.push({ lessonId: lesson.id, amount: remainingNeeded, totalAmount: lessonPrice });
              availableAmount -= remainingNeeded;
            } else {
              // Partial payment
              // Use credit first, then payment
              const creditAvailable = totalCreditAvailable - totalCreditUsed;
              const creditToUse = Math.min(creditAvailable, availableAmount);
              const paymentToUse = availableAmount - creditToUse;
              totalCreditUsed += creditToUse;
              paymentAmountRemaining -= paymentToUse;
              
              // Only create LessonPayment record if payment amount was used
              if (paymentToUse > 0) {
                await prisma.lessonPayment.upsert({
                  where: {
                    lessonId_paymentId: {
                      lessonId: lesson.id,
                      paymentId: payment.id
                    }
                  },
                  update: {
                    amount: paymentToUse
                  },
                  create: {
                    lessonId: lesson.id,
                    paymentId: payment.id,
                    amount: paymentToUse
                  }
                });
              }
              
              // Recalculate total paidAmount (from payments only, not credit)
              const allLessonPayments = await prisma.lessonPayment.findMany({
                where: { lessonId: lesson.id },
                select: { amount: true }
              });
              const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
              const finalPaidAmount = Math.min(totalPaidAmount, lessonPrice);
              
              await prisma.lesson.update({
                where: { id: lesson.id },
                data: { 
                  isPaid: finalPaidAmount >= lessonPrice,
                  paidAmount: finalPaidAmount
                }
              });
              
              lessonsPartiallyPaid.push({ lessonId: lesson.id, amount: availableAmount, totalAmount: lessonPrice });
              availableAmount = 0;
              break;
            }
          }
          
          // Update credits for all family members
          // Calculate remaining credit and payment separately
          // Remaining credit = original credit - credit used
          // Remaining payment goes to credit (split evenly among family members)
          const remainingPaymentCredit = (paymentAmountRemaining || 0);
          const safeTotalCreditAvailable = (totalCreditAvailable || 0);
          const safeTotalCreditUsed = (totalCreditUsed || 0);
          const creditPerStudent = familyStudents.length > 0 
            ? (remainingPaymentCredit / familyStudents.length) 
            : 0;
          
          for (const familyStudent of familyStudents) {
            const studentCredit = (familyCredits[familyStudent.id] || 0);
            // Credit used for this student is proportional to their original credit
            let creditUsedForStudent = 0;
            if (studentCredit > 0 && safeTotalCreditAvailable > 0) {
              creditUsedForStudent = safeTotalCreditUsed * (studentCredit / safeTotalCreditAvailable);
            }
            // New credit = original credit - credit used + share of remaining payment
            const newCredit = studentCredit - creditUsedForStudent + creditPerStudent;
            
            // Ensure newCredit is a valid number (not NaN, not Infinity, not undefined)
            let finalCredit = 0;
            if (typeof newCredit === 'number' && !isNaN(newCredit) && isFinite(newCredit)) {
              finalCredit = Math.max(0, newCredit);
            }
            
            await prisma.student.update({
              where: { id: familyStudent.id },
              data: { credit: finalCredit }
            });
          }
        } else {
          // Single student payment - use existing applyPaymentToLessons function
          await applyPaymentToLessons(
            req.user.id,
            student.id,
            req.body.amount,
            payment.id
          );
        }
      }

      // Return payment response
      if (applyToFamily && familyId) {
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
          ...payment,
          isFamilyPayment: true,
          familyStudents: familyStudents.map(s => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName
          })),
          familyCredits,
          message: `Payment recorded for ${familyStudents.length} family member${familyStudents.length > 1 ? 's' : ''}`
        });
      } else {
        // Single student payment
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

    // For non-package payments, if amount changed, treat it as delete + create
    // This ensures clean reversal and reapplication
    if (!isPackagePayment && amountChanged) {
      // Step 1: Reverse the payment (same as deletion)
      // Delete all LessonPayment records for this payment
      const lessonPayments = await prisma.lessonPayment.findMany({
        where: { paymentId: existing.id },
        include: { lesson: true }
      });
      
      // Recalculate lesson paidAmount after removing this payment's contributions
      for (const lp of lessonPayments) {
        const otherPayments = await prisma.lessonPayment.findMany({
          where: { 
            lessonId: lp.lessonId,
            paymentId: { not: existing.id }
          },
          select: { amount: true }
        });
        const totalPaidAmount = otherPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const lessonPrice = lp.lesson.price || 0;
        const finalPaidAmount = Math.min(totalPaidAmount, lessonPrice);
        
        await prisma.lesson.update({
          where: { id: lp.lessonId },
          data: {
            paidAmount: finalPaidAmount,
            isPaid: finalPaidAmount >= lessonPrice
          }
        });
      }
      
      // Delete all LessonPayment records
      await prisma.lessonPayment.deleteMany({
        where: { paymentId: existing.id }
      });
      
      // Reverse credit - calculate how much credit was added from this payment
      const totalAppliedToLessons = lessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
      const creditAddedFromPayment = existing.amount - totalAppliedToLessons;
      
      if (existing.familyId) {
        // Family payment - reverse credit proportionally
        const familyStudents = await prisma.student.findMany({
          where: { familyId: existing.familyId, userId: req.user.id },
          select: { id: true }
        });
        
        if (creditAddedFromPayment > 0 && familyStudents.length > 0) {
          const creditPerStudent = creditAddedFromPayment / familyStudents.length;
          for (const student of familyStudents) {
            await prisma.student.update({
              where: { id: student.id },
              data: { credit: { decrement: creditPerStudent } }
            });
          }
        }
      } else {
        // Single student payment - reverse credit
        if (creditAddedFromPayment > 0) {
          await prisma.student.update({
            where: { id: existing.studentId },
            data: { credit: { decrement: creditAddedFromPayment } }
          });
        }
      }
      
      // Step 2: Update the payment amount
      await prisma.payment.update({
        where: { id: existing.id },
        data: { amount: req.body.amount }
      });
      
      // Step 3: Apply the new payment amount (same as creation)
      if (existing.familyId) {
        // Family payment - apply to all family members (same logic as create payment)
        const familyStudents = await prisma.student.findMany({
          where: { familyId: existing.familyId, userId: req.user.id },
          select: { id: true }
        });
        
        const totalAmount = req.body.amount;
        
        // Get all unpaid lessons for all family members, ordered by date
        const allUnpaidLessons = [];
        for (const familyStudent of familyStudents) {
          // Get all lessons and filter to only those that need more payment
          const allLessons = await prisma.lesson.findMany({
            where: {
              userId: req.user.id,
              studentId: familyStudent.id,
            },
            select: {
              id: true,
              dateTime: true,
              price: true,
              paidAmount: true,
              isPaid: true
            },
            orderBy: { dateTime: 'asc' }
          });
          
          // Filter to only lessons that need more payment (paidAmount < price)
          const unpaidLessons = allLessons.filter(lesson => {
            const lessonPrice = lesson.price || 0;
            const currentPaidAmount = lesson.paidAmount || 0;
            return currentPaidAmount < lessonPrice;
          });
          
          unpaidLessons.forEach(lesson => {
            allUnpaidLessons.push({
              ...lesson,
              studentId: familyStudent.id
            });
          });
        }
        
        // Sort all lessons chronologically
        allUnpaidLessons.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
        
        // Apply payment to lessons chronologically across all family members
        let paymentAmountRemaining = totalAmount;
        
        // Get current credits for all family members
        const familyCredits = {};
        let totalCreditAvailable = 0;
        for (const familyStudent of familyStudents) {
          const s = await prisma.student.findFirst({
            where: { id: familyStudent.id, userId: req.user.id }
          });
          familyCredits[familyStudent.id] = s?.credit || 0;
          totalCreditAvailable += familyCredits[familyStudent.id] || 0;
        }
        
        let availableAmount = paymentAmountRemaining + totalCreditAvailable;
        let totalCreditUsed = 0;
        
        // Apply available amount to lessons chronologically
        for (const lesson of allUnpaidLessons) {
          if (availableAmount <= 0) break;
          
          const lessonPrice = lesson.price || 0;
          const currentPaidAmount = lesson.paidAmount || 0;
          const remainingNeeded = lessonPrice - currentPaidAmount;
          
          if (remainingNeeded <= 0) {
            continue;
          }
          
          if (availableAmount >= remainingNeeded) {
            // Full payment for this lesson
            const creditAvailable = totalCreditAvailable - totalCreditUsed;
            const creditToUse = Math.min(creditAvailable, remainingNeeded);
            const paymentToUse = remainingNeeded - creditToUse;
            totalCreditUsed += creditToUse;
            paymentAmountRemaining -= paymentToUse;
            
            // Only create LessonPayment record if payment amount was used
            if (paymentToUse > 0) {
              await prisma.lessonPayment.upsert({
                where: {
                  lessonId_paymentId: {
                    lessonId: lesson.id,
                    paymentId: existing.id
                  }
                },
                update: {
                  amount: paymentToUse
                },
                create: {
                  lessonId: lesson.id,
                  paymentId: existing.id,
                  amount: paymentToUse
                }
              });
            }
            
            // Recalculate total paidAmount (from payments only, not credit)
            const allLessonPayments = await prisma.lessonPayment.findMany({
              where: { lessonId: lesson.id },
              select: { amount: true }
            });
            const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
            const finalPaidAmount = Math.min(totalPaidAmount, lessonPrice);
            
            await prisma.lesson.update({
              where: { id: lesson.id },
              data: { 
                isPaid: finalPaidAmount >= lessonPrice,
                paidAmount: finalPaidAmount
              }
            });
            
            availableAmount -= remainingNeeded;
          } else {
            // Partial payment
            const creditAvailable = totalCreditAvailable - totalCreditUsed;
            const creditToUse = Math.min(creditAvailable, availableAmount);
            const paymentToUse = availableAmount - creditToUse;
            totalCreditUsed += creditToUse;
            paymentAmountRemaining -= paymentToUse;
            
            // Only create LessonPayment record if payment amount was used
            if (paymentToUse > 0) {
              await prisma.lessonPayment.upsert({
                where: {
                  lessonId_paymentId: {
                    lessonId: lesson.id,
                    paymentId: existing.id
                  }
                },
                update: {
                  amount: paymentToUse
                },
                create: {
                  lessonId: lesson.id,
                  paymentId: existing.id,
                  amount: paymentToUse
                }
              });
            }
            
            // Recalculate total paidAmount (from payments only, not credit)
            const allLessonPayments = await prisma.lessonPayment.findMany({
              where: { lessonId: lesson.id },
              select: { amount: true }
            });
            const totalPaidAmount = allLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
            const finalPaidAmount = Math.min(totalPaidAmount, lessonPrice);
            
            await prisma.lesson.update({
              where: { id: lesson.id },
              data: { 
                isPaid: finalPaidAmount >= lessonPrice,
                paidAmount: finalPaidAmount
              }
            });
            
            availableAmount = 0;
            break;
          }
        }
        
        // Update credits for all family members (same logic as create payment)
        const remainingPaymentCredit = (paymentAmountRemaining || 0);
        const safeTotalCreditAvailable = (totalCreditAvailable || 0);
        const safeTotalCreditUsed = (totalCreditUsed || 0);
        const creditPerStudent = familyStudents.length > 0 
          ? (remainingPaymentCredit / familyStudents.length) 
          : 0;
        
        for (const familyStudent of familyStudents) {
          const studentCredit = (familyCredits[familyStudent.id] || 0);
          // Credit used for this student is proportional to their original credit
          let creditUsedForStudent = 0;
          if (studentCredit > 0 && safeTotalCreditAvailable > 0) {
            creditUsedForStudent = safeTotalCreditUsed * (studentCredit / safeTotalCreditAvailable);
          }
          // New credit = original credit - credit used + share of remaining payment
          const newCredit = studentCredit - creditUsedForStudent + creditPerStudent;
          
          // Ensure newCredit is a valid number
          let finalCredit = 0;
          if (typeof newCredit === 'number' && !isNaN(newCredit) && isFinite(newCredit)) {
            finalCredit = Math.max(0, newCredit);
          }
          
          await prisma.student.update({
            where: { id: familyStudent.id },
            data: { credit: finalCredit }
          });
        }
      } else {
        // Single student payment - apply using the same logic as create payment
        await applyPaymentToLessons(
          req.user.id,
          existing.studentId,
          req.body.amount,
          existing.id
        );
      }
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

    // Prepare update data - only include valid Payment model fields
    const updateData = {};
    
    // Only include fields that are actually provided
    if (req.body.amount !== undefined) {
      updateData.amount = req.body.amount;
    }
    if (req.body.method !== undefined) {
      updateData.method = req.body.method;
    }
    if (req.body.date !== undefined) {
      updateData.date = new Date(req.body.date);
    }
    if (req.body.notes !== undefined) {
      updateData.notes = req.body.notes;
    }
    
    // Only update studentId if it's provided and different
    if (req.body.studentId && req.body.studentId !== existing.studentId) {
      updateData.studentId = req.body.studentId;
    }
    
    // Handle familyId - if applyToFamily is true, set familyId from the student's family
    if (req.body.applyToFamily !== undefined) {
      if (req.body.applyToFamily) {
        // Get the student's familyId
        const student = await prisma.student.findFirst({
          where: { id: req.body.studentId || existing.studentId, userId: req.user.id },
          select: { familyId: true }
        });
        if (student && student.familyId) {
          updateData.familyId = student.familyId;
        } else {
          // If student doesn't have a family, clear familyId
          updateData.familyId = null;
        }
      } else {
        // If applyToFamily is false, clear familyId
        updateData.familyId = null;
      }
    }

    // Update the payment
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: updateData,
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

    // Verify lesson belongs to user and same student (or same family for family payments)
    let lesson;
    if (payment.familyId) {
      // For family payments, verify lesson belongs to a family member
      const familyStudents = await prisma.student.findMany({
        where: { familyId: payment.familyId, userId: req.user.id },
        select: { id: true }
      });
      const familyStudentIds = familyStudents.map(s => s.id);
      
      lesson = await prisma.lesson.findFirst({
        where: { 
          id: lessonId,
          userId: req.user.id,
          studentId: { in: familyStudentIds }
        }
      });
    } else {
      lesson = await prisma.lesson.findFirst({
        where: { 
          id: lessonId,
          userId: req.user.id,
          studentId: payment.studentId
        }
      });
    }

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found or does not belong to this student/family' });
    }

    // Calculate paid amount - use payment amount or remaining lesson price, whichever is smaller
    // But first, check how much of this payment is already allocated to other lessons
    const lessonPrice = lesson.price || 0;
    const currentPaidAmount = lesson.paidAmount || 0;
    const remainingNeeded = lessonPrice - currentPaidAmount;
    const paymentAmount = payment.amount || 0;
    
    // Calculate how much of this payment has already been allocated to other lessons
    // Also check if this lesson already has a link to this payment (for updates)
    const existingLessonPayments = await prisma.lessonPayment.findMany({
      where: { 
        paymentId: payment.id
      },
      select: { amount: true, lessonId: true }
    });
    
    // Calculate total allocated amount, but exclude any existing allocation to this lesson
    // (since we're about to update it)
    const alreadyAllocatedAmount = existingLessonPayments
      .filter(lp => lp.lessonId !== lessonId)
      .reduce((sum, lp) => sum + (lp.amount || 0), 0);
    
    const availablePaymentAmount = paymentAmount - alreadyAllocatedAmount;
    
    // Calculate amount to apply: minimum of available payment amount and remaining needed
    const amountToApply = Math.max(0, Math.min(availablePaymentAmount, remainingNeeded));
    
    if (amountToApply <= 0) {
      return res.status(400).json({ 
        message: `Payment has insufficient remaining amount. Payment total: $${paymentAmount.toFixed(2)}, already allocated: $${alreadyAllocatedAmount.toFixed(2)}, available: $${availablePaymentAmount.toFixed(2)}` 
      });
    }

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
          select: {
            amount: true,
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
              },
              orderBy: { dateTime: 'desc' }
            });
            
            const partiallyPaidLessons = await prisma.lesson.findMany({
              where: {
                userId: req.user.id,
                studentId: payment.studentId,
                isPaid: false,
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
                },
                orderBy: { dateTime: 'desc' } // Newest first - reverse order
              });
              
              // Also get lessons with paidAmount > 0 (partially paid) that might not be marked as isPaid
              const partiallyPaidLessons = await prisma.lesson.findMany({
                where: {
                  userId: req.user.id,
                  studentId: payment.studentId,
                  isPaid: false,
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
                    },
                    orderBy: { dateTime: 'desc' }
                  });
                  
                  const partiallyPaidLessons = await prisma.lesson.findMany({
                    where: {
                      userId: req.user.id,
                      studentId: payment.studentId,
                      isPaid: false,
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
        if (payment.familyId) {
          // For family payments, reverse from all family members
          const familyStudents = await prisma.student.findMany({
            where: { familyId: payment.familyId, userId: req.user.id },
            select: { id: true }
          });
          
          // Get all lessons linked to this payment across all family members
          const lessonPayments = await prisma.lessonPayment.findMany({
            where: { paymentId: payment.id },
            include: { lesson: true }
          });
          
          // Reverse each lesson payment
          for (const lp of lessonPayments) {
            // Recalculate lesson paidAmount without this payment
            const otherPayments = await prisma.lessonPayment.findMany({
              where: { 
                lessonId: lp.lessonId,
                paymentId: { not: payment.id }
              },
              select: { amount: true }
            });
            const totalPaidAmount = otherPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const lessonPrice = lp.lesson.price || 0;
            
            await prisma.lesson.update({
              where: { id: lp.lessonId },
              data: {
                isPaid: totalPaidAmount >= lessonPrice,
                paidAmount: totalPaidAmount
              }
            });
          }
          
          // Delete all LessonPayment records for this payment
          await prisma.lessonPayment.deleteMany({
            where: { paymentId: payment.id }
          });
          
          // Calculate credit to reverse - split across family members
          const totalReversed = lessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
          const creditToReverse = payment.amount - totalReversed;
          
          if (creditToReverse > 0 && familyStudents.length > 0) {
            const creditPerStudent = creditToReverse / familyStudents.length;
            for (const student of familyStudents) {
              await prisma.student.update({
                where: { id: student.id },
                data: { credit: { decrement: creditPerStudent } }
              });
            }
          }
        } else {
          // Single student payment - use existing function
        const reversalResult = await reversePaymentApplication(
          req.user.id,
          payment.studentId,
          payment.amount
        );
        console.log('Payment reversal result:', reversalResult);
        }
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

