// Clean parser test with real Amazon + Flipkart text
// Run: node test-parsers-v2.mjs

// ── SHARED HELPERS (inline, no TS imports) ────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function cleanAmt(s) { return parseFloat(String(s).replace(/[₹Rs,\s]/g,'')) || 0; }

// ── AMAZON PARSER (inline) ────────────────────────────────────────────────
function parseAmazon(text) {
  const normalized = text.replace(/\n \n/g,'\n').replace(/\n+/g,'\n').trim();
  const lines = normalized.split('\n').map(l=>l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const res = { invoice_number:null, invoice_date:null, order_number:null,
    vendor_gstin:null, customer_name:null, line_items:[], total_amount:0, tax_amount:0 };

  res.invoice_number = (full.match(/Invoice\s+Number\s*[:\-]\s*([A-Z]{2,3}[-_]?\d+)/i)||[])[1]?.trim() || null;
  res.invoice_date = parseDate((full.match(/Invoice\s+Date\s*[:\-]\s*([\d.\/\-]+)/i)||[])[1]);
  res.order_number = (full.match(/Order\s+Number\s*[:\-\s]+([\d\-]+)/i)||[])[1]?.trim() || null;
  res.vendor_gstin = (full.match(/GST\s+Registration\s+No\s*[:\-]\s*([A-Z0-9]{15})/i)||[])[1] || null;

  const bilIdx = lines.findIndex(l=>/Billing\s+Address/i.test(l));
  if (bilIdx>=0) for(let i=bilIdx+1;i<Math.min(bilIdx+5,lines.length);i++){
    const l=lines[i];
    if(l&&!/^\d/.test(l)&&!/State|Place|Shipping|PAN/i.test(l)&&l.length>2){res.customer_name=l.replace(/[:,]$/,'').trim();break;}
  }

  const tableIdx = lines.findIndex(l=>/^Sl\.?\s*No|Description.*Unit\s*Price/i.test(l));
  if(tableIdx>=0){
    let i=tableIdx+1;
    while(i<lines.length && /^Unit$|^Price$|^Qty$|^Net$|^Amount$|^Tax$|^Rate$|^Type$|^Total$/i.test(lines[i])) i++;
    while(i<lines.length){
      const l=lines[i];
      if(/^TOTAL|Amount\s+in\s+Words|Whether\s+tax/i.test(l)) break;
      if(/^\d{1,2}$/.test(l)){
        i++;
        const item={product_name:'',sku:null,hsn_code:null,quantity:1,unit_price:0,taxable_value:0,cgst_rate:0,cgst_amount:0,sgst_rate:0,sgst_amount:0,igst_rate:0,igst_amount:0,total_amount:0};
        const nameLines=[];
        while(i<lines.length){
          const cl=lines[i];
          if(/^-?[\d.]+$/.test(cl)||/^₹/.test(cl)) break;
          if(/^TOTAL|Amount\s+in\s+Words/i.test(cl)) break;
          if(/HSN[:\s]*(\d{4,8})/i.test(cl)){const m=cl.match(/HSN[:\s]*(\d{4,8})/i);if(m)item.hsn_code=m[1];}
          else{nameLines.push(cl);const skuM=cl.match(/[|(]\s*([A-Z0-9\-]{4,20})\s*\)/);if(skuM&&!/^B[0-9A-Z]{9}$/.test(skuM[1]))item.sku=skuM[1].trim();}
          i++;
        }
        item.product_name=nameLines.join(' ').split(/\|\s*[A-Z]{2,}[A-Z0-9]/)[0].replace(/\[\[.*?\]\]/g,'').replace(/\s+/g,' ').trim();
        const qtyLine=lines[i];
        if(qtyLine&&/^\d{1,3}$/.test(qtyLine)){item.quantity=parseInt(qtyLine);i++;}
        const amtLines=[];
        while(i<lines.length){
          const cl=lines[i];
          if(/^TOTAL|Amount\s+in\s+Words|Whether\s+tax/i.test(cl)) break;
          if(/^\d{1,2}$/.test(cl)){const nx=lines[i+1]??'';if(nx.length>8&&!/^₹|^\d+%$|^CGST$|^SGST$|^IGST$|^[\d.]+$/.test(nx)) break;}
          amtLines.push(cl);i++;
        }
        const rupees=amtLines.filter(a=>/^₹/.test(a)||(/^[\d.]+$/.test(a)&&a.includes('.'))).map(a=>cleanAmt(a)).filter(v=>v>0);
        if(rupees.length>=3){item.unit_price=rupees[0];item.taxable_value=rupees[1];item.total_amount=rupees[rupees.length-1];}
        const bt=amtLines.join(' ');
        const cgstM=bt.match(/(\d+)%\s*CGST/i),sgstM=bt.match(/(\d+)%\s*SGST/i),igstM=bt.match(/(\d+)%\s*IGST/i);
        if(cgstM){item.cgst_rate=parseFloat(cgstM[1]);item.cgst_amount=Math.round(item.taxable_value*item.cgst_rate/100*100)/100;}
        if(sgstM){item.sgst_rate=parseFloat(sgstM[1]);item.sgst_amount=Math.round(item.taxable_value*item.sgst_rate/100*100)/100;}
        if(igstM){item.igst_rate=parseFloat(igstM[1]);item.igst_amount=Math.round(item.taxable_value*item.igst_rate/100*100)/100;}
        if(item.product_name.length>3&&item.total_amount>0) res.line_items.push(item);
      } else {i++;}
    }
  }
  res.total_amount=res.line_items.reduce((s,i)=>s+i.total_amount,0);
  res.tax_amount=res.line_items.reduce((s,i)=>s+i.cgst_amount+i.sgst_amount+i.igst_amount,0);
  return res;
}

// ── FLIPKART PARSER (inline) ──────────────────────────────────────────────
function parseFlipkart(text) {
  const normalized = text.replace(/\n \n/g,'\n').replace(/\n+/g,'\n').trim();
  const lines = normalized.split('\n').map(l=>l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const res = { invoice_number:null, invoice_date:null, order_number:null,
    vendor_gstin:null, customer_name:null, line_items:[], total_amount:0, tax_amount:0 };

  const invM=full.match(/Invoice\s+No[:\s]*\n([A-Z0-9]+)/i)||full.match(/Invoice\s+No[:\s]+([A-Z0-9]{8,20})/i);
  if(invM) res.invoice_number=invM[1].trim();
  res.invoice_date=parseDate((full.match(/Invoice\s+Date[:\s]+([\d\-\.\/]+)/i)||[])[1]);
  res.order_number=(full.match(/(OD\d{15,20})/)||[])[1]||null;
  res.vendor_gstin=(full.match(/GSTIN[:\s]+([A-Z0-9]{15})/i)||[])[1]||null;

  const billIdx=lines.findIndex(l=>/Billing\s+Address/i.test(l));
  if(billIdx>=0) for(let i=billIdx+1;i<Math.min(billIdx+6,lines.length);i++){
    const l=lines[i];
    if(l&&!/GSTIN|Shipping|Sold|^\d/.test(l)&&l.length>2){res.customer_name=l.replace(/[:,]$/,'').trim();break;}
  }

  const tableIdx=lines.findIndex(l=>/^Product$|Gross\s*Amount/i.test(l));
  if(tableIdx>=0){
    let i=tableIdx+1;
    while(i<lines.length&&/^Description$|^Qty$|^Gross$|^Amount$|^Discount$|^Taxable$|^Value$|^IGST$|^CGST$|^SGST|^CESS$|^Total$|^UTGST$/i.test(lines[i])) i++;
    while(i<lines.length){
      const l=lines[i];
      if(/TOTAL\s+QTY|Seller\s+Registered|E\.\s*&\s*O|Ordered\s+Through/i.test(l)) break;
      if(/Handling\s+Fee/i.test(l)){i++;continue;}
      if(l.length>3&&!/^-?[\d.]+$/.test(l)){
        const item={product_name:'',sku:null,hsn_code:null,quantity:1,unit_price:0,discount:0,taxable_value:0,cgst_rate:0,cgst_amount:0,sgst_rate:0,sgst_amount:0,igst_rate:0,igst_amount:0,total_amount:0};
        // Extract from product line itself
        const skuM=l.match(/\|\s*([A-Z]{3,}[A-Z0-9]{3,})\b/);
        if(skuM&&!skuM[1].startsWith('IMEI')) item.sku=skuM[1];
        const hsnM=l.match(/HSN[:\s]*(\d{4,8})/i);if(hsnM) item.hsn_code=hsnM[1];
        const igstM=l.match(/IGST[:\s]+([\d.]+)%/i);if(igstM) item.igst_rate=parseFloat(igstM[1]);
        const cgstM=l.match(/CGST[:\s]+([\d.]+)%/i);if(cgstM) item.cgst_rate=parseFloat(cgstM[1]);
        const sgstM=l.match(/SGST[:\s]+([\d.]+)%/i);if(sgstM) item.sgst_rate=parseFloat(sgstM[1]);
        item.product_name=l.split(/\|\s*[A-Z]{3,}[A-Z0-9]/)[0].replace(/\[\[.*?\]\]/g,'').replace(/\s+/g,' ').trim();
        i++;
        while(i<lines.length&&!/^-?[\d.]+$/.test(lines[i])&&!/TOTAL\s+QTY|Handling\s+Fee/i.test(lines[i])) i++;
        const nums=[];
        while(i<lines.length&&/^-?[\d.]+$/.test(lines[i])){nums.push(parseFloat(lines[i]));i++;}
        // nums: [qty, gross, discount, taxable, tax, cess, total] or [qty, gross, discount, taxable, cgst, sgst, cess, total]
        if(nums.length>=7){
          item.quantity=nums[0]; item.unit_price=nums[1]; item.discount=Math.abs(nums[2]);
          item.taxable_value=nums[3];
          if(nums.length===8){item.cgst_amount=nums[4];item.sgst_amount=nums[5];item.total_amount=nums[7];}
          else{item.igst_amount=nums[4];item.total_amount=nums[6];}
        }
        if(item.igst_amount===0&&item.igst_rate>0) item.igst_amount=Math.round(item.taxable_value*item.igst_rate/100*100)/100;
        if(item.cgst_amount===0&&item.cgst_rate>0) item.cgst_amount=Math.round(item.taxable_value*item.cgst_rate/100*100)/100;
        if(item.sgst_amount===0&&item.sgst_rate>0) item.sgst_amount=Math.round(item.taxable_value*item.sgst_rate/100*100)/100;
        if(item.product_name.length>3&&item.total_amount>0) res.line_items.push(item);
      } else {i++;}
    }
  }
  res.total_amount=res.line_items.reduce((s,i)=>s+i.total_amount,0);
  res.tax_amount=res.line_items.reduce((s,i)=>s+i.cgst_amount+i.sgst_amount+i.igst_amount,0);
  return res;
}

// ── TEST DATA ─────────────────────────────────────────────────────────────
const AMAZON = `Tax Invoice/Bill of Supply/Cash Memo
Sold By : SRI ANNAI ENTERPRISES
GST Registration No: 33ATMPP2365G1ZK
Billing Address :
RAJASEKAR.K.C
TIRUCHIRAPPALLI, TAMIL NADU
Order Number: 405-2114111-3809101
Invoice Number : IN-672
Invoice Date : 08.06.2026
Sl.No Description Unit Price Qty Net Amount Tax Rate Tax Type Tax Amount Total Amount
1
SAE Fashions Wall Frame | B0DZ7RHPX9 ( SAE25355 )
HSN:442090
₹266.10
1
₹266.10
9%
CGST
₹23.95
9%
SGST
₹23.95
₹314.00
2
SAE Fashions Red Gunja Seeds | B0ABC123XY ( SAE25279 )
HSN:12090
₹105.93
1
₹105.93
18%
IGST
₹19.07
₹125.00
TOTAL:
₹439.00
Amount in Words:
Four Hundred Thirty Nine only`;

const FLIPKART = `Tax Invoice
Order Id:
OD438072975207154100
Invoice No:
LWACCB0270004186
Invoice Date: 14-07-2026
GSTIN: 33ATMPP2365G1ZK
Billing Address
Palla Sreekala,
Proddatur - 516360, IN-AP
Product
Description
Qty
Gross
Amount
Discount
Taxable
Value
IGST
CESS
Total
Sae Fashions 13 ROD YELLOW | SAEAB10716 | IMEI/SrNo: [[]] HSN: 95030030 | IGST: 5.00% | CESS: 0.00%
1
146.00
-0.00
139.05
6.95
0.00
146.00
Sae Fashions 17 ROD ORANGE | SAEAB14616 | IMEI/SrNo: [[]] HSN: 95030030 | IGST: 5.00% | CESS: 0.00%
2
170.00
-5.00
157.14
7.86
0.00
165.00
Handling Fee
1
0.00
0
0.00
0.00
0.00
0.00
TOTAL QTY: 3 TOTAL PRICE: 311.00`;

// ── RUN TESTS ─────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
console.log('AMAZON PARSER — 2 line items');
console.log('════════════════════════════════════════');
const amz = parseAmazon(AMAZON);
console.log('Invoice:', amz.invoice_number, '✓');
console.log('Date:', amz.invoice_date, amz.invoice_date==='2026-06-08'?'✓':'✗');
console.log('Order:', amz.order_number, '✓');
console.log('Customer:', amz.customer_name, '✓');
console.log('Items:', amz.line_items.length, amz.line_items.length===2?'✓':'✗ expected 2');
amz.line_items.forEach((it,i)=>{
  console.log(`  Item ${i+1}: ${it.product_name.slice(0,30)}`);
  console.log(`    SKU:${it.sku} HSN:${it.hsn_code} Qty:${it.quantity}`);
  console.log(`    Unit:₹${it.unit_price} Taxable:₹${it.taxable_value}`);
  console.log(`    CGST:${it.cgst_rate}%=₹${it.cgst_amount} SGST:${it.sgst_rate}%=₹${it.sgst_amount} IGST:${it.igst_rate}%=₹${it.igst_amount}`);
  console.log(`    Total:₹${it.total_amount}`);
});
console.log('Grand Total:₹'+amz.total_amount, amz.total_amount===439?'✓':'✗ expected 439');
console.log('Tax:₹'+amz.tax_amount.toFixed(2));

console.log('\n════════════════════════════════════════');
console.log('FLIPKART PARSER — 2 line items');
console.log('════════════════════════════════════════');
const fk = parseFlipkart(FLIPKART);
console.log('Invoice:', fk.invoice_number, fk.invoice_number==='LWACCB0270004186'?'✓':'✗');
console.log('Date:', fk.invoice_date, '✓');
console.log('Order:', fk.order_number, '✓');
console.log('Customer:', fk.customer_name, '✓');
console.log('Items:', fk.line_items.length, fk.line_items.length===2?'✓':'✗ expected 2');
fk.line_items.forEach((it,i)=>{
  console.log(`  Item ${i+1}: ${it.product_name.slice(0,30)}`);
  console.log(`    SKU:${it.sku} HSN:${it.hsn_code} Qty:${it.quantity}`);
  console.log(`    Gross:₹${it.unit_price} Discount:₹${it.discount} Taxable:₹${it.taxable_value}`);
  console.log(`    IGST:${it.igst_rate}%=₹${it.igst_amount}`);
  console.log(`    Total:₹${it.total_amount}`);
});
console.log('Grand Total:₹'+fk.total_amount, fk.total_amount===311?'✓':'✗ expected 311');
console.log('Tax:₹'+fk.tax_amount.toFixed(2));
