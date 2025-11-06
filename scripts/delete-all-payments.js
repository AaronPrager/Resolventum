#!/usr/bin/env node

/**
 * Script to delete all payments from the system
 * Keeps students and lessons intact
 * 
 * This script will:
 * 1. Reset all lesson payment statuses (isPaid, paidAmount)
 * 2. Unlink packages from payments (keep packages but remove payment link)
 * 3. Delete all LessonPayment records (junction table)
 * 4. Delete all Payment records
 * 
 * Usage: node scripts/delete-all-payments.js [--confirm]
 */

import prisma from '../server/prisma/client.js';

async function deleteAllPayments() {
  try {
    console.log('🚀 Starting payment deletion process...\n');

    // Step 1: Count existing data
    const paymentCount = await prisma.payment.count();
    const lessonPaymentCount = await prisma.lessonPayment.count();
    const lessonCount = await prisma.lesson.count();
    const packageCount = await prisma.package.count({
      where: { paymentId: { not: null } }
    });

    console.log('📊 Current data:');
    console.log(`   - Payments: ${paymentCount}`);
    console.log(`   - Lesson-Payment links: ${lessonPaymentCount}`);
    console.log(`   - Lessons: ${lessonCount}`);
    console.log(`   - Packages linked to payments: ${packageCount}\n`);

    if (paymentCount === 0) {
      console.log('✅ No payments found. Nothing to delete.');
      return;
    }

    // Step 2: Reset all lesson payment statuses
    console.log('🔄 Step 1: Resetting lesson payment statuses...');
    const resetResult = await prisma.lesson.updateMany({
      data: {
        isPaid: false,
        paidAmount: 0,
        packageId: null // Unlink packages from lessons as well
      }
    });
    console.log(`   ✓ Reset ${resetResult.count} lessons\n`);

    // Step 3: Unlink packages from payments (keep packages but remove payment link)
    console.log('🔄 Step 2: Unlinking packages from payments...');
    const unlinkPackagesResult = await prisma.package.updateMany({
      where: { paymentId: { not: null } },
      data: { paymentId: null }
    });
    console.log(`   ✓ Unlinked ${unlinkPackagesResult.count} packages from payments\n`);

    // Step 4: Delete all LessonPayment records (junction table)
    console.log('🔄 Step 3: Deleting lesson-payment links...');
    const deleteLessonPaymentsResult = await prisma.lessonPayment.deleteMany({});
    console.log(`   ✓ Deleted ${deleteLessonPaymentsResult.count} lesson-payment links\n`);

    // Step 5: Delete all Payment records
    console.log('🔄 Step 4: Deleting all payments...');
    const deletePaymentsResult = await prisma.payment.deleteMany({});
    console.log(`   ✓ Deleted ${deletePaymentsResult.count} payments\n`);

    // Step 6: Verify deletion
    const remainingPayments = await prisma.payment.count();
    const remainingLessonPayments = await prisma.lessonPayment.count();
    const remainingLessons = await prisma.lesson.count();

    console.log('✅ Payment deletion completed!\n');
    console.log('📊 Final data:');
    console.log(`   - Payments: ${remainingPayments}`);
    console.log(`   - Lesson-Payment links: ${remainingLessonPayments}`);
    console.log(`   - Lessons: ${remainingLessons} (preserved)`);
    console.log(`   - Students: (preserved)\n`);

    if (remainingPayments > 0 || remainingLessonPayments > 0) {
      console.log('⚠️  Warning: Some payments or links may still exist.');
    } else {
      console.log('✨ All payments successfully deleted!');
    }

  } catch (error) {
    console.error('❌ Error deleting payments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Check for confirmation flag
const args = process.argv.slice(2);
const confirmed = args.includes('--confirm') || args.includes('-y');

if (!confirmed) {
  console.log('⚠️  WARNING: This will delete ALL payments from the system!');
  console.log('   Students and lessons will be preserved.');
  console.log('   Lesson payment statuses will be reset (isPaid = false, paidAmount = 0).');
  console.log('   Packages will be unlinked from payments but kept.\n');
  console.log('   To confirm and proceed, run:');
  console.log('   node scripts/delete-all-payments.js --confirm\n');
  process.exit(1);
}

// Run the script
deleteAllPayments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

