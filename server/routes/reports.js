import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

router.use(authenticateToken);

// Helpers
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// Summary for dashboard boxes
router.get('/summary', async (req, res) => {
  try {
    const { start, end } = getCurrentMonthRange();
      const now = new Date();

    const userId = req.user.id;

    // Total income this month
    const paymentsThisMonth = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { userId, date: { gte: start, lte: end } },
    });

    // Lessons completed this month (past and not canceled count as completed)
    const lessonsCompleted = await prisma.lesson.count({
      where: {
        userId,
        dateTime: { gte: start, lte: end },
        dateTime: { lt: now }
      }
    });

    // Total students (all time)
    const totalStudents = await prisma.student.count({ where: { userId } });

    // Outstanding balances overall: billed (completed lessons price) - paid (all payments)
    // Compute billed from completed or past-scheduled, with fallback to student's price if lesson.price null/0
    const billedLessons = await prisma.lesson.findMany({
      where: {
        userId,
        dateTime: { lt: now }
      },
      select: { price: true, studentId: true },
    });
    const studentPrices = new Map(
      (await prisma.student.findMany({ where: { userId }, select: { id: true, pricePerLesson: true } }))
        .map(s => [s.id, s.pricePerLesson || 0])
    );
    const billedTotal = billedLessons.reduce((sum, l) => {
      const p = (l.price ?? 0) || (studentPrices.get(l.studentId) || 0);
      return sum + p;
    }, 0);
    const paidAgg = await prisma.payment.aggregate({ where: { userId }, _sum: { amount: true } });

    const outstandingBalances = billedTotal - (paidAgg._sum.amount ?? 0);

    res.json({
      totalIncome: paymentsThisMonth._sum.amount ?? 0,
      lessonsCompleted,
      outstandingBalances, // allow negative balances to be reported
      totalStudents,
    });
  } catch (error) {
    console.error('Reports summary error:', error);
    res.status(500).json({ message: 'Failed to load reports summary' });
  }
});

// Outstanding balances per student (shows family name if available)
// Only shows entries with outstanding balance (balanceDue > 0)
router.get('/outstanding', async (req, res) => {
  try {
    
    // Fetch necessary data
    const now = new Date();
    const userId = req.user.id;
    const [students, lessons, payments] = await Promise.all([
      prisma.student.findMany({ 
        where: { 
          userId,
          archived: false // Only show active students
        }, 
        select: { id: true, firstName: true, lastName: true, familyId: true } 
      }),
      prisma.lesson.findMany({
        where: {
          userId,
          dateTime: { lt: now }
        },
        select: { id: true, studentId: true, price: true },
      }),
      prisma.payment.findMany({
        where: { userId },
        select: { id: true, studentId: true, familyId: true, amount: true, date: true },
      }),
    ]);

    // Build maps
    const studentMap = new Map(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
    const studentFamilyMap = new Map(students.map(s => [s.id, s.familyId]));
    
    const lessonsByStudent = new Map();
    for (const l of lessons) {
      const arr = lessonsByStudent.get(l.studentId) || [];
      arr.push(l);
      lessonsByStudent.set(l.studentId, arr);
    }
    // Calculate actual paid amounts per student by looking at LessonPayment records
    // This ensures family payments are correctly allocated based on which lessons they actually paid for
    const lessonPayments = await prisma.lessonPayment.findMany({
      where: {
        payment: {
          userId
        }
      },
      include: {
        lesson: {
          select: { studentId: true }
        },
        payment: {
          select: { id: true, amount: true, date: true, studentId: true, familyId: true }
        }
      }
    });
    
    // Build map of student -> array of LessonPayment records
    const paymentsByStudent = new Map();
    const lastPaymentDates = new Map(); // Track last payment date per student
    
    for (const lp of lessonPayments) {
      const studentId = lp.lesson.studentId;
      if (!paymentsByStudent.has(studentId)) {
        paymentsByStudent.set(studentId, []);
      }
      
      // Add the payment info (but only count the amount applied to this lesson)
      const paymentInfo = {
        id: lp.payment.id,
        amount: lp.amount, // This is the amount from this LessonPayment, not the full payment amount
        date: lp.payment.date,
        studentId: lp.payment.studentId,
        familyId: lp.payment.familyId
      };
      paymentsByStudent.get(studentId).push(paymentInfo);
      
      // Track last payment date
      const paymentDate = new Date(lp.payment.date).getTime();
      const currentLastDate = lastPaymentDates.get(studentId);
      if (!currentLastDate || paymentDate > currentLastDate) {
        lastPaymentDates.set(studentId, paymentDate);
      }
    }
    
    // Also include payments that might not be linked to lessons yet (for lastPaymentDate calculation)
    // But don't count their amounts in the paid calculation since they're not applied
    for (const p of payments) {
      if (p.studentId) {
        // Individual payment - update last payment date if not already set
        if (!lastPaymentDates.has(p.studentId)) {
          lastPaymentDates.set(p.studentId, new Date(p.date).getTime());
        } else {
          const paymentDate = new Date(p.date).getTime();
          const currentLastDate = lastPaymentDates.get(p.studentId);
          if (paymentDate > currentLastDate) {
            lastPaymentDates.set(p.studentId, paymentDate);
          }
        }
      } else if (p.familyId) {
        // Family payment - update last payment date for all family members
        const familyStudentIds = students.filter(s => s.familyId === p.familyId).map(s => s.id);
        familyStudentIds.forEach(studentId => {
          if (!lastPaymentDates.has(studentId)) {
            lastPaymentDates.set(studentId, new Date(p.date).getTime());
          } else {
            const paymentDate = new Date(p.date).getTime();
            const currentLastDate = lastPaymentDates.get(studentId);
            if (paymentDate > currentLastDate) {
              lastPaymentDates.set(studentId, paymentDate);
            }
          }
        });
      }
    }

    const studentPriceMap = new Map(
      students.map(s => [s.id, 0])
    );
    const studentPriceFromDb = await prisma.student.findMany({ 
      where: { 
        userId,
        archived: false // Only active students
      }, 
      select: { id: true, pricePerLesson: true } 
    });
    studentPriceFromDb.forEach(s => studentPriceMap.set(s.id, s.pricePerLesson || 0));

    // Group by student - show family name if available, otherwise personal name
      // Build a map of family names for students with families
      const familyNameMap = new Map();
      const familyGroups = new Map();
      
      students.forEach(s => {
        if (s.familyId) {
          if (!familyGroups.has(s.familyId)) {
            familyGroups.set(s.familyId, []);
          }
          familyGroups.get(s.familyId).push(s);
        }
      });
      
      // Generate family names
      familyGroups.forEach((familyMembers, familyId) => {
        // Get unique last names in the family
        const lastNames = [...new Set(familyMembers.map(m => m.lastName).filter(Boolean))];
        
        // If all members have the same last name, use "Lastname Family"
        // Otherwise, list all names
        if (lastNames.length === 1 && lastNames[0]) {
          const familyName = `${lastNames[0]} Family`;
          familyMembers.forEach(m => {
            familyNameMap.set(m.id, familyName);
          });
        } else {
          // Multiple last names or no last names - use all names
          const familyName = familyMembers.map(m => `${m.firstName} ${m.lastName}`).join(', ');
          familyMembers.forEach(m => {
            familyNameMap.set(m.id, familyName);
          });
        }
      });
      
      const rows = students.map(s => {
        const sLessons = lessonsByStudent.get(s.id) || [];
        const sLessonPayments = paymentsByStudent.get(s.id) || [];
        const totalBilled = sLessons.reduce((sum, l) => sum + (((l.price ?? 0) || studentPriceMap.get(s.id) || 0)), 0);
        // Sum up the actual amounts from LessonPayment records (this correctly handles family payments)
        const paid = sLessonPayments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
        const balanceDue = totalBilled - paid;
        const lastPaymentDate = lastPaymentDates.get(s.id)
          ? new Date(lastPaymentDates.get(s.id))
          : null;
        
        // Use family name if available, otherwise use personal name
        const displayName = familyNameMap.get(s.id) || studentMap.get(s.id) || 'Unknown';
        
        return {
          studentId: s.id,
          studentName: displayName,
          lessonsCompleted: sLessons.length,
          totalBilled,
          paid,
          balanceDue,
          lastPaymentDate,
        };
      });

      // Sort by balance desc
      rows.sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0));
      
      // Filter to only show entries with outstanding balance (balanceDue > 0)
      const filteredRows = rows.filter(row => (row.balanceDue || 0) > 0);

      res.json(filteredRows);
  } catch (error) {
    console.error('Reports outstanding error:', error);
    res.status(500).json({ message: 'Failed to load outstanding balances' });
  }
});

