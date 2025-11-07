import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixSpecificLesson() {
  try {
    // Find Nina Mariott's lesson on 2025-09-03
    const student = await prisma.student.findFirst({
      where: {
        firstName: { contains: 'Nina', mode: 'insensitive' },
        lastName: { contains: 'Mariott', mode: 'insensitive' }
      }
    });

    if (!student) {
      console.log('Student not found');
      return;
    }

    const lesson = await prisma.lesson.findFirst({
      where: {
        studentId: student.id,
        price: 110,
        dateTime: {
          gte: new Date('2025-09-03'),
          lt: new Date('2025-09-04')
        }
      },
      include: {
        payments: {
          select: {
            amount: true
          }
        }
      }
    });

    if (!lesson) {
      console.log('Lesson not found');
      return;
    }

    console.log(`\n=== FIXING LESSON ===\n`);
    console.log(`Lesson: ${student.firstName} ${student.lastName}`);
    console.log(`Date: ${lesson.dateTime.toISOString().split('T')[0]}`);
    console.log(`Price: $${lesson.price.toFixed(2)}`);
    console.log(`Current paidAmount: $${lesson.paidAmount.toFixed(2)}`);
    
    // Recalculate from all LessonPayment records
    const totalFromPayments = lesson.payments.reduce((sum, lp) => sum + (lp.amount || 0), 0);
    console.log(`Total from LessonPayment records: $${totalFromPayments.toFixed(2)}`);
    
    // paidAmount should be the sum of all LessonPayment amounts, capped at lesson price
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
      console.log(`Remaining: $${(lesson.price - correctPaidAmount).toFixed(2)}`);
    } else {
      console.log(`\n✅ Already correct`);
    }

  } catch (error) {
    console.error('Error fixing lesson:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSpecificLesson();



