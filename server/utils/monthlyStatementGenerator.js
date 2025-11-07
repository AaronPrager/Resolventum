import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function generateMonthlyStatementPDF(statementData) {
  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const { 
    studentName,
    familyName,
    month,
    year,
    previousBalance,
    billedThisMonth,
    paidThisMonth,
    endingBalance,
    creditBalance,
    lessonsThisMonth,
    payments,
    companyName, 
    companyPhone, 
    companyEmail, 
    companyAddress,
    logoUrl,
    venmo,
    zelle,
    isFamily,
    studentCount
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
        currentPage.drawImage(logoImage, {
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

  // Company info (right side of header)
  let companyInfoY = y;
  if (companyName) {
    currentPage.drawText(companyName, {
      x: margin + (logoImage ? 120 : 0),
      y: companyInfoY,
      size: 16,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    companyInfoY -= 20;
  }
  if (companyAddress) {
    currentPage.drawText(companyAddress, {
      x: margin + (logoImage ? 120 : 0),
      y: companyInfoY,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    companyInfoY -= 15;
  }
  if (companyPhone) {
    currentPage.drawText(`Phone: ${companyPhone}`, {
      x: margin + (logoImage ? 120 : 0),
      y: companyInfoY,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    companyInfoY -= 15;
  }
  if (companyEmail) {
    currentPage.drawText(`Email: ${companyEmail}`, {
      x: margin + (logoImage ? 120 : 0),
      y: companyInfoY,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  // Title
  y = (logoImage ? y - 100 : y - 40);
  const monthName = month ? new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Monthly Statement';
  const title = `MONTHLY STATEMENT - ${monthName}`;
  currentPage.drawText(title, {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.6),
  });

  y -= 30;

  // Account holder info
  const accountName = familyName || studentName || 'Student';
  currentPage.drawText('Account Holder:', {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 18;
  currentPage.drawText(accountName, {
    x: margin + 20,
    y,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });
  if (isFamily && studentCount) {
    y -= 15;
    currentPage.drawText(`${studentCount} student${studentCount > 1 ? 's' : ''} in family`, {
      x: margin + 20,
      y,
      size: 10,
      font: fontOblique,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  y -= 40;

  // Balance Summary Box
  const summaryBoxY = y;
  const summaryBoxHeight = 100;
  currentPage.drawRectangle({
    x: margin,
    y: summaryBoxY - summaryBoxHeight,
    width: contentWidth,
    height: summaryBoxHeight,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  currentPage.drawText('BALANCE SUMMARY', {
    x: margin + 10,
    y: summaryBoxY - 20,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  let summaryY = summaryBoxY - 40;
  const summaryLeft = margin + 20;
  const summaryRight = margin + contentWidth - 20;

  // Previous Balance
  currentPage.drawText('Previous Balance:', {
    x: summaryLeft,
    y: summaryY,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });
  currentPage.drawText(formatCurrency(previousBalance || 0), {
    x: summaryRight - 100,
    y: summaryY,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });
  summaryY -= 18;

  // Billed This Month
  currentPage.drawText('Billed This Month:', {
    x: summaryLeft,
    y: summaryY,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });
  currentPage.drawText(formatCurrency(billedThisMonth || 0), {
    x: summaryRight - 100,
    y: summaryY,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });
  summaryY -= 18;

  // Paid This Month
  currentPage.drawText('Paid This Month:', {
    x: summaryLeft,
    y: summaryY,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });
  currentPage.drawText(formatCurrency(paidThisMonth || 0), {
    x: summaryRight - 100,
    y: summaryY,
    size: 10,
    font: font,
    color: rgb(0.1, 0.6, 0.1),
  });
  summaryY -= 18;

  // Ending Balance
  currentPage.drawText('Ending Balance:', {
    x: summaryLeft,
    y: summaryY,
    size: 10,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  const endingBalanceValue = endingBalance || 0;
  currentPage.drawText(formatCurrency(endingBalanceValue), {
    x: summaryRight - 100,
    y: summaryY,
    size: 10,
    font: fontBold,
    color: endingBalanceValue > 0 ? rgb(0.8, 0.1, 0.1) : (endingBalanceValue < 0 ? rgb(0.1, 0.3, 0.8) : rgb(0, 0, 0)),
  });

  y = summaryBoxY - summaryBoxHeight - 30;

  // Payment Information Section (if available)
  if (venmo || zelle) {
    // Check if we need a new page
    if (y < 150) {
      currentPage = pdfDoc.addPage([595, 842]);
      y = 800;
    }

    currentPage.drawText('PAYMENT METHODS', {
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
    currentPage.drawRectangle({
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
      currentPage.drawText(`Venmo: ${venmo}`, {
        x: margin + 10,
        y: paymentY,
        size: 12,
        font: fontBold,
        color: rgb(0.2, 0.3, 0.6),
      });
      paymentY -= 20;
    }
    
    if (zelle) {
      currentPage.drawText(`Zelle: ${zelle}`, {
        x: margin + 10,
        y: paymentY,
        size: 12,
        font: fontBold,
        color: rgb(0.2, 0.3, 0.6),
      });
    }

    y = paymentBoxY - paymentBoxHeight - 30;
  }

  // Lessons section
  if (lessonsThisMonth && lessonsThisMonth.length > 0) {
    // Check if we need a new page
    if (y < 200) {
      currentPage = pdfDoc.addPage([595, 842]);
      y = 800;
    }

    currentPage.drawText('LESSONS THIS MONTH', {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.3, 0.6),
    });

    y -= 25;

    // Table header
    const tableTop = y;
    const rowHeight = 20;
    const headerY = tableTop;
    
    // Header background
    currentPage.drawRectangle({
      x: margin,
      y: headerY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Header text
    currentPage.drawText('Date', {
      x: margin + 5,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText('Duration', {
      x: margin + 150,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText('Price', {
      x: margin + 250,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText('Status', {
      x: margin + 350,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    y = headerY - rowHeight - 5;

    // Lessons rows
    for (let i = 0; i < lessonsThisMonth.length; i++) {
      const lesson = lessonsThisMonth[i];
      
      // Check if we need a new page
      if (y < 50) {
        currentPage = pdfDoc.addPage([595, 842]);
        y = 800;
        
        // Redraw header on new page
        currentPage.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.9, 0.9, 0.9),
        });
        currentPage.drawText('Date', {
          x: margin + 5,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        currentPage.drawText('Duration', {
          x: margin + 150,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        currentPage.drawText('Price', {
          x: margin + 250,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        currentPage.drawText('Status', {
          x: margin + 350,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        y -= rowHeight + 5;
      }

      const lessonDate = new Date(lesson.dateTime);
      const isPast = lessonDate < new Date();
      
      // Row background (alternating)
      if (i % 2 === 0) {
        currentPage.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      // Date
      currentPage.drawText(lessonDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), {
        x: margin + 5,
        y: y - 15,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Duration
      currentPage.drawText(`${lesson.duration || '-'} min`, {
        x: margin + 150,
        y: y - 15,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Price
      currentPage.drawText(formatCurrency(lesson.price || 0), {
        x: margin + 250,
        y: y - 15,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Status
      currentPage.drawText(isPast ? 'Billed' : 'Future', {
        x: margin + 350,
        y: y - 15,
        size: 8,
        font: font,
        color: isPast ? rgb(0.1, 0.6, 0.1) : rgb(0.5, 0.5, 0.5),
      });

      y -= rowHeight;
    }

    y -= 20;
  }

  // Payments section
  if (payments && payments.length > 0) {
    // Check if we need a new page
    if (y < 200) {
      currentPage = pdfDoc.addPage([595, 842]);
      y = 800;
    }

    currentPage.drawText('PAYMENTS THIS MONTH', {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.3, 0.6),
    });

    y -= 25;

    // Table header
    const tableTop = y;
    const rowHeight = 20;
    const headerY = tableTop;
    
    // Header background
    currentPage.drawRectangle({
      x: margin,
      y: headerY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Header text
    currentPage.drawText('Date', {
      x: margin + 5,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText('Amount', {
      x: margin + 100,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText('Method', {
      x: margin + 200,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    currentPage.drawText('Notes', {
      x: margin + 300,
      y: headerY - 15,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    y = headerY - rowHeight - 5;

    // Payment rows
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      
      // Check if we need a new page
      if (y < 50) {
        currentPage = pdfDoc.addPage([595, 842]);
        y = 800;
        
        // Redraw header on new page
        currentPage.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.9, 0.9, 0.9),
        });
        currentPage.drawText('Date', {
          x: margin + 5,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        currentPage.drawText('Amount', {
          x: margin + 100,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        currentPage.drawText('Method', {
          x: margin + 200,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        currentPage.drawText('Notes', {
          x: margin + 300,
          y: y - 15,
          size: 9,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        y -= rowHeight + 5;
      }

      // Row background (alternating)
      if (i % 2 === 0) {
        currentPage.drawRectangle({
          x: margin,
          y: y - rowHeight,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      // Date
      const paymentDate = new Date(payment.date);
      currentPage.drawText(paymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), {
        x: margin + 5,
        y: y - 15,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Amount
      currentPage.drawText(formatCurrency(payment.amount || 0), {
        x: margin + 100,
        y: y - 15,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.6, 0.1),
      });

      // Method
      currentPage.drawText(payment.method || '-', {
        x: margin + 200,
        y: y - 15,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Notes (truncate if too long)
      const notes = (payment.notes || '-').substring(0, 40);
      currentPage.drawText(notes, {
        x: margin + 300,
        y: y - 15,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      y -= rowHeight;
    }
  }

  // Footer
  const footerY = 50;
  currentPage.drawText('This is an automated monthly statement. Please contact us if you have any questions.', {
    x: margin,
    y: footerY,
    size: 8,
    font: fontOblique,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

function formatCurrency(amount) {
  return `$${Math.abs(amount).toFixed(2)}`;
}