// Recent payments (last 10, date desc)
router.get('/payments/recent', async (req, res) => {
  try {
    const items = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
      take: 10,
      include: { student: { select: { firstName: true, lastName: true } } },
    });
    const data = items.map(p => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      method: p.method,
      studentName: `${p.student?.firstName ?? ''} ${p.student?.lastName ?? ''}`.trim(),
    }));
    res.json(data);
  } catch (error) {
    console.error('Reports recent payments error:', error);
    res.status(500).json({ message: 'Failed to load recent payments' });
  }
});

// Get monthly report
router.get('/monthly', async (req, res) => {
  try {
    const { month, year, studentId } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const userId = req.user.id;

    // Get all lessons for the month
    const lessons = await prisma.lesson.findMany({
      where: {
        userId,
        dateTime: { gte: startDate, lte: endDate },
        ...(studentId ? { studentId } : {})
      },
      include: {
        student: true
      }
    });

    // Get all payments
    const payments = await prisma.payment.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        ...(studentId ? { studentId } : {})
      },
      include: {
        student: true
      }
    });

    // Get all students with activity this month
    const students = await prisma.student.findMany({
      where: {
        userId,
        ...(studentId ? { id: studentId } : {})
      },
      include: {
        lessons: { where: { userId, dateTime: { gte: startDate, lte: endDate } } },
        payments: { where: { userId, date: { gte: startDate, lte: endDate } } }
      }
    });

    const totalLessons = lessons.length;
    const completedLessons = lessons.length;
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalEarned = lessons.reduce((sum, l) => sum + l.price, 0);

    const report = {
      period: {
        month: parseInt(month),
        year: parseInt(year)
      },
      summary: {
        totalLessons,
        completedLessons,
        cancelledLessons: 0,
        totalRevenue,
        totalEarned,
        outstandingBalance: totalEarned - totalRevenue
      },
      students: students.map(s => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        lessons: s.lessons.length,
        revenue: s.payments.reduce((sum, p) => sum + p.amount, 0)
      })),
      lessons,
      payments
    };

    res.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

