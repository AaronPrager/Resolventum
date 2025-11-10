import prisma from '../prisma/client.js';
import { sendEmail, isEmailConfigured } from '../utils/emailService.js';

async function sendReminders() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setHours(23, 59, 59, 999);

    // Get all lessons for tomorrow
    const lessons = await prisma.lesson.findMany({
      where: {
        dateTime: {
          gte: tomorrow,
          lte: dayAfter
        }
      },
      include: {
        student: true
      }
    });

    console.log(`Found ${lessons.length} lessons for tomorrow`);

    // Send email for each lesson
    if (!isEmailConfigured()) {
      console.log('Email not configured - skipping email reminders');
      return;
    }

    for (const lesson of lessons) {
      // Use parent email if available, otherwise student email
      const recipientEmail = lesson.student.parentEmail || lesson.student.email;
      
      if (!recipientEmail) {
        console.log(`No email address for student ${lesson.student.firstName} ${lesson.student.lastName}`);
        continue;
      }

      try {
        const dateTime = new Date(lesson.dateTime);
        const timeStr = dateTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit'
        });
        const dateStr = dateTime.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'long', 
          day: 'numeric'
        });

        const subject = `Lesson Reminder: ${lesson.subject} tomorrow at ${timeStr}`;
        const text = `Hello ${lesson.student.parentFullName || lesson.student.firstName},\n\n` +
          `This is a reminder that ${lesson.student.firstName} ${lesson.student.lastName} has a ${lesson.subject} lesson tomorrow (${dateStr}) at ${timeStr}.\n\n` +
          `See you there!`;

        await sendEmail({
          to: recipientEmail,
          subject: subject,
          text: text
        });

        console.log(`Reminder email sent to ${recipientEmail} for ${lesson.student.firstName} ${lesson.student.lastName}`);
      } catch (error) {
        console.error(`Error sending reminder email to ${recipientEmail}:`, error);
      }
    }

    console.log('Reminder job completed');
  } catch (error) {
    console.error('Error in reminder scheduler:', error);
  }
}

// Manual trigger function for testing
export async function sendRemindersManually() {
  await sendReminders();
}

async function sendDailyScheduleReport() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all lessons for today across all users
    const lessons = await prisma.lesson.findMany({
      where: {
        dateTime: {
          gte: today,
          lte: endOfDay
        }
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            parentPhone: true,
            email: true,
            parentEmail: true,
            familyId: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      },
      orderBy: {
        dateTime: 'asc'
      }
    });

    console.log(`Found ${lessons.length} lessons for today`);

    if (!isEmailConfigured()) {
      console.log('Email not configured - skipping daily schedule report');
      return;
    }

    if (lessons.length === 0) {
      console.log('No lessons scheduled for today');
      return;
    }

    // Group lessons by user, then by student/family
    const lessonsByUser = new Map();
    for (const lesson of lessons) {
      const userId = lesson.userId;
      if (!lessonsByUser.has(userId)) {
        lessonsByUser.set(userId, {
          user: lesson.user,
          recipients: new Map()
        });
      }
      
      const studentId = lesson.student.id;
      const familyId = lesson.student.familyId;
      // For families, group all family members together; for individual students, use student ID
      const key = familyId ? `family_${familyId}` : `student_${studentId}`;
      
      if (!lessonsByUser.get(userId).recipients.has(key)) {
        lessonsByUser.get(userId).recipients.set(key, {
          student: lesson.student,
          familyId: familyId,
          lessons: [],
          email: lesson.student.parentEmail || lesson.student.email
        });
      }
      
      lessonsByUser.get(userId).recipients.get(key).lessons.push(lesson);
    }

    // Send schedule to each student/parent
    for (const [userId, userData] of lessonsByUser) {
      for (const [key, data] of userData.recipients) {
        const { student, lessons: studentLessons, familyId, email } = data;
        
        if (!email) {
          const studentName = familyId 
            ? `Family ${familyId}` 
            : `${student.firstName} ${student.lastName}`;
          console.log(`No email address for ${studentName}`);
          continue;
        }

        try {
          // Format the schedule message
          const companyName = userData.user.companyName || userData.user.name || 'Tutoring';
          
          // For families, get all family member names
          let recipientName;
          if (familyId) {
            // Get all unique student names from the lessons
            const studentNames = [...new Set(studentLessons.map(l => 
              `${l.student.firstName} ${l.student.lastName}`
            ))];
            recipientName = studentNames.length > 1 
              ? `${studentNames.join(', ')} (Family)`
              : studentNames[0];
          } else {
            recipientName = `${student.firstName} ${student.lastName}`;
          }
          
          // Sort lessons by time
          const sortedLessons = [...studentLessons].sort((a, b) => 
            new Date(a.dateTime) - new Date(b.dateTime)
          );
          
          // Build email content
          let emailText = `Today's Lesson Schedule for ${recipientName}\n\n`;
          let emailHtml = `<h2>Today's Lesson Schedule for ${recipientName}</h2><ul>`;
          
          for (const lesson of sortedLessons) {
            const dateTime = new Date(lesson.dateTime);
            const timeStr = dateTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit'
            });
            const location = lesson.locationType === 'remote' ? ' (Remote)' : '';
            // For families, include student name with each lesson
            const studentName = familyId 
              ? `${lesson.student.firstName} ${lesson.student.lastName}: `
              : '';
            
            const lessonText = `${timeStr} - ${studentName}${lesson.subject} (${lesson.duration} min)${location}`;
            emailText += `• ${lessonText}\n`;
            emailHtml += `<li>${lessonText}</li>`;
          }
          
          emailText += `\nTotal: ${sortedLessons.length} lesson${sortedLessons.length !== 1 ? 's' : ''} today.\n\n${companyName}`;
          emailHtml += `</ul><p><strong>Total: ${sortedLessons.length} lesson${sortedLessons.length !== 1 ? 's' : ''} today.</strong></p><p>${companyName}</p>`;

          const subject = `Today's Lesson Schedule - ${recipientName}`;

          await sendEmail({
            to: email,
            subject: subject,
            text: emailText,
            html: emailHtml
          });

          console.log(`Daily schedule email sent to ${recipientName} (${email})`);
        } catch (error) {
          console.error(`Error sending schedule email to ${email}:`, error);
        }
      }
    }

    console.log('Daily schedule report job completed');
  } catch (error) {
    console.error('Error in daily schedule report:', error);
  }
}

