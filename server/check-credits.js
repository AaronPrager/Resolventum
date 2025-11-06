import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkMariottCredits() {
  try {
    // Find all students with "Mariott" in their name (case-insensitive)
    const students = await prisma.student.findMany({
      where: {
        OR: [
          { lastName: { contains: 'Mariott', mode: 'insensitive' } },
          { lastName: { contains: 'Marriott', mode: 'insensitive' } },
          { firstName: { contains: 'Mariott', mode: 'insensitive' } },
          { firstName: { contains: 'Marriott', mode: 'insensitive' } }
        ],
        archived: false
      },
      include: {
        payments: {
          orderBy: { date: 'desc' },
          take: 5, // Last 5 payments
          include: {
            lessons: {
              select: {
                amount: true,
                lesson: {
                  select: {
                    id: true,
                    dateTime: true,
                    price: true,
                    paidAmount: true,
                    isPaid: true
                  }
                }
              }
            }
          }
        },
        lessons: {
          where: {
            paidAmount: { gt: 0 }
          },
          orderBy: { dateTime: 'desc' },
          take: 10 // Last 10 paid/partially paid lessons
        }
      }
    });

    console.log('\n=== MARIOTT FAMILY CREDIT CHECK ===\n');
    
    if (students.length === 0) {
      console.log('No students found with "Mariott" or "Marriott" in name.');
      return;
    }

    // Group by familyId
    const families = {};
    students.forEach(student => {
      const familyKey = student.familyId || `individual-${student.id}`;
      if (!families[familyKey]) {
        families[familyKey] = [];
      }
      families[familyKey].push(student);
    });

    for (const [familyKey, familyMembers] of Object.entries(families)) {
      console.log(`\n--- Family: ${familyKey === 'individual' ? 'Individual Students' : `Family ID: ${familyKey}`} ---\n`);
      
      for (const student of familyMembers) {
        console.log(`Student: ${student.firstName} ${student.lastName}`);
        console.log(`  ID: ${student.id}`);
        console.log(`  Credit Balance: $${(student.credit || 0).toFixed(2)}`);
        console.log(`  Family ID: ${student.familyId || 'N/A'}`);
        
        // Show recent payments
        if (student.payments.length > 0) {
          console.log(`\n  Recent Payments:`);
          for (const payment of student.payments) {
            const totalApplied = payment.lessons.reduce((sum, lp) => sum + (lp.amount || 0), 0);
            const remaining = payment.amount - totalApplied;
            console.log(`    - Payment: $${payment.amount.toFixed(2)} on ${payment.date.toISOString().split('T')[0]}`);
            console.log(`      Applied to lessons: $${totalApplied.toFixed(2)}`);
            if (remaining > 0.01) {
              console.log(`      ⚠️  Remaining: $${remaining.toFixed(2)} (should be credit or applied elsewhere)`);
            }
            if (payment.lessons.length > 0) {
              payment.lessons.forEach(lp => {
                const lesson = lp.lesson;
                console.log(`        → Lesson ${lesson.dateTime.toISOString().split('T')[0]}: $${lp.amount.toFixed(2)} (Lesson price: $${lesson.price.toFixed(2)}, Paid: $${lesson.paidAmount.toFixed(2)})`);
              });
            }
          }
        }
        
        // Show recent lessons with payments
        if (student.lessons.length > 0) {
          console.log(`\n  Recent Paid/Partially Paid Lessons:`);
          for (const lesson of student.lessons) {
            const remaining = lesson.price - lesson.paidAmount;
            console.log(`    - ${lesson.dateTime.toISOString().split('T')[0]}: Price $${lesson.price.toFixed(2)}, Paid $${lesson.paidAmount.toFixed(2)}, Remaining $${remaining.toFixed(2)}, ${lesson.isPaid ? 'Fully Paid' : 'Partially Paid'}`);
          }
        }
        
        console.log('');
      }
      
      // Total family credit
      const totalFamilyCredit = familyMembers.reduce((sum, s) => sum + (s.credit || 0), 0);
      if (totalFamilyCredit > 0.01) {
        console.log(`⚠️  TOTAL FAMILY CREDIT: $${totalFamilyCredit.toFixed(2)}\n`);
      }
    }
    
  } catch (error) {
    console.error('Error checking credits:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMariottCredits();