// Per-family monthly statement (aggregates all students in a family)
router.get('/monthly-family', async (req, res) => {
  try {
    const { month, year, familyId } = req.query;
    if (!month || !year || !familyId) {
      return res.status(400).json({ message: 'familyId, month and year are required' });
    }

    const m = parseInt(month);
    const y = parseInt(year);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    const now = new Date();
    const userId = req.user.id;

    // Get all students in this family
    const familyStudents = await prisma.student.findMany({
      where: { familyId, userId },
      select: { id: true, firstName: true, lastName: true, pricePerLesson: true }
    });

    if (familyStudents.length === 0) {
      return res.status(404).json({ message: 'Family not found' });
    }

    const studentIds = familyStudents.map(s => s.id);
    const studentPriceMap = new Map(familyStudents.map(s => [s.id, s.pricePerLesson || 0]));

    // Previous balance: billed through end of prior month minus payments through end of prior month
    const prevEnd = new Date(start.getTime() - 1);

    const prevLessons = await prisma.lesson.findMany({
      where: {
        userId,
        studentId: { in: studentIds },
        dateTime: { lte: prevEnd, lt: now }
      },
      select: { price: true, studentId: true }
    });
    const prevBilled = prevLessons.reduce((sum, l) => {
      const price = (l.price ?? 0) || studentPriceMap.get(l.studentId) || 0;
      return sum + price;
    }, 0);

    const prevPaymentsAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { userId, studentId: { in: studentIds }, date: { lte: prevEnd } }
    });
    const prevPaid = prevPaymentsAgg._sum.amount || 0;
    const previousBalance = prevBilled - prevPaid;

    // In-month billed (completed or past), not canceled
    const monthLessons = await prisma.lesson.findMany({
      where: {
        userId,
        studentId: { in: studentIds },
        dateTime: { gte: start, lte: end },
      },
      include: { student: { select: { firstName: true, lastName: true } } }
    });

    const billedLessons = monthLessons.filter(l => l.dateTime < now);
    const billedThisMonth = billedLessons.reduce((sum, l) => {
      const price = (l.price ?? 0) || studentPriceMap.get(l.studentId) || 0;
      return sum + price;
    }, 0);

    // Payments this month
    const payments = await prisma.payment.findMany({
      where: { userId, studentId: { in: studentIds }, date: { gte: start, lte: end } },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: { date: 'desc' }
    });
    const paidThisMonth = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const endingBalance = previousBalance + billedThisMonth - paidThisMonth;
    const familyName = familyStudents.map(s => `${s.firstName} ${s.lastName}`).join(', ');

    res.json({
      familyName,
      familyId,
      month: m,
      year: y,
      previousBalance,
      billedThisMonth,
      paidThisMonth,
      endingBalance,
      lessonsThisMonth: monthLessons,
      payments,
      studentCount: familyStudents.length
    });
  } catch (error) {
    console.error('Monthly family report error:', error);
    res.status(500).json({ message: 'Failed to load monthly family report' });
  }
});

