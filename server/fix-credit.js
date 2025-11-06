import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixMariottCredit() {
  try {
    // Find Timothy Marriott
    const student = await prisma.student.findFirst({
      where: {
        lastName: { contains: 'Marriott', mode: 'insensitive' },
        firstName: { contains: 'Timothy', mode: 'insensitive' }
      }
    });

    if (!student) {
      console.log('Student not found');
      return;
    }

    console.log(`\n=== FIXING CREDIT FOR ${student.firstName} ${student.lastName} ===\n`);
    console.log(`Current credit: $${(student.credit || 0).toFixed(2)}`);

    // Find the $100 payment that was made on 2025-10-07
    const payment = await prisma.payment.findFirst({
      where: {
        studentId: student.id,
        amount: 100,
        date: {
          gte: new Date('2025-10-07'),
          lte: new Date('2025-10-08')
        }
      },
      include: {
        lessons: {
          select: {
            amount: true,
            lesson: {
              select: {
                id: true,
                dateTime: true,
                price: true,
                paidAmount: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      console.log('Payment not found');
      return;
    }

    const totalApplied = payment.lessons.reduce((sum, lp) => sum + (lp.amount || 0), 0);
    const remaining = payment.amount - totalApplied;

    console.log(`Payment: $${payment.amount.toFixed(2)}`);
    console.log(`Applied to lessons: $${totalApplied.toFixed(2)}`);
    console.log(`Remaining: $${remaining.toFixed(2)}`);

    if (remaining > 0.01) {
      // Add the remaining amount to credit
      const newCredit = (student.credit || 0) + remaining;
      await prisma.student.update({
        where: { id: student.id },
        data: { credit: newCredit }
      });
      console.log(`\n✅ Fixed! Added $${remaining.toFixed(2)} to credit.`);
      console.log(`New credit balance: $${newCredit.toFixed(2)}`);
    } else {
      console.log(`\n✅ Credit is already correct (no remaining amount).`);
    }

  } catch (error) {
    console.error('Error fixing credit:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMariottCredit();