// Manual trigger function for testing daily schedule report
export async function sendDailyScheduleReportManually() {
  await sendDailyScheduleReport();
}

// Send teacher's daily schedule via email (for manual use)
export async function sendTeacherDailyScheduleEmail(userId, userEmail) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all lessons for today for this teacher
    const lessons = await prisma.lesson.findMany({
      where: {
        userId: userId,
        dateTime: {
          gte: today,
          lte: endOfDay
        }
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            familyId: true,
            phone: true,
            email: true,
            parentPhone: true,
            parentEmail: true
          }
        }
      },
      orderBy: {
        dateTime: 'asc'
      }
    });

    if (lessons.length === 0) {
      throw new Error('No lessons scheduled for today');
    }

    // Get user info for company name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        companyName: true
      }
    });

    const companyName = user?.companyName || user?.name || 'Tutoring';

    // Group lessons by student/family
    const lessonsByStudent = new Map();
    for (const lesson of lessons) {
      const studentId = lesson.student.id;
      const familyId = lesson.student.familyId;
      const key = familyId ? `family_${familyId}` : `student_${studentId}`;
      
      if (!lessonsByStudent.has(key)) {
        lessonsByStudent.set(key, {
          student: lesson.student,
          familyId: familyId,
          lessons: []
        });
      }
      
      lessonsByStudent.get(key).lessons.push(lesson);
    }

    // Format the email content - simple format
    let emailText = `Today's Schedule:\n\n`;
    let emailHtml = `<h2>Today's Schedule:</h2>`;
    
    // Sort all lessons by time
    const allLessons = [];
    for (const lesson of lessons) {
      allLessons.push({
        student: lesson.student,
        dateTime: lesson.dateTime,
        duration: lesson.duration
      });
    }
    allLessons.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    // Group by student/family and format
    const studentSchedule = new Map();
    for (const lesson of allLessons) {
      const studentId = lesson.student.id;
      const familyId = lesson.student.familyId;
      const key = familyId ? `family_${familyId}` : `student_${studentId}`;
      
      if (!studentSchedule.has(key)) {
        const studentName = familyId 
          ? `${lesson.student.firstName} ${lesson.student.lastName} (Family)`
          : `${lesson.student.firstName} ${lesson.student.lastName}`;
        
        // Get contact info - only student's own contact
        const contactPhone = lesson.student.phone;
        const contactEmail = lesson.student.email;
        
        studentSchedule.set(key, {
          name: studentName,
          phone: contactPhone,
          email: contactEmail,
          lessons: []
        });
      }
      
      const startTime = new Date(lesson.dateTime);
      const endTime = new Date(startTime.getTime() + lesson.duration * 60000);
      
      const fromTime = startTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
      const toTime = endTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
      
      studentSchedule.get(key).lessons.push({ fromTime, toTime });
    }
    
    // Build email text and HTML
    for (const [key, data] of studentSchedule) {
      for (const lesson of data.lessons) {
        emailText += `${data.name}: ${lesson.fromTime} - ${lesson.toTime}\n`;
        emailHtml += `<p>${data.name}: ${lesson.fromTime} - ${lesson.toTime}</p>`;
      }
      
      // Add contact information if available
      const contactInfo = [];
      if (data.phone) {
        contactInfo.push(`Phone: ${data.phone}`);
      }
      if (data.email) {
        contactInfo.push(`Email: ${data.email}`);
      }
      
      if (contactInfo.length > 0) {
        emailText += `  ${contactInfo.join(', ')}\n`;
        emailHtml += `<p style="margin-left: 20px; color: #666;">${contactInfo.join(', ')}</p>`;
      }
    }
    
    emailText += `\nTotal: ${lessons.length} lesson${lessons.length !== 1 ? 's' : ''} today`;
    emailHtml += `<p><strong>Total: ${lessons.length} lesson${lessons.length !== 1 ? 's' : ''} today</strong></p>`;

    // Format date as "January 15, 2025" or similar
    const dateStr = today.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const subject = `${dateStr} Schedule`;

    if (!isEmailConfigured()) {
      throw new Error('Email service not configured');
    }

    if (!userEmail) {
      throw new Error('Teacher email address not found');
    }

    // Send the email
    await sendEmail({
      to: userEmail,
      subject: subject,
      text: emailText,
      html: emailHtml
    });

    console.log(`Teacher schedule email sent to ${userEmail}`);
    return { 
      success: true, 
      message: 'Schedule sent successfully',
      lessonCount: lessons.length 
    };
  } catch (error) {
    console.error('Error sending teacher schedule email:', error);
    throw error;
  }
}