// Per-student monthly statement
router.get('/monthly-student', async (req, res) => {
  try {
    const { month, year, studentId } = req.query;
    if (!month || !year || !studentId) {
      return res.status(400).json({ message: 'studentId, month and year are required' });
    }

    const m = parseInt(month);
    const y = parseInt(year);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    const now = new Date();
    const userId = req.user.id;

    // Verify student belongs to user
    const student = await prisma.student.findFirst({ 
      where: { id: studentId, userId }, 
      select: { pricePerLesson: true, firstName: true, lastName: true, credit: true } 
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const fallbackPrice = student?.pricePerLesson || 0;

    // Previous balance: billed through end of prior month minus payments through end of prior month
    const prevEnd = new Date(start.getTime() - 1);

    // Count past lessons in previous balance
    // If a lesson is on the calendar and in the past, it's billable
    const prevLessons = await prisma.lesson.findMany({
      where: {
        userId,
        studentId,
        dateTime: { lte: prevEnd }
      },
      select: { price: true, dateTime: true }
    });
    const prevBilled = prevLessons.reduce((sum, l) => sum + (l.price ?? fallbackPrice), 0);
    
    // Debug logging for previous balance
    if (prevBilled > 0) {
      console.log(`[Monthly Student Report] Previous balance calculation for ${student.firstName} ${student.lastName}:`);
      console.log(`[Monthly Student Report] Previous lessons found: ${prevLessons.length}`);
      console.log(`[Monthly Student Report] prevBilled: $${prevBilled.toFixed(2)}`);
      console.log(`[Monthly Student Report] Previous lessons details:`, prevLessons.map(l => ({
        dateTime: l.dateTime,
        price: l.price ?? fallbackPrice
      })));
    }

    const prevPaymentsAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { userId, studentId, date: { lte: prevEnd } }
    });
    const prevPaid = prevPaymentsAgg._sum.amount || 0;
    const previousBalance = prevBilled - prevPaid;

    // In-month lessons
    const monthLessons = await prisma.lesson.findMany({
      where: {
        userId,
        studentId,
        dateTime: { gte: start, lte: end }
      },
      include: { student: { select: { firstName: true, lastName: true } } }
    });

    // Bill lessons that are in the past
    // If a lesson is on the calendar and its date has passed, it's billable
    const billedLessons = monthLessons.filter(l => l.dateTime < now);
    const billedThisMonth = billedLessons.reduce((sum, l) => sum + (l.price ?? fallbackPrice), 0);

    // Debug logging for billing calculation
    if (monthLessons.length > 0 || billedThisMonth > 0) {
      console.log(`[Monthly Student Report] Student: ${student.firstName} ${student.lastName}, Month: ${m}/${y}`);
      console.log(`[Monthly Student Report] Total lessons in month (not cancelled): ${monthLessons.length}`);
      console.log(`[Monthly Student Report] Billed lessons (completed or past): ${billedLessons.length}`);
      console.log(`[Monthly Student Report] billedThisMonth: $${billedThisMonth.toFixed(2)}`);
      console.log(`[Monthly Student Report] Lesson details:`, monthLessons.map(l => ({
        id: l.id,
        dateTime: l.dateTime,
        price: l.price,
        isPast: l.dateTime < now,
        willBeBilled: l.dateTime < now
      })));
    }

    // All lessons in month (not canceled) for display
    const lessonsThisMonth = monthLessons; // includes past and future, statuses as-is

    // Payments this month
    const payments = await prisma.payment.findMany({
      where: { userId, studentId, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' }
    });
    const paidThisMonth = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Ending balance = billed - paid, but we also need to account for credit
    // Credit is money that has been paid but not yet applied to lessons
    // So endingBalance should be: billed - paid, and separately show credit available
    const endingBalance = previousBalance + billedThisMonth - paidThisMonth;
    const creditBalance = student.credit || 0;

    // Debug logging for final result
    if (billedThisMonth > 0 || previousBalance !== 0) {
      console.log(`[Monthly Student Report] Final calculation for ${student.firstName} ${student.lastName}:`);
      console.log(`[Monthly Student Report] previousBalance: $${previousBalance.toFixed(2)}`);
      console.log(`[Monthly Student Report] billedThisMonth: $${billedThisMonth.toFixed(2)}`);
      console.log(`[Monthly Student Report] paidThisMonth: $${paidThisMonth.toFixed(2)}`);
      console.log(`[Monthly Student Report] endingBalance: $${endingBalance.toFixed(2)}`);
      console.log(`[Monthly Student Report] lessonsThisMonth count: ${lessonsThisMonth.length}`);
      console.log(`[Monthly Student Report] payments count: ${payments.length}`);
    }

    res.json({
      studentName: `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim(),
      month: m,
      year: y,
      previousBalance,
      billedThisMonth,
      paidThisMonth,
      endingBalance,
      creditBalance, // Credit available to apply to future lessons
      lessonsThisMonth,
      payments
    });
  } catch (error) {
    console.error('Monthly student report error:', error);
    res.status(500).json({ message: 'Failed to load monthly student report' });
  }
});

// Monthly report for all students
router.get('/monthly-all', async (req, res) => {
  try {
    const { month, year, studentId, familyId, startDate, endDate } = req.query;
    
    // Support both month/year and date range
    let start, end, prevEnd, m, y;
    if (startDate && endDate) {
      // Date range mode
      start = new Date(startDate);
      end = new Date(endDate);
      // Set end to end of day
      end.setHours(23, 59, 59, 999);
      // Previous period is before start date
      prevEnd = new Date(start.getTime() - 1);
      // Extract month and year from start date for response
      m = start.getMonth() + 1;
      y = start.getFullYear();
    } else if (month && year) {
      // Month/year mode (existing behavior)
      m = parseInt(month);
      y = parseInt(year);
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
      prevEnd = new Date(start.getTime() - 1);
    } else {
      return res.status(400).json({ message: 'Either month/year or startDate/endDate are required' });
    }
    
    const now = new Date();
    const userId = req.user.id;

    // Handle familyId filtering
    let familyStudentIds = [];
    if (familyId) {
      // Verify family exists and get all family members
      const familyStudents = await prisma.student.findMany({
        where: { 
          familyId: familyId,
          userId,
          archived: false
        },
        select: { id: true }
      });
      if (familyStudents.length === 0) {
        return res.status(404).json({ message: 'Family not found' });
      }
      familyStudentIds = familyStudents.map(s => s.id);
    }

    // Build lesson filter - include studentId or familyId if provided
    const lessonFilter = {
      userId,
      dateTime: { gte: start, lte: end }
    };
    if (familyId && familyStudentIds.length > 0) {
      lessonFilter.studentId = { in: familyStudentIds };
    } else if (studentId) {
      // Verify student belongs to user
      const student = await prisma.student.findFirst({
        where: { id: studentId, userId }
      });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      lessonFilter.studentId = studentId;
    }

    // First, get all lessons for this month to find which students had lessons
    const monthLessonsForFilter = await prisma.lesson.findMany({
      where: lessonFilter,
      select: { studentId: true }
    });

    // Extract unique student IDs who had lessons this month
    const studentIdsWithLessons = [...new Set(monthLessonsForFilter.map(l => l.studentId))];

    // If no students had lessons this month, return empty report
    if (studentIdsWithLessons.length === 0) {
      return res.json({
        month: m,
        year: y,
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        totals: {
          previousBalance: 0,
          billedThisMonth: 0,
          paidThisMonth: 0,
          endingBalance: 0,
          totalLessons: 0,
          totalBilledLessons: 0,
          totalPayments: 0
        },
        students: []
      });
    }

    // Build student filter
    const studentFilter = { 
      userId,
      archived: false,
      id: { in: studentIdsWithLessons }
    };
    if (familyId && familyStudentIds.length > 0) {
      // Filter to only family members who had lessons
      studentFilter.id = { in: studentIdsWithLessons.filter(id => familyStudentIds.includes(id)) };
    } else if (studentId) {
      studentFilter.id = studentId; // Override to filter by specific student
    }

    // Get only non-archived students who had lessons this month (or specific student if filtered)
    const students = await prisma.student.findMany({
      where: studentFilter,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        pricePerLesson: true,
        credit: true
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    // If filtering by family, aggregate at family level
    if (familyId && familyStudentIds.length > 0) {
      // Get all family students with full details
      const familyStudents = await prisma.student.findMany({
        where: { 
          familyId: familyId,
          userId,
          archived: false
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          pricePerLesson: true,
          credit: true
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      });
      
      const allFamilyStudentIds = familyStudents.map(s => s.id);
      const studentPriceMap = new Map(familyStudents.map(s => [s.id, s.pricePerLesson || 0]));
      const familyName = familyStudents.map(s => `${s.firstName} ${s.lastName}`).join(', ');

      // Previous balance: all family members combined
      const prevLessons = await prisma.lesson.findMany({
        where: {
          userId,
          studentId: { in: allFamilyStudentIds },
          dateTime: { lte: prevEnd }
        },
        select: { price: true, dateTime: true, studentId: true }
      });
      const prevBilled = prevLessons.reduce((sum, l) => {
        const price = l.price ?? studentPriceMap.get(l.studentId) ?? 0;
        return sum + price;
      }, 0);

      // Previous payments: include family payments (by familyId) and individual student payments
      // Family payments should only be counted once
      const prevFamilyPayments = await prisma.payment.findMany({
        where: { 
          userId, 
          familyId: familyId,
          date: { lte: prevEnd }
        },
        select: { amount: true }
      });
      const prevIndividualPayments = await prisma.payment.findMany({
        where: { 
          userId, 
          studentId: { in: allFamilyStudentIds },
          familyId: null, // Only individual payments
          date: { lte: prevEnd }
        },
        select: { amount: true }
      });
      const prevPaid = prevFamilyPayments.reduce((sum, p) => sum + (p.amount || 0), 0) +
                      prevIndividualPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const previousBalance = prevBilled - prevPaid;

      // In-month lessons: all family members
      const monthLessons = await prisma.lesson.findMany({
        where: {
          userId,
          studentId: { in: allFamilyStudentIds },
          dateTime: { gte: start, lte: end }
        },
        include: {
          student: { select: { firstName: true, lastName: true } }
        },
        orderBy: { dateTime: 'asc' }
      });

      // Bill lessons that are in the past
      const billedLessons = monthLessons.filter(l => l.dateTime < now);
      const billedThisMonth = billedLessons.reduce((sum, l) => {
        const price = l.price ?? studentPriceMap.get(l.studentId) ?? 0;
        return sum + price;
      }, 0);

      // Payments this month: family payments (counted once) + individual payments
      const familyPayments = await prisma.payment.findMany({
        where: { 
          userId, 
          familyId: familyId,
          date: { gte: start, lte: end }
        },
        include: {
          student: { select: { firstName: true, lastName: true } }
        },
        orderBy: { date: 'desc' }
      });
      const individualPayments = await prisma.payment.findMany({
        where: { 
          userId, 
          studentId: { in: allFamilyStudentIds },
          familyId: null, // Only individual payments
          date: { gte: start, lte: end }
        },
        include: {
          student: { select: { firstName: true, lastName: true } }
        },
        orderBy: { date: 'desc' }
      });
      const allPayments = [...familyPayments, ...individualPayments];
      const paidThisMonth = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Combined credit for all family members
      const creditBalance = familyStudents.reduce((sum, s) => sum + (s.credit || 0), 0);

      // Ending balance
      const endingBalance = previousBalance + billedThisMonth - paidThisMonth;

      // Return single aggregated family row
      const familyReport = {
        familyId: familyId,
        familyName: familyName,
        studentCount: familyStudents.length,
        studentIds: allFamilyStudentIds,
        previousBalance,
        billedThisMonth,
        paidThisMonth,
        endingBalance,
        creditBalance,
        lessonsCount: monthLessons.length,
        billedLessonsCount: billedLessons.length,
        paymentsCount: allPayments.length, // Count family payments once, not per student
        lessons: monthLessons,
        payments: allPayments
      };

      res.json({
        month: m,
        year: y,
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        totals: {
          previousBalance,
          billedThisMonth,
          paidThisMonth,
          endingBalance,
          totalLessons: monthLessons.length,
          totalBilledLessons: billedLessons.length,
          totalPayments: allPayments.length
        },
        students: [familyReport] // Return as single item in students array for consistency
      });
      return;
    }

    // Process each student individually (for non-family reports)
    const studentReports = await Promise.all(
      students.map(async (student) => {
        const fallbackPrice = student.pricePerLesson || 0;

        // Previous balance: billed through end of prior month minus payments through end of prior month
        const prevLessons = await prisma.lesson.findMany({
          where: {
            userId,
            studentId: student.id,
            dateTime: { lte: prevEnd }
          },
          select: { price: true, dateTime: true }
        });
        const prevBilled = prevLessons.reduce((sum, l) => sum + (l.price ?? fallbackPrice), 0);

        // Previous payments: include family payments for this student's family + individual payments
        let prevPaid = 0;
        if (student.familyId) {
          const prevFamilyPayments = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: { userId, familyId: student.familyId, date: { lte: prevEnd } }
          });
          prevPaid += prevFamilyPayments._sum.amount || 0;
        }
        const prevIndividualPayments = await prisma.payment.aggregate({
          _sum: { amount: true },
          where: { userId, studentId: student.id, familyId: null, date: { lte: prevEnd } }
        });
        prevPaid += prevIndividualPayments._sum.amount || 0;
        
        const previousBalance = prevBilled - prevPaid;

        // In-month lessons
        const monthLessons = await prisma.lesson.findMany({
          where: {
            userId,
            studentId: student.id,
            dateTime: { gte: start, lte: end }
          },
          include: {
            student: { select: { firstName: true, lastName: true } }
          },
          orderBy: { dateTime: 'asc' }
        });

        // Bill lessons that are in the past
        const billedLessons = monthLessons.filter(l => l.dateTime < now);
        const billedThisMonth = billedLessons.reduce((sum, l) => sum + (l.price ?? fallbackPrice), 0);

        // Payments this month: include family payments for this student's family + individual payments
        let paidThisMonth = 0;
        let payments = [];
        if (student.familyId) {
          const familyPayments = await prisma.payment.findMany({
            where: { userId, familyId: student.familyId, date: { gte: start, lte: end } },
            orderBy: { date: 'desc' }
          });
          paidThisMonth += familyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          payments.push(...familyPayments);
        }
        const individualPayments = await prisma.payment.findMany({
          where: { userId, studentId: student.id, familyId: null, date: { gte: start, lte: end } },
          orderBy: { date: 'desc' }
        });
        paidThisMonth += individualPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        payments.push(...individualPayments);
        payments.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Ending balance
        const endingBalance = previousBalance + billedThisMonth - paidThisMonth;
        const creditBalance = student.credit || 0;

        return {
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`.trim(),
          previousBalance,
          billedThisMonth,
          paidThisMonth,
          endingBalance,
          creditBalance,
          lessonsCount: monthLessons.length,
          billedLessonsCount: billedLessons.length,
          paymentsCount: payments.length,
          lessons: monthLessons,
          payments
        };
      })
    );

    // Calculate totals
    const totals = {
      previousBalance: studentReports.reduce((sum, s) => sum + s.previousBalance, 0),
      billedThisMonth: studentReports.reduce((sum, s) => sum + s.billedThisMonth, 0),
      paidThisMonth: studentReports.reduce((sum, s) => sum + s.paidThisMonth, 0),
      endingBalance: studentReports.reduce((sum, s) => sum + s.endingBalance, 0),
      totalLessons: studentReports.reduce((sum, s) => sum + s.lessonsCount, 0),
      totalBilledLessons: studentReports.reduce((sum, s) => sum + s.billedLessonsCount, 0),
      totalPayments: studentReports.reduce((sum, s) => sum + s.paymentsCount, 0)
    };

    res.json({
      month: m,
      year: y,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      totals,
      students: studentReports
    });
  } catch (error) {
    console.error('Monthly all students report error:', error);
    res.status(500).json({ message: 'Failed to load monthly report for all students' });
  }
});

