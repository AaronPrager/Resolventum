import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';
import { generateInvoicePDF } from '../utils/invoiceGenerator.js';

const router = express.Router();

router.use(authenticateToken);

// Generate invoice for a student for a specific month
router.post('/generate/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get lessons for this month
    const lessons = await prisma.lesson.findMany({
      where: {
        studentId,
        dateTime: {
          gte: startDate,
          lte: endDate
        },
        status: 'completed'
      },
      orderBy: { dateTime: 'asc' }
    });

    // Get payments for this month
    const payments = await prisma.payment.findMany({
      where: {
        studentId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    const totalLessons = lessons.length;
    const totalEarned = lessons.reduce((sum, lesson) => sum + lesson.price, 0);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = totalEarned - totalPaid;

    const invoiceData = {
      student,
      lessons,
      payments,
      totalLessons,
      totalEarned,
      totalPaid,
      balance,
      month: month.toString().padStart(2, '0'),
      year: year.toString()
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${student.lastName}-${month}-${year}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ message: 'Error generating invoice' });
  }
});

// Get invoice data (JSON) for a student
router.get('/data/:studentId', async (req, res) => {
  try {
    const { studentId } = req.query;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        studentId,
        dateTime: {
          gte: startDate,
          lte: endDate
        },
        status: 'completed'
      }
    });

    const payments = await prisma.payment.findMany({
      where: {
        studentId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    res.json({
      student,
      lessons,
      payments,
      totalLessons: lessons.length,
      totalEarned: lessons.reduce((sum, l) => sum + l.price, 0),
      totalPaid: payments.reduce((sum, p) => sum + p.amount, 0)
    });
  } catch (error) {
    console.error('Get invoice data error:', error);
    res.status(500).json({ message: 'Error fetching invoice data' });
  }
});

export default router;

