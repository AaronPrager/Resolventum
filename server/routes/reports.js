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
        AND: [
          { NOT: { status: { in: ['cancelled', 'canceled'] } } },
          {
            OR: [
              { status: 'completed' },
              { dateTime: { lt: now } }
            ]
          }
        ]
      }
    });

    // Total students (all time)
    const totalStudents = await prisma.student.count({ where: { userId } });

    // Outstanding balances overall: billed (completed lessons price) - paid (all payments)
    // Compute billed from completed or past-scheduled, with fallback to student's price if lesson.price null/0
    const billedLessons = await prisma.lesson.findMany({
      where: {
        userId,
        AND: [
          { NOT: { status: { in: ['cancelled', 'canceled'] } } },
          {
            OR: [
              { status: 'completed' },
              { dateTime: { lt: now } }
            ]
          }
        ]
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

// Outstanding balances per student or family (overall)
// Query param: groupBy=family to group by family, otherwise by student
router.get('/outstanding', async (req, res) => {
  try {
    const groupByFamily = req.query.groupBy === 'family';
    
    // Fetch necessary data
    const now = new Date();
    const userId = req.user.id;
    const [students, lessons, payments] = await Promise.all([
      prisma.student.findMany({ 
        where: { userId }, 
        select: { id: true, firstName: true, lastName: true, familyId: true } 
      }),
      prisma.lesson.findMany({
        where: {
          userId,
          AND: [
            { NOT: { status: { in: ['cancelled', 'canceled'] } } },
            {
              OR: [
                { status: 'completed' },
                { dateTime: { lt: now } }
              ]
            }
          ]
        },
        select: { id: true, studentId: true, price: true },
      }),
      prisma.payment.findMany({
        where: { userId },
        select: { id: true, studentId: true, amount: true, date: true },
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
    const paymentsByStudent = new Map();
    for (const p of payments) {
      const arr = paymentsByStudent.get(p.studentId) || [];
      arr.push(p);
      paymentsByStudent.set(p.studentId, arr);
    }

    const studentPriceMap = new Map(
      students.map(s => [s.id, 0])
    );
    const studentPriceFromDb = await prisma.student.findMany({ where: { userId }, select: { id: true, pricePerLesson: true } });
    studentPriceFromDb.forEach(s => studentPriceMap.set(s.id, s.pricePerLesson || 0));

    if (groupByFamily) {
      // Group by family
      const familiesMap = new Map(); // familyId -> { students: [], totalBilled, paid, balanceDue, lastPaymentDate }
      
      students.forEach(s => {
        const familyId = s.familyId || `individual_${s.id}`; // Use individual_ prefix for students without family
        if (!familiesMap.has(familyId)) {
          familiesMap.set(familyId, {
            familyId,
            studentIds: [],
            studentNames: [],
            lessonsCompleted: 0,
            totalBilled: 0,
            paid: 0,
            balanceDue: 0,
            lastPaymentDate: null
          });
        }
        
        const family = familiesMap.get(familyId);
        family.studentIds.push(s.id);
        family.studentNames.push(`${s.firstName} ${s.lastName}`);
        
        const sLessons = lessonsByStudent.get(s.id) || [];
        const sPayments = paymentsByStudent.get(s.id) || [];
        const totalBilled = sLessons.reduce((sum, l) => sum + (((l.price ?? 0) || studentPriceMap.get(s.id) || 0)), 0);
        const paid = sPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        family.lessonsCompleted += sLessons.length;
        family.totalBilled += totalBilled;
        family.paid += paid;
        
        if (sPayments.length > 0) {
          const studentLastPayment = new Date(Math.max(...sPayments.map(p => new Date(p.date).getTime())));
          if (!family.lastPaymentDate || studentLastPayment > family.lastPaymentDate) {
            family.lastPaymentDate = studentLastPayment;
          }
        }
      });
      
      // Calculate balance for each family
      familiesMap.forEach(family => {
        family.balanceDue = family.totalBilled - family.paid;
        family.familyName = family.studentNames.join(', ');
      });
      
      const rows = Array.from(familiesMap.values())
        .filter(f => !f.familyId.startsWith('individual_')) // Only show families with multiple students
        .map(f => ({
          familyId: f.familyId,
          familyName: f.familyName,
          studentCount: f.studentIds.length,
          lessonsCompleted: f.lessonsCompleted,
          totalBilled: f.totalBilled,
          paid: f.paid,
          balanceDue: f.balanceDue,
          lastPaymentDate: f.lastPaymentDate,
        }));
      
      rows.sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0));
      res.json(rows);
    } else {
      // Group by student (original behavior)
      const rows = students.map(s => {
        const sLessons = lessonsByStudent.get(s.id) || [];
        const sPayments = paymentsByStudent.get(s.id) || [];
        const totalBilled = sLessons.reduce((sum, l) => sum + (((l.price ?? 0) || studentPriceMap.get(s.id) || 0)), 0);
        const paid = sPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const balanceDue = totalBilled - paid;
        const lastPaymentDate = sPayments.length
          ? new Date(Math.max(...sPayments.map(p => new Date(p.date).getTime())))
          : null;
        return {
          studentId: s.id,
          studentName: studentMap.get(s.id) || 'Unknown',
          lessonsCompleted: sLessons.length,
          totalBilled,
          paid,
          balanceDue,
          lastPaymentDate,
        };
      });

      // Sort by balance desc
      rows.sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0));

      res.json(rows);
    }
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
    const completedLessons = lessons.filter(l => l.status === 'completed').length;
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalEarned = lessons.filter(l => l.status === 'completed').reduce((sum, l) => sum + l.price, 0);

    const report = {
      period: {
        month: parseInt(month),
        year: parseInt(year)
      },
      summary: {
        totalLessons,
        completedLessons,
        cancelledLessons: lessons.filter(l => l.status === 'cancelled').length,
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
        dateTime: { lte: prevEnd },
        NOT: { status: { in: ['cancelled', 'canceled'] } },
        OR: [{ status: 'completed' }, { dateTime: { lt: now } }]
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
        NOT: { status: { in: ['cancelled', 'canceled'] } }
      },
      include: { student: { select: { firstName: true, lastName: true } } }
    });

    const billedLessons = monthLessons.filter(l => l.status === 'completed' || l.dateTime < now);
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
      select: { price: true, dateTime: true, status: true }
    });
    const prevBilled = prevLessons.reduce((sum, l) => sum + (l.price ?? fallbackPrice), 0);
    
    // Debug logging for previous balance
    if (prevBilled > 0) {
      console.log(`[Monthly Student Report] Previous balance calculation for ${student.firstName} ${student.lastName}:`);
      console.log(`[Monthly Student Report] Previous lessons found: ${prevLessons.length}`);
      console.log(`[Monthly Student Report] prevBilled: $${prevBilled.toFixed(2)}`);
      console.log(`[Monthly Student Report] Previous lessons details:`, prevLessons.map(l => ({
        dateTime: l.dateTime,
        status: l.status,
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
        status: l.status,
        price: l.price,
        isPast: l.dateTime < now,
        isCompleted: l.status === 'completed',
        willBeBilled: l.status === 'completed' || l.dateTime < now
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
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const m = parseInt(month);
    const y = parseInt(year);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    const prevEnd = new Date(start.getTime() - 1);
    const now = new Date();
    const userId = req.user.id;

    // First, get all lessons for this month to find which students had lessons
    const monthLessonsForFilter = await prisma.lesson.findMany({
      where: {
        userId,
        dateTime: { gte: start, lte: end }
      },
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

    // Get only non-archived students who had lessons this month
    const students = await prisma.student.findMany({
      where: { 
        userId,
        archived: false,
        id: { in: studentIdsWithLessons }
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

    // Process each student
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
          select: { price: true, dateTime: true, status: true }
        });
        const prevBilled = prevLessons.reduce((sum, l) => sum + (l.price ?? fallbackPrice), 0);

        const prevPaymentsAgg = await prisma.payment.aggregate({
          _sum: { amount: true },
          where: { userId, studentId: student.id, date: { lte: prevEnd } }
        });
        const prevPaid = prevPaymentsAgg._sum.amount || 0;
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

        // Payments this month
        const payments = await prisma.payment.findMany({
          where: { userId, studentId: student.id, date: { gte: start, lte: end } },
          orderBy: { date: 'desc' }
        });
        const paidThisMonth = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

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

    // Enrich packages with calculated fields, recalculating hoursUsed from actual linked lessons
    const enrichedPackages = await Promise.all(packages.map(async (pkg) => {
      // Recalculate hoursUsed from actual linked lessons
      const linkedLessons = await prisma.lesson.findMany({
        where: {
          userId,
          packageId: pkg.id
        },
        select: {
          duration: true
        }
      });

      // Calculate actual hours used from linked lessons
      const actualHoursUsed = linkedLessons.reduce((sum, lesson) => {
        return sum + (lesson.duration || 0) / 60; // Convert minutes to hours
      }, 0);

      // Sync hoursUsed back to database if it differs (fix inconsistencies)
      if (Math.abs((pkg.hoursUsed || 0) - actualHoursUsed) > 0.01) {
        console.log(`[Package Report] Syncing hoursUsed for package ${pkg.id}: ${pkg.hoursUsed} -> ${actualHoursUsed.toFixed(2)}`);
        await prisma.package.update({
          where: { id: pkg.id },
          data: { hoursUsed: actualHoursUsed }
        });
      }

      const hoursRemaining = pkg.totalHours - actualHoursUsed;
      const packageHourlyRate = pkg.price / pkg.totalHours;
      const utilizationPercent = pkg.totalHours > 0 ? (actualHoursUsed / pkg.totalHours) * 100 : 0;
      const isExpired = pkg.expiresAt ? new Date(pkg.expiresAt) < new Date() : false;
      const isFullyUsed = hoursRemaining <= 0;

      return {
        ...pkg,
        hoursUsed: actualHoursUsed, // Use recalculated value
        hoursRemaining,
        packageHourlyRate,
        utilizationPercent,
        isExpired,
        isFullyUsed,
        status: !pkg.isActive 
          ? 'Inactive' 
          : isFullyUsed 
            ? 'Used Up' 
            : isExpired 
              ? 'Expired' 
              : 'Active'
      };
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

export default router;

