import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Helper function to calculate recurring lesson dates
// endDate should be inclusive - lessons are created up to and including the end date
// All dates are handled in local timezone
function calculateRecurringDates(startDate, frequency, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  let end = new Date(endDate);
  
  // Extract the date components from the end date (ignore time component)
  // This ensures we compare dates correctly regardless of timezone
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();
  const endDay = end.getUTCDate();
  
  // Create a proper end date at end of day in UTC, then convert to local
  // This ensures Nov 13 means Nov 13, not Nov 12
  end = new Date(Date.UTC(endYear, endMonth, endDay, 23, 59, 59, 999));
  
  // Helper to get date-only string for comparison (YYYY-MM-DD)
  const getDateOnly = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  // Helper to compare dates by date only (ignoring time)
  const compareDatesOnly = (date1, date2) => {
    const d1Str = getDateOnly(date1);
    const d2Str = getDateOnly(date2);
    return d1Str <= d2Str;
  };
  
  // Debug: log what we're working with
  console.log('[calculateRecurringDates] Start:', currentDate.toISOString(), 'End:', end.toISOString(), 'Frequency:', frequency);
  console.log('[calculateRecurringDates] Start date only:', getDateOnly(currentDate), 'End date only:', getDateOnly(end));
  
  // Add dates until we exceed the end date
  // Use date-only comparison to avoid time-related issues
  while (compareDatesOnly(currentDate, end)) {
    const dateToAdd = new Date(currentDate);
    dates.push(dateToAdd);
    console.log('[calculateRecurringDates] Added:', getDateOnly(dateToAdd));
    
    // Increment to next occurrence
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
    
    console.log('[calculateRecurringDates] Next will be:', getDateOnly(currentDate), 'vs End:', getDateOnly(end), 'Continue?', compareDatesOnly(currentDate, end));
  }
  
  console.log('[calculateRecurringDates] Total dates generated:', dates.length, 'Dates:', dates.map(d => getDateOnly(d)));
  return dates;
}

// All routes require authentication
router.use(authenticateToken);

