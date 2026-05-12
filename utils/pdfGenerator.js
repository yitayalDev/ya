const PDFDocument = require('pdfkit');

const generateUniversityLetter = (res, data) => {
    const doc = new PDFDocument({ margin: 50 });

    // Stream PDF to response
    doc.pipe(res);

    // Header - University Name
    doc.fontSize(20).text('ANTIGRAVITY UNIVERSITY', { align: 'center' });
    doc.fontSize(10).text('Office of the Registrar', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(2);

    // Date
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(2);

    // Title
    doc.fontSize(16).text(data.title.toUpperCase(), { align: 'center', underline: true });
    doc.moveDown(2);

    // Recipient
    doc.fontSize(12).text('TO WHOM IT MAY CONCERN,');
    doc.moveDown();

    // Body
    doc.fontSize(12).text(data.body, {
        align: 'justify',
        lineGap: 5
    });

    doc.moveDown(4);

    // Footer - Signature
    doc.text('__________________________');
    doc.text('The University Registrar');
    doc.text('Antigravity University');

    // QR Code Placeholder (could be real QR)
    doc.moveDown(2);
    doc.fontSize(8).text(`Verification ID: ${data.verificationId}`, { color: 'grey' });

    doc.end();
};

module.exports = { generateUniversityLetter };
