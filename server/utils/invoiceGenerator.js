import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateInvoicePDF(invoiceData) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { student, lessons, payments, totalLessons, totalEarned, totalPaid, balance, month, year } = invoiceData;

  let y = 800;

  // Title
  page.drawText('INVOICE', {
    x: 50,
    y,
    size: 24,
    font: fontBold
  });

  y -= 50;

  // Date
  page.drawText(`Date: ${month}/${year}`, {
    x: 50,
    y,
    size: 10,
    font: font
  });

  y -= 40;

  // Student info
  page.drawText(`Student: ${student.firstName} ${student.lastName}`, {
    x: 50,
    y,
    size: 12,
    font: fontBold
  });

  y -= 20;

  if (student.email) {
    page.drawText(`Email: ${student.email}`, {
      x: 50,
      y,
      size: 10,
      font: font
    });
    y -= 15;
  }

  if (student.phone) {
    page.drawText(`Phone: ${student.phone}`, {
      x: 50,
      y,
      size: 10,
      font: font
    });
    y -= 15;
  }

  y -= 30;

  // Lessons
  page.drawText('LESSONS', {
    x: 50,
    y,
    size: 14,
    font: fontBold
  });

  y -= 20;

  lessons.forEach((lesson) => {
    if (y < 100) {
      // Add new page if needed
      const newPage = pdfDoc.addPage([595, 842]);
      y = 800;
    }

    const lessonDate = new Date(lesson.dateTime).toLocaleDateString();
    const lessonText = `${lessonDate} - ${lesson.subject} - ${lesson.duration}min - $${lesson.price}`;
    
    page.drawText(lessonText, {
      x: 50,
      y,
      size: 9,
      font: font
    });

    y -= 15;
  });

  y -= 20;

  // Summary
  page.drawText('SUMMARY', {
    x: 50,
    y,
    size: 14,
    font: fontBold
  });

  y -= 20;

  page.drawText(`Total Lessons: ${totalLessons}`, {
    x: 50,
    y,
    size: 11,
    font: font
  });

  y -= 20;

  page.drawText(`Total Earned: $${totalEarned.toFixed(2)}`, {
    x: 50,
    y,
    size: 11,
    font: fontBold
  });

  y -= 20;

  // Payments
  if (payments.length > 0) {
    page.drawText('PAYMENTS', {
      x: 50,
      y,
      size: 12,
      font: fontBold
    });

    y -= 20;

    payments.forEach((payment) => {
      const paymentDate = new Date(payment.date).toLocaleDateString();
      const paymentText = `${paymentDate} - ${payment.method} - $${payment.amount}`;
      
      page.drawText(paymentText, {
        x: 50,
        y,
        size: 9,
        font: font
      });

      y -= 15;
    });

    y -= 20;

    page.drawText(`Total Paid: $${totalPaid.toFixed(2)}`, {
      x: 50,
      y,
      size: 11,
      font: fontBold
    });

    y -= 20;

    page.drawText(`Outstanding Balance: $${balance.toFixed(2)}`, {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: balance > 0 ? rgb(1, 0, 0) : rgb(0, 1, 0)
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

