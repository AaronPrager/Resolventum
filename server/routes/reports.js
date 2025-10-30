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

    // Total income this month
    const paymentsThisMonth = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { date: { gte: start, lte: end } },
    });

    // Lessons completed this month (past and not canceled count as completed)
    const lessonsCompleted = await prisma.lesson.count({
      where: {
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
    const totalStudents = await prisma.student.count();

    // Outstanding balances overall: billed (completed lessons price) - paid (all payments)
    // Compute billed from completed or past-scheduled, with fallback to student's price if lesson.price null/0
    const billedLessons = await prisma.lesson.findMany({
      where: {
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
      (await prisma.student.findMany({ select: { id: true, pricePerLesson: true } }))
        .map(s => [s.id, s.pricePerLesson || 0])
    );
    const billedTotal = billedLessons.reduce((sum, l) => {
      const p = (l.price ?? 0) || (studentPrices.get(l.studentId) || 0);
      return sum + p;
    }, 0);
    const paidAgg = await prisma.payment.aggregate({ _sum: { amount: true } });

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

// Outstanding balances per student (overall)
router.get('/outstanding', async (req, res) => {
  try {
    // Fetch necessary data
    const now = new Date();
    const [students, lessons, payments] = await Promise.all([
      prisma.student.findMany({ select: { id: true, firstName: true, lastName: true } }),
      prisma.lesson.findMany({
        where: {
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
        select: { id: true, studentId: true, amount: true, date: true },
      }),
    ]);

    // Build maps
    const studentMap = new Map(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
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
    const studentPriceFromDb = await prisma.student.findMany({ select: { id: true, pricePerLesson: true } });
    studentPriceFromDb.forEach(s => studentPriceMap.set(s.id, s.pricePerLesson || 0));

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
  } catch (error) {
    console.error('Reports outstanding error:', error);
    res.status(500).json({ message: 'Failed to load outstanding balances' });
  }
});

// Recent payments (last 10, date desc)
router.get('/payments/recent', async (req, res) => {
  try {
    const items = await prisma.payment.findMany({
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

    // Get all lessons for the month
    const lessons = await prisma.lesson.findMany({
      where: {
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
        date: { gte: startDate, lte: endDate },
        ...(studentId ? { studentId } : {})
      },
      include: {
        student: true
      }
    });

    // Get all students with activity this month
    const students = await prisma.student.findMany({
      where: studentId ? { id: studentId } : undefined,
      include: {
        lessons: { where: { dateTime: { gte: startDate, lte: endDate } } },
        payments: { where: { date: { gte: startDate, lte: endDate } } }
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

    // Student price fallback map
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { pricePerLesson: true, firstName: true, lastName: true } });
    const fallbackPrice = student?.pricePerLesson || 0;

    // Previous balance: billed through end of prior month minus payments through end of prior month
    const prevEnd = new Date(start.getTime() - 1);

    const prevLessons = await prisma.lesson.findMany({
      where: {
        studentId,
        dateTime: { lte: prevEnd },
        NOT: { status: { in: ['cancelled', 'canceled'] } },
        OR: [ { status: 'completed' }, { dateTime: { lt: now } } ]
      },
      select: { price: true }
    });
    const prevBilled = prevLessons.reduce((sum, l) => sum + (((l.price ?? 0) || fallbackPrice)), 0);

    const prevPaymentsAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { studentId, date: { lte: prevEnd } }
    });
    const prevPaid = prevPaymentsAgg._sum.amount || 0;
    const previousBalance = prevBilled - prevPaid;

    // In-month billed (completed or past), not canceled
    const monthLessons = await prisma.lesson.findMany({
      where: {
        studentId,
        dateTime: { gte: start, lte: end },
        NOT: { status: { in: ['cancelled', 'canceled'] } }
      },
      include: { student: { select: { firstName: true, lastName: true } } }
    });

    const billedLessons = monthLessons.filter(l => l.status === 'completed' || l.dateTime < now);
    const billedThisMonth = billedLessons.reduce((sum, l) => sum + (((l.price ?? 0) || fallbackPrice)), 0);

    // All lessons in month (not canceled) for display
    const lessonsThisMonth = monthLessons; // includes past and future, statuses as-is

    // Payments this month
    const payments = await prisma.payment.findMany({
      where: { studentId, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' }
    });
    const paidThisMonth = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const endingBalance = previousBalance + billedThisMonth - paidThisMonth;

    res.json({
      studentName: `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim(),
      month: m,
      year: y,
      previousBalance,
      billedThisMonth,
      paidThisMonth,
      endingBalance,
      lessonsThisMonth,
      payments
    });
  } catch (error) {
    console.error('Monthly student report error:', error);
    res.status(500).json({ message: 'Failed to load monthly student report' });
  }
});

export default router;

