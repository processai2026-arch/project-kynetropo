import * as pdfjsLib from 'pdfjs-dist';
import { readFileSync } from 'fs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const data = readFileSync('pdf/invoice_labels_1784008429153_invoices (7).pdf');

const pdf = await pdfjsLib.getDocument({ data }).promise;
console.log('Page count:', pdf.numPages);

for (let p = 1; p <= Math.min(3, pdf.numPages); p++) {
  const page = await pdf.getPage(p);
  const content = await page.getTextContent();
  const text = content.items.map(i => i.str || '').join('\n');
  console.log(`\n=== PAGE ${p} ===`);
  console.log(text.slice(0, 1000));
}