// Package tracking report
router.get('/packages', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query; // Optional filter: 'active', 'inactive', 'all' (default: 'all')

    // Build where clause with optional status filter
    const where = { userId };
    
    // Filter by status if provided
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }
    // If status is 'all' or not provided, show all packages

    console.log(`[Package Report] Fetching packages for userId: ${userId}, status filter: ${status || 'all'}, where clause:`, JSON.stringify(where));

    // Get all packages with student info
    const packages = await prisma.package.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { purchasedAt: 'desc' }
    });

    console.log(`[Package Report] Found ${packages.length} packages`);
    if (packages.length > 0) {
      console.log(`[Package Report] Package IDs:`, packages.map(p => ({ id: p.id, student: p.student ? `${p.student.firstName} ${p.student.lastName}` : 'NO STUDENT', isActive: p.isActive })));
    }

    // Enrich packages with calculated fields, recalculating hoursUsed from actual linked lessons
    const enrichedPackages = await Promise.all(packages.map(async (pkg) => {
      try {
        console.log(`[Package Report] Processing package ${pkg.id} for student ${pkg.student ? `${pkg.student.firstName} ${pkg.student.lastName}` : 'UNKNOWN'}`);
        
        // If student is missing, try to fetch it
        if (!pkg.student && pkg.studentId) {
          console.log(`[Package Report] Package ${pkg.id} has studentId ${pkg.studentId} but no student relation, fetching...`);
          const student = await prisma.student.findUnique({
            where: { id: pkg.studentId },
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          });
          if (student) {
            pkg.student = student;
            console.log(`[Package Report] Found student for package ${pkg.id}: ${student.firstName} ${student.lastName}`);
          } else {
            console.log(`[Package Report] WARNING: Student ${pkg.studentId} not found for package ${pkg.id}`);
          }
        }
        
        // Sync purchasedAt with payment date if package has a linked payment
      if (pkg.paymentId) {
        const payment = await prisma.payment.findUnique({
          where: { id: pkg.paymentId },
          select: { date: true }
        });
        if (payment) {
          const paymentDate = new Date(payment.date);
          const packageDate = new Date(pkg.purchasedAt);
          // Compare dates (ignoring time)
          const paymentDateStr = paymentDate.toISOString().split('T')[0];
          const packageDateStr = packageDate.toISOString().split('T')[0];
          if (paymentDateStr !== packageDateStr) {
            console.log(`[Package Report] Syncing purchasedAt for package ${pkg.id}: ${packageDateStr} -> ${paymentDateStr}`);
            await prisma.package.update({
              where: { id: pkg.id },
              data: { purchasedAt: payment.date }
            });
            // Update the local object so the report shows the correct date
            pkg.purchasedAt = payment.date;
          }
        }
      }
      
      // Use the database hoursUsed value as the source of truth
      // (It may include hours from partially paid lessons that aren't linked to this package)
      const actualHoursUsed = pkg.hoursUsed || 0;
      
      // Also calculate from linked lessons for comparison/reporting
      const linkedLessons = await prisma.lesson.findMany({
        where: {
          userId,
          packageId: pkg.id
        },
        select: {
          duration: true
        }
      });
      
      const hoursFromLinkedLessons = linkedLessons.reduce((sum, lesson) => {
        return sum + (lesson.duration || 0) / 60; // Convert minutes to hours
      }, 0);

      // Check if package is fully used based on database hoursUsed value
      // Use small threshold (0.01) to account for floating point precision issues
      const hoursRemaining = pkg.totalHours - actualHoursUsed;
      const isFullyUsed = hoursRemaining <= 0.01;
      
      // If package is fully used (or very close to fully used), mark it as inactive
      if (isFullyUsed && pkg.isActive) {
        // Also ensure hoursUsed is set to exactly totalHours to avoid precision issues
        await prisma.package.update({
          where: { id: pkg.id },
          data: { 
            isActive: false,
            hoursUsed: pkg.totalHours // Set to exact total to avoid precision issues
          }
        });
        console.log(`[Package Report] Package ${pkg.id} is fully used (${actualHoursUsed.toFixed(2)}/${pkg.totalHours} hours), marking as inactive and setting hoursUsed to ${pkg.totalHours}`);
      }
        const packageHourlyRate = pkg.price / pkg.totalHours;
        const utilizationPercent = pkg.totalHours > 0 ? (actualHoursUsed / pkg.totalHours) * 100 : 0;
        const isExpired = pkg.expiresAt ? new Date(pkg.expiresAt) < new Date() : false;
        // isFullyUsed already calculated above

        return {
          ...pkg,
          hoursUsed: actualHoursUsed, // Use recalculated value
          hoursRemaining,
          packageHourlyRate,
          utilizationPercent,
          isExpired,
          isFullyUsed,
          status: isFullyUsed || !pkg.isActive
            ? 'Inactive' 
            : isExpired 
              ? 'Expired' 
              : 'Active'
        };
      } catch (error) {
        console.error(`[Package Report] Error processing package ${pkg.id}:`, error);
        // Return package with minimal data to avoid breaking the report
        return {
          ...pkg,
          hoursUsed: pkg.hoursUsed || 0,
          hoursRemaining: pkg.totalHours - (pkg.hoursUsed || 0),
          packageHourlyRate: pkg.totalHours > 0 ? pkg.price / pkg.totalHours : 0,
          utilizationPercent: pkg.totalHours > 0 ? ((pkg.hoursUsed || 0) / pkg.totalHours) * 100 : 0,
          isExpired: pkg.expiresAt ? new Date(pkg.expiresAt) < new Date() : false,
          isFullyUsed: (pkg.totalHours - (pkg.hoursUsed || 0)) <= 0,
          status: !pkg.isActive ? 'Inactive' : 'Active'
        };
      }
    }));

    // Calculate summary statistics
    const activePackages = enrichedPackages.filter(p => p.isActive && !p.isFullyUsed && !p.isExpired);
    const totalHoursPurchased = enrichedPackages.reduce((sum, p) => sum + p.totalHours, 0);
    const totalHoursUsed = enrichedPackages.reduce((sum, p) => sum + p.hoursUsed, 0);
    const totalHoursRemaining = enrichedPackages.reduce((sum, p) => sum + p.hoursRemaining, 0);
    const totalPackageRevenue = enrichedPackages.reduce((sum, p) => sum + p.price, 0);
    const averageUtilization = enrichedPackages.length > 0 
      ? enrichedPackages.reduce((sum, p) => sum + p.utilizationPercent, 0) / enrichedPackages.length 
      : 0;

    res.json({
      packages: enrichedPackages,
      summary: {
        totalPackages: enrichedPackages.length,
        activePackages: activePackages.length,
        totalHoursPurchased,
        totalHoursUsed,
        totalHoursRemaining,
        totalPackageRevenue,
        averageUtilization
      }
    });
  } catch (error) {
    console.error('Packages report error:', error);
    res.status(500).json({ message: 'Error fetching packages report' });
  }
});

