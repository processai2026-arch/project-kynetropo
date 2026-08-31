const fs = require('fs');
const buf = fs.readFileSync('pdf/invoice_labels_1784008429153_invoices (7).pdf');
const text = buf.toString('latin1');

// Extract text between parentheses (PDF string objects)
const strings = [];
let i = 0;
while (i < text.length) {
  if (text[i] === '(') {
    let j = i + 1;
    let s = '';
    while (j < text.length && text[j] !== ')') {
      if (text[j] === '\\') { j++; } // skip escape
      s += text[j];
      j++;
    }
    s = s.trim();
    if (s.length > 3 && /[A-Za-z0-9]/.test(s)) strings.push(s);
    i = j + 1;
  } else {
    i++;
  }
}

// Show strings that look like invoice data
const relevant = strings.filter(s =>
  /invoice|order|LWAC|SKU|HSN|IGST|CGST|Flipkart|Sreekala|SAEAB/i.test(s)
);
console.log('Total strings found:', strings.length);
console.log('\nRelevant invoice strings:');
relevant.slice(0, 50).forEach((s,i) => console.log(i+':', JSON.stringify(s)));
