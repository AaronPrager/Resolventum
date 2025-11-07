import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function generateBalanceStatementPDF(statementData) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const { 
    student, 
    completedLessons, 
    allPayments, 
    companyName, 
    companyPhone, 
    companyEmail, 
    companyAddress,
    logoUrl,
    venmo,
    zelle,
    isFamily,
    familyStudents
  } = statementData;

  let y = 800;
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentWidth = pageWidth - (margin * 2);

  // Header with logo and company info
  let logoImage = null;
  if (logoUrl) {
    try {
      const logoPath = path.join(__dirname, '../uploads/logos', path.basename(logoUrl));
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath);
        logoImage = await pdfDoc.embedJpg(logoBytes);
        const logoDims = logoImage.scale(0.3); // Scale logo to fit
        page.drawImage(logoImage, {
          x: margin,
          y: y - logoDims.height,
          width: logoDims.width,
          height: logoDims.height,
        });
      }
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  // Company name and info (right-aligned)
  const companyInfoX = pageWidth - margin;
  let companyY = y;

  if (companyName) {
    const companyNameWidth = fontBold.widthOfTextAtSize(companyName, 16);
    page.drawText(companyName, {
      x: companyInfoX - companyNameWidth,
      y: companyY,
      size: 16,
      font: fontBold,
    });
    companyY -= 20;
  }

  if (companyAddress) {
    const addressLines = companyAddress.split('\n').filter(line => line.trim());
    addressLines.forEach(line => {
      const lineWidth = font.widthOfTextAtSize(line, 9);
      page.drawText(line, {
        x: companyInfoX - lineWidth,
        y: companyY,
        size: 9,
        font: font,
      });
      companyY -= 12;
    });
  }

  if (companyPhone) {
    const phoneWidth = font.widthOfTextAtSize(`Phone: ${companyPhone}`, 9);
    page.drawText(`Phone: ${companyPhone}`, {
      x: companyInfoX - phoneWidth,
      y: companyY,
      size: 9,
      font: font,
    });
    companyY -= 12;
  }

  if (companyEmail) {
    const emailWidth = font.widthOfTextAtSize(`Email: ${companyEmail}`, 9);
    page.drawText(`Email: ${companyEmail}`, {
      x: companyInfoX - emailWidth,
      y: companyY,
      size: 9,
      font: font,
    });
    companyY -= 12;
  }

  // Adjust y position based on logo height
  if (logoImage) {
    y = y - logoImage.height * 0.3 - 30;
  } else {
    y = companyY - 20;
  }

  // Title
  page.drawText('ACCOUNT BALANCE STATEMENT', {
    x: margin,
    y,
    size: 20,
    font: fontBold,
  });

  y -= 40;

  // Date
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  page.drawText(`Date: ${currentDate}`, {
    x: margin,
    y,
    size: 10,
    font: font,
  });

  y -= 30;

  // Student/Client info
  const studentName = isFamily 
    ? student.firstName 
    : `${student.firstName} ${student.lastName || ''}`.trim();
  
  page.drawText('Account Holder:', {
    x: margin,
    y,
    size: 12,
    font: fontBold,
  });

  y -= 20;

  page.drawText(studentName, {
    x: margin + 20,
    y,
    size: 11,
    font: font,
  });

  y -= 15;

  if (isFamily && familyStudents) {
    const familyMembersText = familyStudents.map(s => `${s.firstName} ${s.lastName}`).join(', ');
    page.drawText(`Family Members: ${familyMembersText}`, {
      x: margin + 20,
      y,
      size: 10,
      font: fontOblique,
    });
    y -= 15;
  }

  if (student.email) {
    page.drawText(`Email: ${student.email}`, {
      x: margin + 20,
      y,
      size: 10,
      font: font,
    });
    y -= 15;
  }

  if (student.phone) {
    page.drawText(`Phone: ${student.phone}`, {
      x: margin + 20,
      y,
      size: 10,
      font: font,
    });
    y -= 15;
  }

  y -= 30;

  // Summary section
  const totalBilled = completedLessons.reduce((sum, lesson) => sum + (lesson.price || 0), 0);
  const totalPaid = completedLessons.reduce((sum, lesson) => {
    const lessonPaid = lesson.payments.reduce((pSum, payment) => pSum + (payment.amount || 0), 0);
    return sum + lessonPaid;
  }, 0);
  const outstandingBalance = totalBilled - totalPaid;

  page.drawText('BALANCE SUMMARY', {
    x: margin,
    y,
    size: 14,
    font: fontBold,
  });

  y -= 25;

  // Summary box
  const summaryBoxY = y;
  const summaryBoxHeight = 80;
  page.drawRectangle({
    x: margin,
    y: summaryBoxY - summaryBoxHeight,
    width: contentWidth,
    height: summaryBoxHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  let summaryY = summaryBoxY - 20;

  // Total Billed
  page.drawText('Total Billed:', {
    x: margin + 10,
    y: summaryY,
    size: 10,
    font: font,
  });
  const billedText = `$${totalBilled.toFixed(2)}`;
  const billedWidth = fontBold.widthOfTextAtSize(billedText, 11);
  page.drawText(billedText, {
    x: margin + contentWidth - 10 - billedWidth,
    y: summaryY,
    size: 11,
    font: fontBold,
  });
  summaryY -= 20;

  // Total Paid
  page.drawText('Total Paid:', {
    x: margin + 10,
    y: summaryY,
    size: 10,
    font: font,
  });
  const paidText = `$${totalPaid.toFixed(2)}`;
  const paidWidth = fontBold.widthOfTextAtSize(paidText, 11);
  page.drawText(paidText, {
    x: margin + contentWidth - 10 - paidWidth,
    y: summaryY,
    size: 11,
    font: fontBold,
    color: rgb(0, 0.5, 0),
  });
  summaryY -= 20;

  // Outstanding Balance
  page.drawText('Outstanding Balance:', {
    x: margin + 10,
    y: summaryY,
    size: 11,
    font: fontBold,
  });
  const balanceText = `$${outstandingBalance.toFixed(2)}`;
  const balanceWidth = fontBold.widthOfTextAtSize(balanceText, 12);
  const balanceColor = outstandingBalance > 0 ? rgb(1, 0, 0) : outstandingBalance < 0 ? rgb(0, 0.5, 0) : rgb(0, 0, 0);
  page.drawText(balanceText, {
    x: margin + contentWidth - 10 - balanceWidth,
    y: summaryY,
    size: 12,
    font: fontBold,
    color: balanceColor,
  });

  y = summaryBoxY - summaryBoxHeight - 30;

  // Payment Information Section (if available)
  if (venmo || zelle) {
    // Check if we need a new page
    if (y < 150) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }

    page.drawText('PAYMENT METHODS', {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.3, 0.6),
    });

    y -= 25;

    // Payment box with background
    const paymentBoxY = y;
    const paymentBoxHeight = (venmo && zelle ? 50 : 30);
    page.drawRectangle({
      x: margin,
      y: paymentBoxY - paymentBoxHeight,
      width: contentWidth,
      height: paymentBoxHeight,
      color: rgb(0.95, 0.96, 1.0),
      borderColor: rgb(0.3, 0.4, 0.7),
      borderWidth: 2,
    });

    let paymentY = paymentBoxY - 20;
    
    if (venmo) {
      page.drawText('Venmo:', {
        x: margin + 10,
        y: paymentY,
        size: 11,
        font: fontBold,
        color: rgb(0.2, 0.3, 0.6),
      });
      page.drawText(venmo, {
        x: margin + 80,
        y: paymentY,
        size: 12,
        font: fontBold,
        color: rgb(0.2, 0.4, 0.7),
      });
      paymentY -= 20;
    }

    if (zelle) {
      page.drawText('Zelle:', {
        x: margin + 10,
        y: paymentY,
        size: 11,
        font: fontBold,
        color: rgb(0.2, 0.3, 0.6),
      });
      page.drawText(zelle, {
        x: margin + 80,
        y: paymentY,
        size: 12,
        font: fontBold,
        color: rgb(0.2, 0.4, 0.7),
      });
    }

    y = paymentBoxY - paymentBoxHeight - 30;
  }

  // Lessons section
  if (completedLessons.length > 0) {
    page.drawText('COMPLETED LESSONS', {
      x: margin,
      y,
      size: 14,
      font: fontBold,
    });

    y -= 20;

    // Table header
    const tableStartY = y;
    const rowHeight = 15;
    const colWidths = {
      date: 120,
      student: isFamily ? 120 : 0,
      duration: 70,
      price: 80,
      paid: 80,
      balance: 80,
    };

    // Draw table header background
    page.drawRectangle({
      x: margin,
      y: tableStartY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0.95, 0.95, 0.95),
    });

    let headerX = margin + 5;
    page.drawText('Date', {
      x: headerX,
      y: tableStartY - 12,
      size: 9,
      font: fontBold,
    });
    headerX += colWidths.date;

    if (isFamily) {
      page.drawText('Student', {
        x: headerX,
        y: tableStartY - 12,
        size: 9,
        font: fontBold,
      });
      headerX += colWidths.student;
    }

    const durationX = margin + contentWidth - colWidths.balance - colWidths.paid - colWidths.price - colWidths.duration;
    page.drawText('Duration', {
      x: durationX,
      y: tableStartY - 12,
      size: 9,
      font: fontBold,
    });

    const priceX = margin + contentWidth - colWidths.balance - colWidths.paid - colWidths.price;
    page.drawText('Price', {
      x: priceX,
      y: tableStartY - 12,
      size: 9,
      font: fontBold,
    });

    const paidX = margin + contentWidth - colWidths.balance - colWidths.paid;
    page.drawText('Paid', {
      x: paidX,
      y: tableStartY - 12,
      size: 9,
      font: fontBold,
    });

    const balanceX = margin + contentWidth - colWidths.balance;
    page.drawText('Balance', {
      x: balanceX,
      y: tableStartY - 12,
      size: 9,
      font: fontBold,
    });

    y = tableStartY - rowHeight - 5;

    // Sort lessons by date
    const sortedLessons = [...completedLessons].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedLessons.forEach((lesson, index) => {
      if (y < 100) {
        // Add new page
        page = pdfDoc.addPage([595, 842]);
        y = 800;
      }

      const lessonPaid = lesson.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const lessonBalance = (lesson.price || 0) - lessonPaid;

      // Draw row background (alternating)
      if (index % 2 === 0) {
        page.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      let cellX = margin + 5;
      const cellY = y - 12;

      // Date
      const lessonDate = new Date(lesson.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      page.drawText(lessonDate, {
        x: cellX,
        y: cellY,
        size: 8,
        font: font,
      });
      cellX += colWidths.date;

      // Student (if family)
      if (isFamily) {
        page.drawText(lesson.studentName || '-', {
          x: cellX,
          y: cellY,
          size: 8,
          font: font,
        });
        cellX += colWidths.student;
      }

      // Duration
      const durationText = lesson.duration ? `${lesson.duration} min` : '-';
      const durationTextWidth = font.widthOfTextAtSize(durationText, 8);
      page.drawText(durationText, {
        x: durationX + colWidths.duration - durationTextWidth - 5,
        y: cellY,
        size: 8,
        font: font,
      });

      // Price
      const priceText = `$${(lesson.price || 0).toFixed(2)}`;
      const priceTextWidth = font.widthOfTextAtSize(priceText, 8);
      page.drawText(priceText, {
        x: priceX + colWidths.price - priceTextWidth - 5,
        y: cellY,
        size: 8,
        font: font,
      });

      // Paid
      const paidText = `$${lessonPaid.toFixed(2)}`;
      const paidTextWidth = font.widthOfTextAtSize(paidText, 8);
      page.drawText(paidText, {
        x: paidX + colWidths.paid - paidTextWidth - 5,
        y: cellY,
        size: 8,
        font: font,
        color: rgb(0, 0.5, 0),
      });

      // Balance
      const balanceText = `$${lessonBalance.toFixed(2)}`;
      const balanceTextWidth = fontBold.widthOfTextAtSize(balanceText, 8);
      const balanceColor = lessonBalance > 0 ? rgb(1, 0, 0) : lessonBalance < 0 ? rgb(0, 0.5, 0) : rgb(0, 0, 0);
      page.drawText(balanceText, {
        x: balanceX + colWidths.balance - balanceTextWidth - 5,
        y: cellY,
        size: 8,
        font: fontBold,
        color: balanceColor,
      });

      y -= rowHeight;
    });

    y -= 20;
  }

  // Payments section
  if (allPayments.length > 0) {
    if (y < 150) {
      page = pdfDoc.addPage([595, 842]);
      y = 800;
    }

    page.drawText('PAYMENT HISTORY', {
      x: margin,
      y,
      size: 14,
      font: fontBold,
    });

    y -= 20;

    // Sort payments by date (newest first)
    const sortedPayments = [...allPayments].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedPayments.forEach((payment, index) => {
      if (y < 100) {
        page = pdfDoc.addPage([595, 842]);
        y = 800;
      }

      const paymentDate = new Date(payment.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });

      const paymentText = `${paymentDate} - ${payment.method || 'N/A'} - $${payment.amount.toFixed(2)}`;
      if (payment.notes) {
        page.drawText(`${paymentText} (${payment.notes})`, {
          x: margin + 10,
          y,
          size: 9,
          font: font,
        });
      } else {
        page.drawText(paymentText, {
          x: margin + 10,
          y,
          size: 9,
          font: font,
        });
      }

      y -= 15;
    });
  }

  // Footer
  const footerY = 50;
  page.drawText('This is an automated statement. Please contact us if you have any questions.', {
    x: margin,
    y: footerY,
    size: 8,
    font: fontOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

