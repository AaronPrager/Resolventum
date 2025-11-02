import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanupPayments() {
  try {
    console.log('Starting payment cleanup...');
    
    // Mark all lessons as unpaid
    const lessonsUpdate = await prisma.lesson.updateMany({
      data: {
        isPaid: false,
        paidAmount: 0,
        packageId: null // Unlink from packages
      }
    });
    
    console.log(`Updated ${lessonsUpdate.count} lessons - marked as unpaid`);
    
    // Set all student credits to 0
    const studentsUpdate = await prisma.student.updateMany({
      data: {
        credit: 0
      }
    });
    
    console.log(`Updated ${studentsUpdate.count} students - credit set to 0`);
    
    // Reset all package hoursUsed to 0
    const packagesUpdate = await prisma.package.updateMany({
      data: {
        hoursUsed: 0
      }
    });
    
    console.log(`Updated ${packagesUpdate.count} packages - hoursUsed reset to 0`);
    
    console.log('Cleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupPayments();