// Monthly lesson payments report
router.get('/lessons-payments', async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year, studentId } = req.query;

    // Build where clause
    const whereClause = {
      userId
    };

    // Add date filter if month and year are provided
    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      
      if (isNaN(m) || m < 1 || m > 12 || isNaN(y)) {
        return res.status(400).json({ message: 'Invalid month or year' });
      }

      // Calculate date range for the month
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      
      whereClause.dateTime = {
        gte: start,
        lte: end
      };
    }

    // Add student filter if provided
    if (studentId) {
      whereClause.studentId = studentId;
    }

    // Fetch lessons
    const lessons = await prisma.lesson.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true
          }
        },
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
        }
      },
      orderBy: {
        dateTime: 'asc'
      }
    });

    // Deduplicate lessons by ID (in case of any duplicates from the query)
    const lessonMap = new Map();
    lessons.forEach(lesson => {
      if (!lessonMap.has(lesson.id)) {
        lessonMap.set(lesson.id, lesson);
      } else {
        // Merge payments if duplicate found (same ID)
        const existing = lessonMap.get(lesson.id);
        const existingPaymentIds = new Set(
          (existing.payments || []).map(lp => lp.payment.id)
        );
        (lesson.payments || []).forEach(lp => {
          if (!existingPaymentIds.has(lp.payment.id)) {
            existing.payments.push(lp);
          }
        });
        // Update paidAmount to the maximum (should be the same, but take max to be safe)
        existing.paidAmount = Math.max(existing.paidAmount || 0, lesson.paidAmount || 0);
      }
    });
    let uniqueLessons = Array.from(lessonMap.values());
    
    // Also check for logical duplicates (same student, date, price) - merge lessons on same day with same price
    const logicalDuplicates = [];
    const seenLessons = new Map(); // key: studentId-dateOnly-price
    const lessonsToKeep = [];
    const dateKeysSeen = new Map(); // For debugging
    
    uniqueLessons.forEach(lesson => {
      const dateTime = new Date(lesson.dateTime);
      // Normalize to just date (ignore time) for comparison - lessons on same day with same price are likely duplicates
      const dateOnly = new Date(dateTime.getFullYear(), dateTime.getMonth(), dateTime.getDate());
      const dateStr = dateOnly.toISOString().split('T')[0];
      // Round price to 2 decimal places to avoid floating point comparison issues
      const priceRounded = Math.round((lesson.price || 0) * 100) / 100;
      const dateKey = `${lesson.studentId}-${dateStr}-${priceRounded}`;
      
      // Store for debugging
      if (!dateKeysSeen.has(dateKey)) {
        dateKeysSeen.set(dateKey, []);
      }
      dateKeysSeen.get(dateKey).push({ id: lesson.id, dateTime: lesson.dateTime, price: lesson.price, studentName: `${lesson.student.firstName} ${lesson.student.lastName}` });
      
      if (seenLessons.has(dateKey)) {
        const existing = seenLessons.get(dateKey);
        logicalDuplicates.push({
          existing: existing,
          duplicate: lesson
        });
        console.log(`[Lessons Payments Report] Found logical duplicate:`, {
          existing: { id: existing.id, dateTime: existing.dateTime, price: existing.price, studentId: existing.studentId, studentName: `${existing.student.firstName} ${existing.student.lastName}`, payments: existing.payments.length },
          duplicate: { id: lesson.id, dateTime: lesson.dateTime, price: lesson.price, studentId: lesson.studentId, studentName: `${lesson.student.firstName} ${lesson.student.lastName}`, payments: lesson.payments.length },
          dateKey: dateKey
        });
        // Merge payments from the duplicate into the existing
        const existingPaymentIds = new Set(
          (existing.payments || []).map(lp => lp.payment.id)
        );
        (lesson.payments || []).forEach(lp => {
          if (!existingPaymentIds.has(lp.payment.id)) {
            existing.payments.push(lp);
          }
        });
        existing.paidAmount = Math.max(existing.paidAmount || 0, lesson.paidAmount || 0);
        // Update isPaid status
        existing.isPaid = existing.paidAmount >= (existing.price || 0);
      } else {
        seenLessons.set(dateKey, lesson);
        lessonsToKeep.push(lesson);
      }
    });
    
    // Log all dateKeys that have multiple lessons (potential duplicates)
    dateKeysSeen.forEach((lessons, key) => {
      if (lessons.length > 1) {
        console.log(`[Lessons Payments Report] DateKey "${key}" has ${lessons.length} lessons:`, lessons);
      }
    });
    
    // Debug: Log all lessons for "Daniel Khotline" on Sep 12
    const danielKhotlineLessons = uniqueLessons.filter(l => {
      const name = `${l.student.firstName} ${l.student.lastName}`;
      const dateTime = new Date(l.dateTime);
      return name.includes('Khotline') && dateTime.getMonth() === 8 && dateTime.getDate() === 12 && dateTime.getFullYear() === 2025;
    });
    if (danielKhotlineLessons.length > 0) {
      console.log(`[Lessons Payments Report] Found ${danielKhotlineLessons.length} lesson(s) for Daniel Khotline on Sep 12, 2025:`, danielKhotlineLessons.map(l => {
        const dateTime = new Date(l.dateTime);
        const dateOnly = new Date(dateTime.getFullYear(), dateTime.getMonth(), dateTime.getDate());
        const dateStr = dateOnly.toISOString().split('T')[0];
        const priceRounded = Math.round((l.price || 0) * 100) / 100;
        const dateKey = `${l.studentId}-${dateStr}-${priceRounded}`;
        return {
          id: l.id,
          studentId: l.studentId,
          dateTime: l.dateTime,
          dateStr: dateStr,
          price: l.price,
          priceRounded: priceRounded,
          dateKey: dateKey,
          payments: l.payments.length
        };
      }));
    }
    
    // Use lessonsToKeep instead of filtering (more efficient)
    if (logicalDuplicates.length > 0) {
      const duplicateIds = logicalDuplicates.map(d => d.duplicate.id);
      uniqueLessons = lessonsToKeep;
      console.warn(`[Lessons Payments Report] Found ${logicalDuplicates.length} logical duplicate lesson(s) (same student, date, price), merged. Duplicate IDs to remove:`, duplicateIds);
      console.log(`[Lessons Payments Report] Logical duplicates details:`, logicalDuplicates.map(d => ({
        existingId: d.existing.id,
        duplicateId: d.duplicate.id,
        studentId: d.existing.studentId,
        studentName: `${d.existing.student.firstName} ${d.existing.student.lastName}`,
        dateTime: d.existing.dateTime,
        duplicateDateTime: d.duplicate.dateTime,
        price: d.existing.price
      })));
    } else {
      // Log if we expected to find duplicates but didn't
      const potentialDuplicates = Array.from(dateKeysSeen.entries()).filter(([key, lessons]) => lessons.length > 1);
      if (potentialDuplicates.length > 0) {
        console.log(`[Lessons Payments Report] Found ${potentialDuplicates.length} dateKeys with multiple lessons but they weren't merged. This might indicate an issue with the matching logic.`);
      }
    }
    
    // Log if duplicates were found (for debugging)
    if (lessons.length !== uniqueLessons.length) {
      const duplicateIds = lessons.filter((l, i, arr) => arr.findIndex(lesson => lesson.id === l.id) !== i).map(l => l.id);
      console.warn(`[Lessons Payments Report] Found ${lessons.length - uniqueLessons.length} duplicate lesson(s) by ID, deduplicated. Duplicate IDs:`, duplicateIds);
    }
    
    // Always log lesson count for debugging
    console.log(`[Lessons Payments Report] ${lessons.length} lessons fetched, ${uniqueLessons.length} unique lessons after deduplication`);

    // Format the data for the report
    const reportData = uniqueLessons.map(lesson => {
      const dateTime = new Date(lesson.dateTime);
      const dateStr = dateTime.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
      const timeStr = dateTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
      
      // Get payment information
      const payments = lesson.payments.map(lp => {
        const payment = lp.payment;
        return {
          id: payment.id,
          date: payment.date,
          amount: lp.amount,
          method: payment.method,
          notes: payment.notes || ''
        };
      });

      return {
        id: lesson.id,
        studentId: lesson.studentId,
        name: `${lesson.student.firstName} ${lesson.student.lastName}`,
        date: dateStr,
        time: timeStr,
        price: lesson.price || 0,
        paidAmount: lesson.paidAmount || 0,
        payments: payments
      };
    });

    // Log the final report data count for debugging
    console.log(`[Lessons Payments Report] Final report: ${reportData.length} lessons, IDs:`, reportData.map(l => l.id));
    
    // Log if there are any lessons with the same studentId, date, and price
    const finalDuplicates = [];
    reportData.forEach((lesson, i) => {
      reportData.slice(i + 1).forEach(otherLesson => {
        if (lesson.studentId === otherLesson.studentId && 
            lesson.date === otherLesson.date && 
            Math.abs(lesson.price - otherLesson.price) < 0.01) {
          finalDuplicates.push({ lesson1: lesson.id, lesson2: otherLesson.id, studentId: lesson.studentId, date: lesson.date, price: lesson.price });
        }
      });
    });
    if (finalDuplicates.length > 0) {
      console.warn(`[Lessons Payments Report] WARNING: Found ${finalDuplicates.length} duplicate lessons in final report data:`, finalDuplicates);
    }
    
    res.json({
      month: month || null,
      year: year || null,
      lessons: reportData
    });
  } catch (error) {
    console.error('Lessons payments report error:', error);
    res.status(500).json({ message: 'Error fetching lessons payments report' });
  }
});

export default router;

