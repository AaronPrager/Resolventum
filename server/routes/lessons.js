import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Helper function to calculate recurring lesson dates
function calculateRecurringDates(startDate, frequency, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    
    switch (frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'yearly':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        return dates;
    }
  }
  
  return dates;
}

// All routes require authentication
router.use(authenticateToken);

// Get all lessons
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, studentId } = req.query;

    const where = {};
    if (studentId) where.studentId = studentId;
    if (startDate && endDate) {
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        student: true
      },
      orderBy: { dateTime: 'desc' }
    });

    res.json(lessons);
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ message: 'Error fetching lessons' });
  }
});

// Get single lesson
router.get('/:id', async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: {
        student: true
      }
    });

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    res.json(lesson);
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ message: 'Error fetching lesson' });
  }
});

// Create lesson
router.post(
  '/',
  [
    body('studentId').notEmpty().withMessage('Student ID required'),
    body('dateTime').isISO8601().withMessage('Valid date/time required'),
    body('duration').isInt({ min: 15 }).withMessage('Duration must be at least 15 minutes'),
    body('subject').notEmpty().withMessage('Subject required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('locationType').optional().isIn(['in-person', 'remote']).withMessage('Invalid location type'),
    body('isRecurring').optional().isBoolean(),
    body('recurringFrequency').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']),
    body('recurringEndDate').optional().isISO8601(),
    // iCal-style validations
    body('allDay').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        studentId, dateTime, duration, subject, price, notes, status,
        locationType, link, isRecurring, recurringFrequency, recurringEndDate,
        allDay
      } = req.body;

      // Helper: default status based on date (past -> completed, future -> scheduled) if not provided
      const resolveStatus = (date) => {
        if (status) return status;
        const d = new Date(date);
        return d < new Date() ? 'completed' : 'scheduled';
      };

      // If it's a recurring lesson, create multiple lessons
      if (isRecurring && recurringFrequency && recurringEndDate) {
        const recurringGroupId = uuidv4();
        const dates = calculateRecurringDates(dateTime, recurringFrequency, recurringEndDate);
        
        const lessonsData = dates.map(date => ({
          studentId,
          dateTime: date,
          duration,
          subject,
          price,
          notes: notes || null,
          status: resolveStatus(date),
          locationType: locationType || 'in-person',
          link: link || null,
          isRecurring: true,
          recurringFrequency,
          recurringEndDate: new Date(recurringEndDate),
          recurringGroupId,
          // iCal-style options
          allDay: allDay || false
        }));

        const lessons = await prisma.lesson.createMany({
          data: lessonsData
        });

        // Deduct packages: consume up to lessons.count from student's active packages
        try {
          let remainingToConsume = lessons.count;
          if (remainingToConsume > 0) {
            // Get student's active packages ordered by purchasedAt
            const pkgs = await prisma.package.findMany({
              where: {
                studentId,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
              },
              orderBy: { purchasedAt: 'asc' }
            });
            for (const pkg of pkgs) {
              const available = (pkg.totalLessons || 0) - (pkg.lessonsUsed || 0);
              if (available <= 0) continue;
              const consume = Math.min(available, remainingToConsume);
              await prisma.package.update({
                where: { id: pkg.id },
                data: { lessonsUsed: { increment: consume } }
              });
              remainingToConsume -= consume;
              if (remainingToConsume <= 0) break;
            }
          }
        } catch (e) {
          console.error('Package deduction error (recurring):', e);
        }

        res.status(201).json({ 
          message: `${lessons.count} lessons created successfully`,
          count: lessons.count,
          recurringGroupId
        });
      } else {
        // Create a single lesson
        const lessonData = {
          studentId,
          dateTime: new Date(dateTime),
          duration,
          subject,
          price,
          notes: notes || null,
          status: resolveStatus(dateTime),
          locationType: locationType || 'in-person',
          link: link || null,
          isRecurring: false,
          recurringFrequency: null,
          recurringEndDate: null,
          recurringGroupId: null,
          // iCal-style options
          allDay: allDay || false
        };

        const lesson = await prisma.lesson.create({
          data: lessonData,
          include: {
            student: true
          }
        });

        // Deduct from student's active package (one lesson)
        try {
          const pkg = await prisma.package.findFirst({
            where: {
              studentId,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            orderBy: { purchasedAt: 'asc' }
          });
          if (pkg && (pkg.totalLessons || 0) > (pkg.lessonsUsed || 0)) {
            await prisma.package.update({
              where: { id: pkg.id },
              data: { lessonsUsed: { increment: 1 } }
            });
          }
        } catch (e) {
          console.error('Package deduction error:', e);
        }

        res.status(201).json(lesson);
      }
    } catch (error) {
      console.error('Create lesson error:', error);
      res.status(500).json({ message: 'Error creating lesson' });
    }
  }
);

