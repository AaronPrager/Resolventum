import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLessonPayment() {
  try {
    // Find lessons with price $110 and paidAmount around $95
    const lessons = await prisma.lesson.findMany({
      where: {
        price: 110,
        paidAmount: { gte: 90, lte: 100 }
      },
      include: {
        payments: {
          include: {
            payment: {
              select: {
                id: true,
                amount: true,
                date: true,
                method: true
              }
            }
          }
        },
        student: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { dateTime: 'desc' },
      take: 10
    });

    console.log('\n=== LESSON PAYMENT DISCREPANCY CHECK ===\n');
    
    for (const lesson of lessons) {
      console.log(`\nLesson: ${lesson.student.firstName} ${lesson.student.lastName}`);
      console.log(`  Date: ${lesson.dateTime.toISOString().split('T')[0]}`);
      console.log(`  Price: $${lesson.price.toFixed(2)}`);
      console.log(`  Paid Amount (from lesson): $${lesson.paidAmount.toFixed(2)}`);
      console.log(`  Is Paid: ${lesson.isPaid}`);
      console.log(`  Remaining: $${(lesson.price - lesson.paidAmount).toFixed(2)}`);
      
      if (lesson.payments.length > 0) {
        console.log(`  \n  Payments linked:`);
        let totalFromPayments = 0;
        for (const lp of lesson.payments) {
          console.log(`    - Payment ${lp.payment.id}: $${lp.amount.toFixed(2)} from payment of $${lp.payment.amount.toFixed(2)} on ${lp.payment.date.toISOString().split('T')[0]}`);
          totalFromPayments += lp.amount;
        }
        console.log(`    Total from all LessonPayment records: $${totalFromPayments.toFixed(2)}`);
        console.log(`    Difference: $${(lesson.paidAmount - totalFromPayments).toFixed(2)}`);
        
        if (Math.abs(lesson.paidAmount - totalFromPayments) > 0.01) {
          console.log(`    ⚠️  DISCREPANCY DETECTED!`);
        }
      } else {
        console.log(`  No payments linked`);
      }
    }
    
  } catch (error) {
    console.error('Error checking lesson payment:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLessonPayment();



