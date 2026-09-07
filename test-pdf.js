const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

async function test() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([1280, 720]);
  
  // Draw a path that starts at (10, 10) and goes to (100, 100)
  page.drawSvgPath('M 10 10 L 100 100', {
    x: 0,
    y: 720,
    borderColor: rgb(1, 0, 0),
    borderWidth: 5
  });

  const pdfBytes = await doc.save();
  fs.writeFileSync('test.pdf', pdfBytes);
  console.log('done');
}
test();