// Update lesson
router.put('/:id', async (req, res) => {
  try {
    const { 
      studentId, dateTime, duration, subject, price, notes, status,
      locationType, link, isRecurring, recurringFrequency, recurringEndDate,
      allDay
    } = req.body;

    const currentLesson = await prisma.lesson.findUnique({
      where: { id: req.params.id }
    });

    if (!currentLesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const updateData = {
      studentId,
      dateTime: new Date(dateTime),
      duration: parseInt(duration),
      subject,
      price: parseFloat(price),
      notes: notes || null,
      status: status || 'scheduled',
      locationType: locationType || 'in-person',
      link: link || null,
      // iCal-style options
      allDay: allDay !== undefined ? allDay : currentLesson.allDay
    };

    // Check if converting recurring to single
    if (!isRecurring && currentLesson.isRecurring) {
      // Convert recurring lesson to single
      updateData.isRecurring = false;
      updateData.recurringFrequency = null;
      updateData.recurringEndDate = null;
      updateData.recurringGroupId = null;

      const lesson = await prisma.lesson.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          student: true
        }
      });

      res.json({
        ...lesson,
        message: 'Converted to single lesson'
      });
    }
    // Check if converting single to recurring series
    else if (isRecurring && recurringFrequency && recurringEndDate && !currentLesson.isRecurring) {
      // Convert single lesson to recurring series
      const recurringGroupId = uuidv4();
      const startDate = new Date(dateTime);
      const endDate = new Date(recurringEndDate);

      // Calculate future dates starting after the current lesson
      const nextDate = new Date(startDate);
      switch (recurringFrequency) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      const futureDates = calculateRecurringDates(nextDate, recurringFrequency, endDate);

      // Update the current lesson
      updateData.isRecurring = true;
      updateData.recurringFrequency = recurringFrequency;
      updateData.recurringEndDate = endDate;
      updateData.recurringGroupId = recurringGroupId;

      await prisma.lesson.update({
        where: { id: req.params.id },
        data: updateData
      });

      // Create future recurring lessons
      if (futureDates.length > 0) {
        const futureLessons = futureDates.map(date => ({
          studentId: updateData.studentId,
          dateTime: date,
          duration: updateData.duration,
          subject: updateData.subject,
          price: updateData.price,
          notes: updateData.notes,
          status: updateData.status,
          locationType: updateData.locationType,
          link: updateData.link,
          isRecurring: true,
          recurringFrequency,
          recurringEndDate: endDate,
          recurringGroupId,
          // iCal-style options
          allDay: updateData.allDay
        }));

        await prisma.lesson.createMany({
          data: futureLessons
        });
      }

      const updatedLesson = await prisma.lesson.findUnique({
        where: { id: req.params.id },
        include: { student: true }
      });

      res.json({
        ...updatedLesson,
        message: `Converted to recurring series with ${futureDates.length + 1} total lessons`
      });
    } else {
      // Regular update
      updateData.isRecurring = false;
      updateData.recurringFrequency = null;
      updateData.recurringEndDate = null;
      updateData.recurringGroupId = null;

      const lesson = await prisma.lesson.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          student: true
        }
      });

      res.json(lesson);
    }
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ message: 'Error updating lesson' });
  }
});

