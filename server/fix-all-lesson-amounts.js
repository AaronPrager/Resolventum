import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixAllLessonAmounts() {
  try {
    // Find all lessons with discrepancies
    const lessons = await prisma.lesson.findMany({
      where: {
        price: { gt: 0 }
      },
      include: {
        payments: {
          select: {
            amount: true
          }
        }
      }
    });

    console.log(`\n=== FIXING ALL LESSON PAID AMOUNTS ===\n`);
    let fixed = 0;
    
    for (const lesson of lessons) {
      const totalFromPayments = lesson.payments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
      const correctPaidAmount = Math.min(totalFromPayments, lesson.price);
      const currentPaidAmount = lesson.paidAmount || 0;
      
      if (Math.abs(currentPaidAmount - correctPaidAmount) > 0.01) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: {
            paidAmount: correctPaidAmount,
            isPaid: correctPaidAmount >= lesson.price
          }
        });
        fixed++;
        console.log(`Fixed lesson ${lesson.id}: $${currentPaidAmount.toFixed(2)} -> $${correctPaidAmount.toFixed(2)} (Price: $${lesson.price.toFixed(2)}, From Payments: $${totalFromPayments.toFixed(2)})`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} lessons`);
    
  } catch (error) {
    console.error('Error fixing lesson amounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllLessonAmounts();



