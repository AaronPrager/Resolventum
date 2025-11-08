// Vercel Cron Job: Send reminder emails for tomorrow's lessons
// Runs daily at 6 PM (18:00 UTC)

export default async function handler(req, res) {
  // Vercel automatically adds authorization header for cron jobs
  // You can verify it if you set CRON_SECRET, but it's optional
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log('Running scheduled reminder job (Vercel Cron)...');
    
    // Import dynamically to ensure Prisma client is initialized
    const { sendRemindersManually } = await import('../../server/jobs/reminderScheduler.js');
    await sendRemindersManually();
    
    res.status(200).json({ 
      success: true, 
      message: 'Reminder emails sent successfully' 
    });
  } catch (error) {
    console.error('Error in reminder cron job:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error sending reminder emails',
      error: error.stack
    });
  }
}