// Update this and all future recurring lessons
router.put('/:id/recurring-future', async (req, res) => {
  try {
    // Get the lesson to find its recurring group and date
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id }
    });

    if (!lesson || !lesson.recurringGroupId) {
      return res.status(404).json({ message: 'Recurring lesson not found' });
    }

    const { 
      studentId, dateTime, duration, subject, price, notes, status,
      locationType, link, recurringFrequency, recurringEndDate,
      allDay
    } = req.body;

    const updateData = {
      studentId,
      duration: parseInt(duration),
      subject,
      price: parseFloat(price),
      notes: notes || null,
      status: status || 'scheduled',
      locationType: locationType || 'in-person',
      link: link || null,
      // iCal-style options
      allDay: allDay !== undefined ? allDay : lesson.allDay
    };

    // Check if frequency is being changed
    if (recurringFrequency && recurringFrequency !== lesson.recurringFrequency) {
      // Delete all future lessons (but keep the current one)
      await prisma.lesson.deleteMany({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          dateTime: {
            gt: lesson.dateTime
          }
        }
      });

      // Determine the end date
      const endDate = recurringEndDate ? new Date(recurringEndDate) : 
                      lesson.recurringEndDate ? new Date(lesson.recurringEndDate) : null;
      
      if (endDate) {
        // Generate new dates with the new frequency
        const newDates = calculateRecurringDates(new Date(lesson.dateTime), recurringFrequency, endDate);
        
        // Create new lessons with the new frequency (skip first date as it's the current lesson)
        if (newDates.length > 1) {
          const newLessons = newDates.slice(1).map(date => ({
            studentId: updateData.studentId,
            dateTime: date,
            duration: updateData.duration,
            subject: updateData.subject,
            price: updateData.price,
            notes: updateData.notes,
            status: updateData.status,
            locationType: updateData.locationType,
            link: updateData.link,
            isRecurring: true,
            recurringFrequency: recurringFrequency,
            recurringEndDate: endDate,
            recurringGroupId: lesson.recurringGroupId,
            // iCal-style options
            allDay: updateData.allDay
          }));

          await prisma.lesson.createMany({
            data: newLessons
          });
        }
      }
      
      // Update the current lesson with new frequency and other data
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          ...updateData,
          recurringFrequency: recurringFrequency,
          recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : lesson.recurringEndDate
        }
      });
      
      const totalCount = await prisma.lesson.count({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          dateTime: {
            gte: lesson.dateTime
          }
        }
      });

      return res.json({ 
        message: `Recurring series updated with new frequency. ${totalCount} lessons in series.`,
        count: totalCount
      });
    }

    // If recurringEndDate is provided (without frequency change), handle extending or shortening the series
    if (recurringEndDate) {
      const newEndDate = new Date(recurringEndDate);
      const currentEndDate = lesson.recurringEndDate;

      // Update recurring end date for all lessons in the group
      updateData.recurringEndDate = newEndDate;

      // Update all lessons in the same recurring group that are on or after this lesson's date
      await prisma.lesson.updateMany({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          dateTime: {
            gte: lesson.dateTime
          }
        },
        data: updateData
      });

      // If extending the series, create new lessons
      if (newEndDate > currentEndDate) {
        // Get all existing lessons to find the last one
        const existingLessons = await prisma.lesson.findMany({
          where: {
            recurringGroupId: lesson.recurringGroupId
          },
          orderBy: {
            dateTime: 'desc'
          }
        });

        if (existingLessons.length > 0) {
          const lastLesson = existingLessons[0];
          const dates = calculateRecurringDates(
            new Date(lastLesson.dateTime.getTime() + (
              lesson.recurringFrequency === 'daily' ? 86400000 :
              lesson.recurringFrequency === 'weekly' ? 604800000 :
              lesson.recurringFrequency === 'monthly' ? 2592000000 :
              31536000000 // yearly (approximate - 365 days)
            )),
            lesson.recurringFrequency,
            newEndDate
          );

          if (dates.length > 0) {
            const newLessons = dates.map(date => ({
              studentId: updateData.studentId,
              dateTime: date,
              duration: updateData.duration,
              subject: updateData.subject,
              price: updateData.price,
              notes: updateData.notes,
              status: updateData.status,
              locationType: updateData.locationType,
              link: updateData.link,
              isRecurring: true,
              recurringFrequency: lesson.recurringFrequency,
              recurringEndDate: newEndDate,
              recurringGroupId: lesson.recurringGroupId,
              // iCal-style options
              allDay: updateData.allDay
            }));

            await prisma.lesson.createMany({
              data: newLessons
            });
          }
        }
      }

      // If shortening the series, delete lessons beyond the new end date
      if (newEndDate < currentEndDate) {
        await prisma.lesson.deleteMany({
          where: {
            recurringGroupId: lesson.recurringGroupId,
            dateTime: {
              gt: newEndDate
            }
          }
        });
      }

      // Count all lessons in the series for the response
      const totalCount = await prisma.lesson.count({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          dateTime: {
            gte: lesson.dateTime
          }
        }
      });

      res.json({ 
        message: `${totalCount} lessons in series updated successfully`,
        count: totalCount
      });
    } else {
      // No end date change, just update existing lessons
      const result = await prisma.lesson.updateMany({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          dateTime: {
            gte: lesson.dateTime
          }
        },
        data: updateData
      });

      res.json({ 
        message: `${result.count} lessons updated successfully`,
        count: result.count
      });
    }
  } catch (error) {
    console.error('Update recurring lessons error:', error);
    res.status(500).json({ message: 'Error updating recurring lessons' });
  }
});

// Delete this and all future recurring lessons
router.delete('/:id/recurring-future', async (req, res) => {
  try {
    // Get the lesson to find its recurring group and date
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id }
    });

    if (!lesson || !lesson.recurringGroupId) {
      return res.status(404).json({ message: 'Recurring lesson not found' });
    }

    // Delete all lessons in the same recurring group that are on or after this lesson's date
    const result = await prisma.lesson.deleteMany({
      where: {
        recurringGroupId: lesson.recurringGroupId,
        dateTime: {
          gte: lesson.dateTime
        }
      }
    });

    res.json({ 
      message: `${result.count} lessons deleted successfully`,
      count: result.count
    });
  } catch (error) {
    console.error('Delete recurring lessons error:', error);
    res.status(500).json({ message: 'Error deleting recurring lessons' });
  }
});

// Delete lesson
router.delete('/:id', async (req, res) => {
  try {
    await prisma.lesson.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ message: 'Error deleting lesson' });
  }
});

// Get upcoming lessons (for reminders)
router.get('/upcoming/tomorrow', async (req, res) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setHours(23, 59, 59, 999);

    const lessons = await prisma.lesson.findMany({
      where: {
        dateTime: {
          gte: tomorrow,
          lte: dayAfter
        },
        status: 'scheduled'
      },
      include: {
        student: true
      }
    });

    res.json(lessons);
  } catch (error) {
    console.error('Get upcoming lessons error:', error);
    res.status(500).json({ message: 'Error fetching upcoming lessons' });
  }
});

export default router;