// Get all lessons
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
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const lessons = await prisma.lesson.findMany({
      where,
      include: {
        student: true,
        payment: {
          select: {
            id: true,
            date: true,
            amount: true,
            method: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            purchasedAt: true
          }
        }
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
    const lesson = await prisma.lesson.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        student: true,
        payment: {
          select: {
            id: true,
            date: true,
            amount: true,
            method: true,
            notes: true
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

      // Verify student belongs to user
      const student = await prisma.student.findFirst({
        where: { id: studentId, userId: req.user.id }
      });

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Calculate price based on student's hourly rate
      // The student's pricePerLesson is already set to package rate if a package was purchased
      const hourlyRate = student.pricePerLesson || 0;
      const lessonHours = duration / 60; // Convert minutes to hours
      const finalPrice = hourlyRate > 0 ? (hourlyRate * lessonHours) : (price || 0);

      // If it's a recurring lesson, create multiple lessons
      if (isRecurring && recurringFrequency && recurringEndDate) {
        const recurringGroupId = uuidv4();
        // Frontend sends end date with time set to end of day
        // calculateRecurringDates will normalize it to ensure inclusivity
        const endDateWithTime = new Date(recurringEndDate);
        const dates = calculateRecurringDates(dateTime, recurringFrequency, endDateWithTime);
        
        // Initial lesson data with prices - will be updated based on packages
        const lessonsData = dates.map(date => ({
          userId: req.user.id,
          studentId,
          dateTime: date,
          duration,
          subject,
          price: finalPrice, // Will be updated if packages are used
          notes: notes || null,
          status: resolveStatus(date),
          isPaid: false, // All new lessons are unpaid
          locationType: locationType || 'in-person',
          link: link || null,
          isRecurring: true,
          recurringFrequency,
          recurringEndDate: new Date(recurringEndDate),
          recurringGroupId,
          // iCal-style options
          allDay: allDay || false
        }));

        // Update all lesson prices using student's current hourly rate
        // (which is set to package rate if a package was purchased)
        for (let i = 0; i < lessonsData.length; i++) {
          const lessonHours = lessonsData[i].duration / 60;
          lessonsData[i].price = hourlyRate > 0 ? (hourlyRate * lessonsData[i].duration) / 60 : finalPrice;
        }

        const lessons = await prisma.lesson.createMany({
          data: lessonsData
        });

        // Deduct hours from active packages for all recurring lessons
        try {
          // Calculate total hours needed for all lessons
          const totalHours = lessonsData.reduce((sum, lesson) => sum + (lesson.duration / 60), 0);
          let remainingHours = totalHours;
          
          // Get all active packages ordered by purchase date
          const activePackages = await prisma.package.findMany({
            where: {
              userId: req.user.id,
              studentId,
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            orderBy: { purchasedAt: 'asc' }
          });
          
          // Deduct hours from packages in order
          for (const pkg of activePackages) {
            if (remainingHours <= 0) break;
            
            const availableHours = pkg.totalHours - pkg.hoursUsed;
            if (availableHours <= 0) continue;
            
            const hoursToDeduct = Math.min(remainingHours, availableHours);
            
            await prisma.package.update({
              where: { id: pkg.id },
              data: { hoursUsed: { increment: hoursToDeduct } }
            });
            
            remainingHours -= hoursToDeduct;
            console.log(`Deducted ${hoursToDeduct.toFixed(2)} hours from package ${pkg.id} for ${lessons.count} recurring lessons`);
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
          userId: req.user.id,
          studentId,
          dateTime: new Date(dateTime),
          duration,
          subject,
          price: finalPrice,
          notes: notes || null,
          status: resolveStatus(dateTime),
          isPaid: false, // All new lessons are unpaid
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

        // Deduct hours from active packages when lesson is scheduled
        try {
          const lessonHours = duration / 60; // Convert minutes to hours
          let remainingHours = lessonHours;
          
          // Get all active packages ordered by purchase date
          const activePackages = await prisma.package.findMany({
            where: {
              userId: req.user.id,
              studentId,
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            },
            orderBy: { purchasedAt: 'asc' }
          });
          
          // Deduct hours from packages in order
          for (const pkg of activePackages) {
            if (remainingHours <= 0) break;
            
            const availableHours = pkg.totalHours - pkg.hoursUsed;
            if (availableHours <= 0) continue;
            
            const hoursToDeduct = Math.min(remainingHours, availableHours);
            
            await prisma.package.update({
              where: { id: pkg.id },
              data: { hoursUsed: { increment: hoursToDeduct } }
            });
            
            remainingHours -= hoursToDeduct;
            console.log(`Deducted ${hoursToDeduct.toFixed(2)} hours from package ${pkg.id} for lesson ${lesson.id}`);
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

    // Verify lesson belongs to user
    const currentLesson = await prisma.lesson.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!currentLesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Get the student (either current or new if being changed)
    const finalStudentId = studentId || currentLesson.studentId;
    const student = await prisma.student.findFirst({
      where: { id: finalStudentId, userId: req.user.id },
      include: {} // We'll fetch it to get pricePerLesson
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Validate dateTime is provided
    if (!dateTime) {
      return res.status(400).json({ message: 'dateTime is required' });
    }

    // Calculate price based on student's hourly rate
    // The student's pricePerLesson is already set to package rate if a package was purchased
    const finalDuration = duration ? parseInt(duration) : currentLesson.duration;
    const hourlyRate = student.pricePerLesson || 0;
    const lessonHours = finalDuration / 60; // Convert minutes to hours
    const calculatedPrice = hourlyRate > 0 ? (hourlyRate * lessonHours) : (price !== undefined ? parseFloat(price) : currentLesson.price);

    const updateData = {
      studentId: finalStudentId,
      dateTime: new Date(dateTime),
      duration: finalDuration,
      subject: subject !== undefined ? subject : currentLesson.subject,
      price: calculatedPrice,
      notes: notes !== undefined ? (notes || null) : currentLesson.notes,
      status: status || currentLesson.status || 'scheduled',
      locationType: locationType || currentLesson.locationType || 'in-person',
      link: link !== undefined ? (link || null) : currentLesson.link,
      // iCal-style options
      allDay: allDay !== undefined ? allDay : currentLesson.allDay
    };

    // Check if converting recurring to single
    if (!isRecurring && currentLesson.isRecurring) {
      // Delete all future lessons in this recurring group (keep only the current one)
      if (currentLesson.recurringGroupId) {
        await prisma.lesson.deleteMany({
          where: {
            recurringGroupId: currentLesson.recurringGroupId,
            userId: req.user.id,
            dateTime: {
              gt: currentLesson.dateTime
            }
          }
        });
      }

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
        message: 'Converted to single lesson and deleted all future occurrences'
      });
    }
    // Check if converting single to recurring series
    else if (isRecurring && recurringFrequency && recurringEndDate && !currentLesson.isRecurring) {
      // Convert single lesson to recurring series
      const recurringGroupId = uuidv4();
      const startDate = new Date(dateTime);
      const endDate = new Date(recurringEndDate);
      // Ensure end date is inclusive (end of day)
      endDate.setHours(23, 59, 59, 999);

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
          userId: req.user.id,
          studentId: updateData.studentId || currentLesson.studentId,
          dateTime: date,
          duration: updateData.duration || currentLesson.duration,
          subject: updateData.subject || currentLesson.subject,
          price: updateData.price || currentLesson.price,
          notes: updateData.notes || currentLesson.notes,
          status: updateData.status || currentLesson.status || 'scheduled',
          isPaid: false, // New lessons are unpaid
          locationType: updateData.locationType || currentLesson.locationType || 'in-person',
          link: updateData.link || currentLesson.link,
          isRecurring: true,
          recurringFrequency,
          recurringEndDate: endDate,
          recurringGroupId,
          // iCal-style options
          allDay: updateData.allDay !== undefined ? updateData.allDay : (currentLesson.allDay || false)
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
    }
    // Check if updating existing recurring lesson
    // NOTE: PUT /:id is for SINGLE instance updates only - it should NEVER recreate the series or affect other lessons
    // For "this and future" updates or frequency changes, use PUT /:id/recurring-future instead
    else if (isRecurring && currentLesson.isRecurring) {
      // Single instance update - only update this one lesson, never touch other lessons in the series
      // For single updates, preserve the existing recurring metadata (don't allow changing frequency/endDate that would affect series)
      updateData.isRecurring = true;
      // Keep existing frequency and end date - don't allow changing these for single instance updates
      updateData.recurringFrequency = currentLesson.recurringFrequency;
      updateData.recurringEndDate = currentLesson.recurringEndDate;
      updateData.recurringGroupId = currentLesson.recurringGroupId;

      const lesson = await prisma.lesson.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          student: true
        }
      });

      res.json(lesson);
    }
    else {
      // Regular update (single lesson or converting to single)
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
    // Verify lesson belongs to user
    const lesson = await prisma.lesson.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!lesson || !lesson.recurringGroupId) {
      return res.status(404).json({ message: 'Recurring lesson not found' });
    }

    const { 
      studentId, dateTime, duration, subject, price, notes, status,
      locationType, link, isRecurring, recurringFrequency, recurringEndDate,
      allDay
    } = req.body;

    // Get the student for price calculations
    const finalStudentId = studentId || lesson.studentId;
    const student = await prisma.student.findFirst({
      where: { id: finalStudentId, userId: req.user.id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Prepare updateData first (needed for series recreation check)
    const updateData = {
      studentId: finalStudentId,
      dateTime: dateTime ? new Date(dateTime) : lesson.dateTime,
      duration: duration ? parseInt(duration) : lesson.duration,
      subject: subject !== undefined ? subject : lesson.subject,
      price: price !== undefined ? parseFloat(price) : lesson.price,
      notes: notes !== undefined ? (notes || null) : lesson.notes,
      status: status || lesson.status || 'scheduled',
      locationType: locationType || lesson.locationType || 'in-person',
      link: link !== undefined ? (link || null) : lesson.link,
      // iCal-style options
      allDay: allDay !== undefined ? allDay : lesson.allDay
    };

    // Check if dateTime is changing
    const dateTimeChanged = dateTime && new Date(dateTime).getTime() !== new Date(lesson.dateTime).getTime();
    
    // Check if this is the first lesson in the recurring series
    const allLessonsInSeries = await prisma.lesson.findMany({
      where: {
        recurringGroupId: lesson.recurringGroupId,
        userId: req.user.id
      },
      orderBy: {
        dateTime: 'asc'
      }
    });

    const isFirstLesson = allLessonsInSeries.length > 0 && allLessonsInSeries[0].id === lesson.id;
    
    // If first lesson and date changed (not just time), recreate entire series
    if (dateTimeChanged && isFirstLesson) {
      const newDateTime = new Date(dateTime);
      const oldDateTime = new Date(lesson.dateTime);
      
      // Check if same date (YYYY-MM-DD) but different time
      const newDateStr = `${newDateTime.getFullYear()}-${newDateTime.getMonth()}-${newDateTime.getDate()}`;
      const oldDateStr = `${oldDateTime.getFullYear()}-${oldDateTime.getMonth()}-${oldDateTime.getDate()}`;
      
      const onlyTimeChanged = newDateStr === oldDateStr;
      
      if (!onlyTimeChanged) {
        // Date changed - recreate entire series with new start date
        const newStartDate = new Date(dateTime);
        const endDate = recurringEndDate ? new Date(recurringEndDate) : lesson.recurringEndDate;
        // Ensure end date is inclusive (end of day)
        if (endDate) {
          endDate.setHours(23, 59, 59, 999);
        }
        const frequency = recurringFrequency || lesson.recurringFrequency;

        if (endDate && frequency) {
          // Delete all lessons in the series
          await prisma.lesson.deleteMany({
            where: {
              recurringGroupId: lesson.recurringGroupId,
              userId: req.user.id
            }
          });

          // Recreate the entire series starting from the new date
          const recurringGroupId = lesson.recurringGroupId || uuidv4();
          const dates = calculateRecurringDates(newStartDate, frequency, endDate);

          const lessonsData = dates.map((date) => ({
            userId: req.user.id,
            studentId: updateData.studentId || lesson.studentId,
            dateTime: date,
            duration: updateData.duration || lesson.duration,
            subject: updateData.subject !== undefined ? updateData.subject : lesson.subject,
            price: updateData.price !== undefined ? updateData.price : lesson.price,
            notes: updateData.notes !== undefined ? (updateData.notes || null) : lesson.notes,
            status: updateData.status || lesson.status || 'scheduled',
            isPaid: false, // New lessons are unpaid
            locationType: updateData.locationType || lesson.locationType || 'in-person',
            link: updateData.link !== undefined ? (updateData.link || null) : lesson.link,
            isRecurring: true,
            recurringFrequency: frequency,
            recurringEndDate: endDate,
            recurringGroupId,
            allDay: updateData.allDay !== undefined ? updateData.allDay : (lesson.allDay || false)
          }));

          await prisma.lesson.createMany({
            data: lessonsData
          });

          // Get the first lesson (which replaces the current one)
          const newFirstLesson = await prisma.lesson.findFirst({
            where: {
              recurringGroupId,
              userId: req.user.id
            },
            orderBy: {
              dateTime: 'asc'
            },
            include: {
              student: true
            }
          });

          return res.json({
            ...newFirstLesson,
            message: `Recurring series recreated with ${dates.length} lessons starting from new date`
          });
        }
      }
    }
    
    // Check if only the time changed (same date, different time) vs date changed
    // This check applies to all lessons, not just non-first lessons
    let onlyTimeChanged = false;
    let timeDifference = null;
    if (dateTimeChanged && dateTime) {
      const newDateTime = new Date(dateTime);
      const oldDateTime = new Date(lesson.dateTime);
      
      // Check if same date (YYYY-MM-DD) but different time
      const newDateStr = `${newDateTime.getFullYear()}-${newDateTime.getMonth()}-${newDateTime.getDate()}`;
      const oldDateStr = `${oldDateTime.getFullYear()}-${oldDateTime.getMonth()}-${oldDateTime.getDate()}`;
      
      if (newDateStr === oldDateStr) {
        // Only time changed - calculate the time difference
        onlyTimeChanged = true;
        timeDifference = newDateTime.getTime() - oldDateTime.getTime();
        console.log('[recurring-future] Only time changed. Time difference (ms):', timeDifference);
      }
    }
    
    console.log('[recurring-future] dateTimeChanged:', dateTimeChanged, 'onlyTimeChanged:', onlyTimeChanged, 'timeDifference:', timeDifference);

    // Check if converting recurring to non-recurring
    if (isRecurring === false && lesson.isRecurring) {
      // Delete all future lessons in this recurring group (keep only the current one)
      await prisma.lesson.deleteMany({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          userId: req.user.id,
          dateTime: {
            gt: lesson.dateTime
          }
        }
      });

      // Convert current and all remaining lessons in the series to single lessons
      await prisma.lesson.updateMany({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          userId: req.user.id,
          dateTime: {
            gte: lesson.dateTime
          }
        },
        data: {
          ...updateData,
          isRecurring: false,
          recurringFrequency: null,
          recurringEndDate: null,
          recurringGroupId: null
        }
      });

      const updatedLesson = await prisma.lesson.findUnique({
        where: { id: lesson.id },
        include: { student: true }
      });

      return res.json({
        ...updatedLesson,
        message: 'Converted to single lesson and deleted all future occurrences'
      });
    }

    // Check if frequency is being changed
    if (recurringFrequency && recurringFrequency !== lesson.recurringFrequency) {
      // Delete all future lessons (but keep the current one)
      await prisma.lesson.deleteMany({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          userId: req.user.id,
          dateTime: {
            gt: lesson.dateTime
          }
        }
      });

      // Determine the end date
      let endDate = recurringEndDate ? new Date(recurringEndDate) : 
                    lesson.recurringEndDate ? new Date(lesson.recurringEndDate) : null;
      // Ensure end date is inclusive (end of day)
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
      }
      
      // Use the new dateTime (which may have an updated time) for calculating future dates
      const startDateTime = dateTime ? new Date(dateTime) : new Date(lesson.dateTime);
      
      if (endDate) {
        // Generate new dates with the new frequency starting from the updated dateTime
        const newDates = calculateRecurringDates(startDateTime, recurringFrequency, endDate);
        
        // Create new lessons with the new frequency (skip first date as it's the current lesson)
        if (newDates.length > 1) {
          const newLessons = newDates.slice(1).map(date => ({
            userId: req.user.id,
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
      
      // Update the current lesson with new frequency and other data (including dateTime if changed)
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          ...updateData,
          dateTime: updateData.dateTime, // Include dateTime update - will be used as new start for series
          recurringFrequency: recurringFrequency,
          recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : lesson.recurringEndDate
        }
      });
      
      // If only time changed (not date), update time for all newly created lessons too
      if (onlyTimeChanged && timeDifference !== null) {
        // The new lessons were created starting from the updated dateTime, so they should already have the new time
        // But we need to ensure any existing lessons in the series (if frequency didn't change dates) also get updated
        const allLessonsInSeries = await prisma.lesson.findMany({
          where: {
            recurringGroupId: lesson.recurringGroupId,
            userId: req.user.id,
            dateTime: {
              gt: updateData.dateTime // Get lessons after the current one
            }
          }
        });

        // Update each existing lesson's time by adding the time difference
        for (const lessonInSeries of allLessonsInSeries) {
          const newDateTime = new Date(lessonInSeries.dateTime.getTime() + timeDifference);
          await prisma.lesson.update({
            where: { id: lessonInSeries.id },
            data: { dateTime: newDateTime }
          });
        }
      }
      
      const totalCount = await prisma.lesson.count({
        where: {
          recurringGroupId: lesson.recurringGroupId,
          userId: req.user.id,
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

    // If recurringEndDate is provided AND it's different from the current one
    const endDateChanged = recurringEndDate && (
      !lesson.recurringEndDate || 
      new Date(recurringEndDate).getTime() !== new Date(lesson.recurringEndDate).getTime()
    );
    
    if (endDateChanged) {
      const newEndDate = new Date(recurringEndDate);
      // Ensure end date is inclusive (end of day)
      newEndDate.setHours(23, 59, 59, 999);
      const currentEndDate = lesson.recurringEndDate ? new Date(lesson.recurringEndDate) : null;
      if (currentEndDate) {
        currentEndDate.setHours(23, 59, 59, 999);
      }

      // Update recurring end date for all lessons in the group
      updateData.recurringEndDate = newEndDate;

      // Update all lessons in the same recurring group that are on or after this lesson's date
      const { dateTime, ...updateDataWithoutDate } = updateData;
      
      if (onlyTimeChanged && timeDifference !== null) {
        // Only time changed - update time for all lessons in series while preserving their dates
        const allLessonsInSeries = await prisma.lesson.findMany({
          where: {
            recurringGroupId: lesson.recurringGroupId,
            userId: req.user.id,
            dateTime: {
              gte: lesson.dateTime
            }
          }
        });

        // Update each lesson's time by adding the time difference
        // Recalculate price using student's current hourly rate
        // (which is set to package rate if a package was purchased)
        const hourlyRate = student.pricePerLesson || 0;

        for (const lessonInSeries of allLessonsInSeries) {
          const newDateTime = new Date(lessonInSeries.dateTime.getTime() + timeDifference);
          const lessonDuration = updateData.duration !== undefined ? updateData.duration : lessonInSeries.duration;
          const lessonHours = lessonDuration / 60;
          
          // Calculate price using student's current hourly rate
          const recalculatedPrice = hourlyRate > 0 ? (hourlyRate * lessonHours) : (updateData.price !== undefined ? updateData.price : lessonInSeries.price);
          
          await prisma.lesson.update({
            where: { id: lessonInSeries.id },
            data: { 
              ...updateDataWithoutDate,
              dateTime: newDateTime,
              recurringEndDate: newEndDate,
              price: recalculatedPrice,
              duration: lessonDuration
            }
          });
        }
      } else {
        // Date changed or no dateTime change - update fields but preserve individual dates
        // Get all lessons to recalculate price based on each lesson's duration
        const allLessonsInSeries = await prisma.lesson.findMany({
          where: {
            recurringGroupId: lesson.recurringGroupId,
            userId: req.user.id,
            dateTime: {
              gte: lesson.dateTime
            }
          }
        });

        // Update each lesson individually to recalculate price using student's current hourly rate
        // (which is set to package rate if a package was purchased)
        const hourlyRate = student.pricePerLesson || 0;

        for (const lessonInSeries of allLessonsInSeries) {
          const lessonDuration = updateData.duration !== undefined ? updateData.duration : lessonInSeries.duration;
          const lessonHours = lessonDuration / 60;
          
          // Calculate price using student's current hourly rate
          const recalculatedPrice = hourlyRate > 0 ? (hourlyRate * lessonHours) : (updateData.price !== undefined ? updateData.price : lessonInSeries.price);
          
          await prisma.lesson.update({
            where: { id: lessonInSeries.id },
            data: {
              ...updateDataWithoutDate,
              price: recalculatedPrice,
              duration: lessonDuration,
              recurringEndDate: newEndDate,
              // Update dateTime separately if it changed (and wasn't just time)
              ...(dateTimeChanged && !onlyTimeChanged && lessonInSeries.id === lesson.id ? { dateTime: updateData.dateTime } : {})
            }
          });
        }
      }

      // If extending the series, create new lessons
      if (newEndDate > currentEndDate) {
        // Get all existing lessons to find the last one
        const existingLessons = await prisma.lesson.findMany({
          where: {
            recurringGroupId: lesson.recurringGroupId,
            userId: req.user.id
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
              userId: req.user.id,
              studentId: updateData.studentId,
              dateTime: date,
              duration: updateData.duration,
              subject: updateData.subject,
              price: updateData.price,
              notes: updateData.notes,
              status: updateData.status,
              isPaid: false, // New lessons are unpaid
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
            userId: req.user.id,
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
          userId: req.user.id,
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
      const { dateTime, ...updateDataWithoutDate } = updateData;
      
      if (onlyTimeChanged && timeDifference !== null) {
        // Only time changed - update time for all lessons in series while preserving their dates
        // Get all lessons in the series (including current one)
        const allLessonsInSeries = await prisma.lesson.findMany({
          where: {
            recurringGroupId: lesson.recurringGroupId,
            userId: req.user.id,
            dateTime: {
              gte: lesson.dateTime
            }
          }
        });

        console.log('[recurring-future] Found', allLessonsInSeries.length, 'lessons to update with new time');

        // Update each lesson's time by adding the time difference
        // Recalculate price using student's current hourly rate
        // (which is set to package rate if a package was purchased)
        const hourlyRate = student.pricePerLesson || 0;

        for (const lessonInSeries of allLessonsInSeries) {
          const newDateTime = new Date(lessonInSeries.dateTime.getTime() + timeDifference);
          console.log('[recurring-future] Updating lesson', lessonInSeries.id, 'from', lessonInSeries.dateTime.toISOString(), 'to', newDateTime.toISOString());
          const lessonDuration = updateData.duration !== undefined ? updateData.duration : lessonInSeries.duration;
          const lessonHours = lessonDuration / 60;
          
          // Calculate price using student's current hourly rate
          const recalculatedPrice = hourlyRate > 0 ? (hourlyRate * lessonHours) : (updateData.price !== undefined ? updateData.price : lessonInSeries.price);
          
          await prisma.lesson.update({
            where: { id: lessonInSeries.id },
            data: { 
              ...updateDataWithoutDate,
              dateTime: newDateTime,
              price: recalculatedPrice,
              duration: lessonDuration
            }
          });
        }

        res.json({ 
          message: `${allLessonsInSeries.length} lessons updated with new time`,
          count: allLessonsInSeries.length
        });
      } else {
        // Date changed or no dateTime change - update fields but preserve individual dates
        // Get all lessons to recalculate price based on each lesson's duration
        const allLessonsInSeries = await prisma.lesson.findMany({
          where: {
            recurringGroupId: lesson.recurringGroupId,
            userId: req.user.id,
            dateTime: {
              gte: lesson.dateTime
            }
          }
        });

        // Update each lesson individually to recalculate price using student's current hourly rate
        // (which is set to package rate if a package was purchased)
        const hourlyRate = student.pricePerLesson || 0;

        for (const lessonInSeries of allLessonsInSeries) {
          const lessonDuration = updateData.duration !== undefined ? updateData.duration : lessonInSeries.duration;
          const lessonHours = lessonDuration / 60;
          
          // Calculate price using student's current hourly rate
          const recalculatedPrice = hourlyRate > 0 ? (hourlyRate * lessonHours) : (updateData.price !== undefined ? updateData.price : lessonInSeries.price);
          
          await prisma.lesson.update({
            where: { id: lessonInSeries.id },
            data: {
              ...updateDataWithoutDate,
              price: recalculatedPrice,
              duration: lessonDuration,
              // Update dateTime separately if it changed (and wasn't just time)
              ...(dateTimeChanged && !onlyTimeChanged && lessonInSeries.id === lesson.id ? { dateTime: updateData.dateTime } : {})
            }
          });
        }

        res.json({ 
          message: `${allLessonsInSeries.length} lessons updated successfully`,
          count: allLessonsInSeries.length
        });
      }
    }
  } catch (error) {
    console.error('Update recurring lessons error:', error);
    res.status(500).json({ message: 'Error updating recurring lessons' });
  }
});

// Delete this and all future recurring lessons
router.delete('/:id/recurring-future', async (req, res) => {
  try {
    // Verify lesson belongs to user
    const lesson = await prisma.lesson.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!lesson || !lesson.recurringGroupId) {
      return res.status(404).json({ message: 'Recurring lesson not found' });
    }

    // Delete all lessons in the same recurring group that are on or after this lesson's date
    const result = await prisma.lesson.deleteMany({
      where: {
        recurringGroupId: lesson.recurringGroupId,
        userId: req.user.id,
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
    // Verify lesson belongs to user
    const lesson = await prisma.lesson.findFirst({
      where: { 
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        student: true
      }
    });

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // If lesson was paid or partially paid, redistribute the payment
    const paidAmount = lesson.paidAmount || 0;
    const wasPaidWithPackage = lesson.packageId !== null;
    let creditedHours = 0;
    let packageToReuse = null;
    
    if (paidAmount > 0 || wasPaidWithPackage) {
      // If lesson was paid with a package, credit the package back
      if (wasPaidWithPackage) {
        const pkg = await prisma.package.findFirst({
          where: { id: lesson.packageId, userId: req.user.id }
        });
        
        if (pkg) {
          // Calculate hours to credit back (lesson duration in hours)
          const lessonHours = (lesson.duration || 0) / 60;
          creditedHours = lessonHours;
          
          // Credit hours back to package (but don't exceed original totalHours)
          const newHoursUsed = Math.max(0, (pkg.hoursUsed || 0) - lessonHours);
          
          await prisma.package.update({
            where: { id: pkg.id },
            data: { hoursUsed: newHoursUsed }
          });
          
          packageToReuse = pkg;
          console.log(`[Lesson Delete] Credited ${lessonHours} hours back to package ${pkg.id}. New hoursUsed: ${newHoursUsed}/${pkg.totalHours}`);
        }
      }
      
      // If lesson was paid with a package, use the credited package hours to pay oldest unpaid lesson
      if (wasPaidWithPackage && packageToReuse && creditedHours > 0) {
        // Get the oldest unpaid lesson for this student
        const oldestUnpaidLesson = await prisma.lesson.findFirst({
          where: {
            userId: req.user.id,
            studentId: lesson.studentId,
            isPaid: false,
            id: { not: lesson.id }, // Exclude the lesson being deleted
            NOT: { status: { in: ['cancelled', 'canceled'] } }
          },
          orderBy: { dateTime: 'asc' }
        });

        if (oldestUnpaidLesson) {
          // Calculate the package hourly rate
          const packageHourlyRate = packageToReuse.price / packageToReuse.totalHours;
          // Calculate lesson price based on package rate
          const lessonHoursForPayment = oldestUnpaidLesson.duration / 60;
          const lessonPrice = oldestUnpaidLesson.price || (packageHourlyRate * lessonHoursForPayment);
          const currentPaidAmount = oldestUnpaidLesson.paidAmount || 0;
          const remainingNeeded = lessonPrice - currentPaidAmount;
          
          // Check if we have enough credited hours to pay this lesson
          if (creditedHours > 0 && remainingNeeded > 0) {
            // Calculate how much we can pay with the credited hours
            const amountFromCreditedHours = packageHourlyRate * Math.min(creditedHours, lessonHoursForPayment);
            
            if (amountFromCreditedHours >= remainingNeeded) {
              // Fully pay this lesson using credited package hours
              const hoursToUse = lessonHoursForPayment; // Use full lesson hours
              const newHoursUsed = Math.min(packageToReuse.totalHours, (packageToReuse.hoursUsed || 0) + hoursToUse);
              
              await prisma.lesson.update({
                where: { id: oldestUnpaidLesson.id },
                data: { 
                  isPaid: true,
                  paidAmount: lessonPrice,
                  packageId: packageToReuse.id // Link to package
                }
              });
              
              // Update package hours used
              await prisma.package.update({
                where: { id: packageToReuse.id },
                data: { hoursUsed: newHoursUsed }
              });
              
              console.log(`[Lesson Delete] Applied ${hoursToUse} hours from credited package to lesson ${oldestUnpaidLesson.id}. Package hoursUsed: ${newHoursUsed}/${packageToReuse.totalHours}`);
              
              // Remaining credited hours and paid amount go to credit
              creditedHours -= hoursToUse;
              if (creditedHours > 0 || paidAmount > 0) {
                const creditToAdd = (packageHourlyRate * creditedHours) + paidAmount;
                if (creditToAdd > 0) {
                  await prisma.student.update({
                    where: { id: lesson.studentId },
                    data: { credit: { increment: creditToAdd } }
                  });
                }
              }
            } else {
              // Partially pay this lesson using available credited hours
              const hoursToUse = Math.min(creditedHours, lessonHoursForPayment);
              const amountToApply = packageHourlyRate * hoursToUse;
              const newPaidAmount = currentPaidAmount + amountToApply;
              const newHoursUsed = Math.min(packageToReuse.totalHours, (packageToReuse.hoursUsed || 0) + hoursToUse);
              
              await prisma.lesson.update({
                where: { id: oldestUnpaidLesson.id },
                data: { 
                  isPaid: false,
                  paidAmount: newPaidAmount,
                  packageId: packageToReuse.id // Link to package
                }
              });
              
              // Update package hours used
              await prisma.package.update({
                where: { id: packageToReuse.id },
                data: { hoursUsed: newHoursUsed }
              });
              
              console.log(`[Lesson Delete] Applied ${hoursToUse} hours from credited package to partially pay lesson ${oldestUnpaidLesson.id}`);
              
              // Remaining credited hours and paid amount go to credit
              creditedHours -= hoursToUse;
              const creditToAdd = (packageHourlyRate * creditedHours) + paidAmount;
              if (creditToAdd > 0) {
                await prisma.student.update({
                  where: { id: lesson.studentId },
                  data: { credit: { increment: creditToAdd } }
                });
              }
            }
          } else {
            // Not enough credited hours or lesson already fully paid, add paidAmount to credit
            if (paidAmount > 0) {
              await prisma.student.update({
                where: { id: lesson.studentId },
                data: { credit: { increment: paidAmount } }
              });
            }
          }
        } else {
          // No unpaid lesson - add paidAmount to credit
          await prisma.student.update({
            where: { id: lesson.studentId },
            data: { credit: { increment: paidAmount } }
          });
        }
      } else if (!wasPaidWithPackage && paidAmount > 0) {
        // Regular payment (not from package) - redistribute to oldest unpaid lesson
        const oldestUnpaidLesson = await prisma.lesson.findFirst({
          where: {
            userId: req.user.id,
            studentId: lesson.studentId,
            isPaid: false,
            id: { not: lesson.id },
            NOT: { status: { in: ['cancelled', 'canceled'] } }
          },
          orderBy: { dateTime: 'asc' }
        });

        if (oldestUnpaidLesson) {
          const lessonPrice = oldestUnpaidLesson.price || 0;
          const currentPaidAmount = oldestUnpaidLesson.paidAmount || 0;
          const remainingNeeded = lessonPrice - currentPaidAmount;
          
          if (remainingNeeded > 0) {
            if (paidAmount >= remainingNeeded) {
              await prisma.lesson.update({
                where: { id: oldestUnpaidLesson.id },
                data: { 
                  isPaid: true,
                  paidAmount: lessonPrice,
                  paymentId: lesson.paymentId // Link to same payment
                }
              });
              
              const remainingPayment = paidAmount - remainingNeeded;
              if (remainingPayment > 0) {
                await prisma.student.update({
                  where: { id: lesson.studentId },
                  data: { credit: { increment: remainingPayment } }
                });
              }
            } else {
              const newPaidAmount = currentPaidAmount + paidAmount;
              await prisma.lesson.update({
                where: { id: oldestUnpaidLesson.id },
                data: { 
                  isPaid: false,
                  paidAmount: newPaidAmount,
                  paymentId: lesson.paymentId // Link to same payment
                }
              });
            }
          } else {
            await prisma.student.update({
              where: { id: lesson.studentId },
              data: { credit: { increment: paidAmount } }
            });
          }
        } else {
          await prisma.student.update({
            where: { id: lesson.studentId },
            data: { credit: { increment: paidAmount } }
          });
        }
      }
    } else if (wasPaidWithPackage) {
      // Lesson had no paid amount but was linked to package (edge case)
      // Still credit hours back to package
      const pkg = await prisma.package.findFirst({
        where: { id: lesson.packageId, userId: req.user.id }
      });
      
      if (pkg) {
        const lessonHours = (lesson.duration || 0) / 60;
        const newHoursUsed = Math.max(0, (pkg.hoursUsed || 0) - lessonHours);
        
        await prisma.package.update({
          where: { id: pkg.id },
          data: { hoursUsed: newHoursUsed }
        });
        
        console.log(`[Lesson Delete] Credited ${lessonHours} hours back to package ${pkg.id} (no payment amount). New hoursUsed: ${newHoursUsed}/${pkg.totalHours}`);
      }
    }

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
        userId: req.user.id,
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

