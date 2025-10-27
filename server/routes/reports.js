import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';

const router = express.Router();

router.use(authenticateToken);

// Get monthly report
router.get('/monthly', async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get all lessons for the month
    const lessons = await prisma.lesson.findMany({
      where: {
        dateTime: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        student: true
      }
    });

    // Get all payments
    const payments = await prisma.payment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        student: true
      }
    });

    // Get all students with activity this month
    const students = await prisma.student.findMany({
      include: {
        lessons: {
          where: {
            dateTime: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        payments: {
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }
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

export default router;

