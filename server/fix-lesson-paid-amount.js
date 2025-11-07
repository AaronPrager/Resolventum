import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixLessonPaidAmount() {
  try {
    // Find the lesson with the discrepancy
    const lesson = await prisma.lesson.findFirst({
      where: {
        price: 110,
        paidAmount: 95
      },
      include: {
        payments: {
          include: {
            payment: true
          }
        },
        student: true
      }
    });

    if (!lesson) {
      console.log('Lesson not found');
      return;
    }

    console.log(`\n=== FIXING LESSON PAID AMOUNT ===\n`);
    console.log(`Lesson: ${lesson.student.firstName} ${lesson.student.lastName}`);
    console.log(`Date: ${lesson.dateTime.toISOString().split('T')[0]}`);
    console.log(`Price: $${lesson.price.toFixed(2)}`);
    console.log(`Current paidAmount: $${lesson.paidAmount.toFixed(2)}`);
    
    // Recalculate from all LessonPayment records
    const totalFromPayments = lesson.payments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
    console.log(`Total from LessonPayment records: $${totalFromPayments.toFixed(2)}`);
    
    // The paidAmount should be the sum of all LessonPayment amounts
    // (credit is tracked separately and not in LessonPayment)
    // But we should cap it at the lesson price
    const correctPaidAmount = Math.min(totalFromPayments, lesson.price);
    
    console.log(`Correct paidAmount: $${correctPaidAmount.toFixed(2)}`);
    
    if (Math.abs(lesson.paidAmount - correctPaidAmount) > 0.01) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          paidAmount: correctPaidAmount,
          isPaid: correctPaidAmount >= lesson.price
        }
      });
      console.log(`\n✅ Fixed! Updated paidAmount from $${lesson.paidAmount.toFixed(2)} to $${correctPaidAmount.toFixed(2)}`);
    } else {
      console.log(`\n✅ Already correct`);
    }

  } catch (error) {
    console.error('Error fixing lesson paid amount:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLessonPaidAmount();




