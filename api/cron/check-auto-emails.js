// Vercel Cron Job: Check and send automatic schedule emails
// Runs every hour to check all users' auto-email settings

export default async function handler(req, res) {
  try {
    console.log('Running auto-email check job (Vercel Cron)...');
    
    // Import dynamically
    const prisma = (await import('../../server/prisma/client.js')).default;
    const { sendTeacherDailyScheduleEmail } = await import('../../server/jobs/reminderScheduler.js');
    
    // Get current time in HH:MM format
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    
    console.log(`Checking for auto-emails at ${currentTime}`);
    
    // Get all users with auto-email enabled and matching time
    // Note: This checks for exact time match. Since cron runs every hour at minute 0,
    // it will match times like 08:00, 09:00, 10:00, etc.
    const users = await prisma.user.findMany({
      where: {
        autoEmailEnabled: true,
        autoEmailTime: currentTime, // Match current time exactly
        autoEmailAddress: { not: null } // Must have email address
      },
      select: {
        id: true,
        name: true,
        autoEmailAddress: true
      }
    });
    
    console.log(`Found ${users.length} users to send auto-emails to at ${currentTime}`);
    
    const results = [];
    
    for (const user of users) {
      try {
        await sendTeacherDailyScheduleEmail(user.id, user.autoEmailAddress);
        results.push({ userId: user.id, name: user.name, email: user.autoEmailAddress, success: true });
        console.log(`Auto-email sent successfully to ${user.autoEmailAddress} for user ${user.name} (${user.id})`);
      } catch (error) {
        console.error(`Error sending auto-email to user ${user.id}:`, error);
        results.push({ userId: user.id, name: user.name, email: user.autoEmailAddress, success: false, error: error.message });
      }
    }
    
    res.status(200).json({ 
      success: true, 
      time: currentTime,
      usersChecked: users.length,
      emailsSent: results.filter(r => r.success).length,
      results: results
    });
  } catch (error) {
    console.error('Error in auto-email check cron job:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error checking auto-emails',
      error: error.stack
    });
  }
}

