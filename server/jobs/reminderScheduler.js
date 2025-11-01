import cron from 'node-cron';
import twilio from 'twilio';
import prisma from '../prisma/client.js';

// Only initialize Twilio if credentials are provided
const hasTwilioConfig = process.env.TWILIO_ACCOUNT_SID && 
                        process.env.TWILIO_AUTH_TOKEN && 
                        process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

if (hasTwilioConfig) {
  try {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('Twilio client initialized');
  } catch (error) {
    console.warn('Failed to initialize Twilio client:', error.message);
  }
} else {
  console.log('Twilio not configured - SMS reminders will be disabled');
}

export function initializeScheduledJobs() {
  // Skip scheduled jobs in serverless environments (Vercel, AWS Lambda, etc.)
  // Use Vercel Cron Jobs or external cron service instead
  const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_URL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (isServerless) {
    console.log('Scheduled jobs skipped (serverless environment - use Vercel Cron Jobs)');
    return;
  }

  if (!hasTwilioConfig) {
    console.log('Scheduled jobs initialized (SMS reminders disabled)');
    return;
  }

  // Run every day at 6 PM to send reminders for next day's lessons
  cron.schedule('0 18 * * *', async () => {
    console.log('Running scheduled reminder job...');
    await sendReminders();
  });

  console.log('Scheduled jobs initialized');
}

async function sendReminders() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setHours(23, 59, 59, 999);

    // Get all scheduled lessons for tomorrow
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

    console.log(`Found ${lessons.length} lessons for tomorrow`);

    // Send SMS for each lesson
    if (!twilioClient) {
      console.log('Twilio not configured - skipping SMS reminders');
      return;
    }

    for (const lesson of lessons) {
      if (lesson.student.phone) {
        try {
          const dateTime = new Date(lesson.dateTime);
          const timeStr = dateTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
          });

          await twilioClient.messages.create({
            body: `Reminder: You have a ${lesson.subject} lesson tomorrow at ${timeStr}. See you there!`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: lesson.student.phone
          });

          console.log(`Reminder sent to ${lesson.student.firstName} ${lesson.student.lastName}`);
        } catch (error) {
          console.error(`Error sending reminder to ${lesson.student.phone}:`, error);
        }
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

