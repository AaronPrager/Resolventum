// Vercel Cron Job: Send daily schedule emails to all students/parents
// Runs daily at 8 AM (08:00 UTC)

export default async function handler(req, res) {
  // Vercel automatically adds authorization header for cron jobs
  // You can verify it if you set CRON_SECRET, but it's optional
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log('Running daily schedule report job (Vercel Cron)...');
    
    // Import dynamically to ensure Prisma client is initialized
    const { sendDailyScheduleReportManually } = await import('../../server/jobs/reminderScheduler.js');
    await sendDailyScheduleReportManually();
    
    res.status(200).json({ 
      success: true, 
      message: 'Daily schedule emails sent successfully' 
    });
  } catch (error) {
    console.error('Error in daily schedule cron job:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error sending daily schedule emails',
      error: error.stack
    });
  }
}

