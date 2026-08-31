/**
 * Test invoice parsers with real PDF text content
 * Run: node test-parsers.mjs
 */

// Inline parser logic (copied from TS parsers, converted to plain JS)

function parseDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function cleanAmount(s) {
  if (!s) return 0;
  return parseFloat(s.replace(/[₹Rs,\s:]/g, '')) || 0;
}

// ── AMAZON PARSER ──
function parseAmazonInvoice(text) {
  if (!text) return null;
  if (!text.includes('Tax Invoice') && !text.includes('amazon') && !text.includes('Invoice Number')) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const result = {
    marketplace: 'amazon', invoice_number: null, invoice_date: null,
    order_number: null, vendor_name: 'SRI ANNAI ENTERPRISES', vendor_gstin: null,
    customer_name: null, customer_address: null, subtotal: 0, discount: 0,
    tax_amount: 0, total_amount: 0, shipping_charges: 0, commission_amount: 0,
    line_items: [], confidence: 0,
  };

  // Invoice Number
  const invMatch = full.match(/Invoice\s+Number\s*[:\-]\s*([A-Z]{2,3}[-_]?\d+)/i);
  if (invMatch) result.invoice_number = invMatch[1].trim();

  // Invoice Date
  const invDateMatch = full.match(/Invoice\s+Date\s*[:\-]\s*([\d.\/\-]+)/i);
  if (invDateMatch) result.invoice_date = parseDate(invDateMatch[1]);

  // Order Number
  const orderMatch = full.match(/Order\s+Number[:\s]+([\d\-]+)/i);
  if (orderMatch) result.order_number = orderMatch[1].trim();

  // Seller GSTIN
  const gstinMatch = full.match(/GST\s+Registration\s+No\s*[:\-]\s*([A-Z0-9]{15})/i);
  if (gstinMatch) result.vendor_gstin = gstinMatch[1];

  // Customer name from Billing Address
  const billingIdx = lines.findIndex(l => /Billing\s+Address/i.test(l));
  if (billingIdx >= 0) {
    for (let i = billingIdx + 1; i < Math.min(billingIdx + 5, lines.length); i++) {
      const l = lines[i];
      if (l && !/^\d/.test(l) && !/State|Place|Shipping|PAN/i.test(l) && l.length > 2) {
        result.customer_name = l.replace(/[:,]$/, '').trim();
        const addrLines = [];
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          if (/Shipping\s+Address|State\/UT\s+Code|Place\s+of/i.test(lines[j])) break;
          addrLines.push(lines[j]);
        }
        result.customer_address = addrLines.join(', ');
        break;
      }
    }
  }

  // Line items — find table by Sl.No header
  const tableStart = lines.findIndex(l => /^Sl\.?\s*No|Description.*Unit\s*Price/i.test(l));
  const lineItems = [];

  if (tableStart >= 0) {
    let i = tableStart + 1;
    while (i < lines.length) {
      const l = lines[i];
      if (/^TOTAL:|Amount\s+in\s+Words|Payment\s+Transaction/i.test(l)) break;

      // Item line starts with digit
      if (/^\d+\s+[A-Z]/.test(l)) {
        const item = { product_name: '', sku: null, hsn_code: null, quantity: 1,
          unit_price: 0, discount: 0, taxable_value: 0,
          cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0,
          igst_rate: 0, igst_amount: 0, total_amount: 0 };

        // Collect item lines until next numbered item or TOTAL
        const itemLines = [l];
        let j = i + 1;
        while (j < lines.length && !/^TOTAL:|Amount\s+in\s+Words/i.test(lines[j])) {
          if (/^\d+\s+[A-Z]/.test(lines[j])) break;
          itemLines.push(lines[j]);
          j++;
        }
        i = j;

        const itemText = itemLines.join(' ');

        // Product name — everything before ASIN or ₹
        const namePart = itemText.replace(/^\d+\s+/, '').split(/[|B0-9]{10}|₹/)[0].trim();
        item.product_name = namePart.replace(/\s+/g, ' ').trim();

        // SKU in parentheses ( SAE25355 ) or | SAE25355 )
        const skuM = itemText.match(/[|(]\s*([A-Z0-9\-]{4,20})\s*\)/);
        if (skuM && !/^B[0-9A-Z]{9}$/.test(skuM[1])) item.sku = skuM[1].trim();

        // ASIN  (B + 9 alphanumeric)
        const asinM = itemText.match(/\b(B[0-9A-Z]{9})\b/);
        if (asinM && !item.sku) item.sku = asinM[1]; // fallback if no seller SKU

        // HSN
        const hsnM = itemText.match(/HSN[:\s]*(\d{4,8})/i);
        if (hsnM) item.hsn_code = hsnM[1];

        // All ₹ amounts
        const amounts = [...itemText.matchAll(/₹\s*([\d,]+\.?\d*)/g)].map(m => cleanAmount(m[1]));

        // Amazon format: Unit Price | Qty | Net Amount | Tax amounts | Total
        if (amounts.length >= 2) {
          item.unit_price = amounts[0];
          item.taxable_value = amounts[1];
        }
        item.total_amount = amounts.length > 0 ? amounts[amounts.length - 1] : 0;

        // Quantity — standalone digit on its own or after ₹XX.XX
        const qtyM = itemText.match(/₹[\d.]+\s+(\d+)\s+₹/);
        if (qtyM) item.quantity = parseInt(qtyM[1]);

        // CGST/SGST/IGST
        const cgstM = itemText.match(/(\d+)%\s*CGST\s+₹\s*([\d.]+)/i);
        const sgstM = itemText.match(/(\d+)%\s*SGST\s+₹\s*([\d.]+)/i);
        const igstM = itemText.match(/(\d+)%\s*IGST\s+₹\s*([\d.]+)/i);
        if (cgstM) { item.cgst_rate = parseFloat(cgstM[1]); item.cgst_amount = parseFloat(cgstM[2]); }
        if (sgstM) { item.sgst_rate = parseFloat(sgstM[1]); item.sgst_amount = parseFloat(sgstM[2]); }
        if (igstM) { item.igst_rate = parseFloat(igstM[1]); item.igst_amount = parseFloat(igstM[2]); }

        if (item.product_name.length > 3 && item.total_amount > 0) lineItems.push(item);
      } else {
        i++;
      }
    }
  }

  result.line_items = lineItems;
  result.total_amount = lineItems.reduce((s, i) => s + i.total_amount, 0);
  result.tax_amount = lineItems.reduce((s, i) => s + i.cgst_amount + i.sgst_amount + i.igst_amount, 0);
  result.subtotal = lineItems.reduce((s, i) => s + (i.taxable_value || i.unit_price * i.quantity), 0);

  let conf = 0;
  if (result.invoice_number) conf += 25;
  if (result.invoice_date) conf += 15;
  if (result.order_number) conf += 15;
  if (result.line_items.length > 0) conf += 25;
  if (result.line_items[0]?.sku) conf += 10;
  if (result.total_amount > 0) conf += 10;
  result.confidence = conf;

  return result;
}

// ── FLIPKART PARSER ──
function parseFlipkartInvoice(text) {
  if (!text) return null;
  if (!text.includes('Flipkart') && !text.match(/LWAC[A-Z0-9]+/)) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const result = {
    marketplace: 'flipkart', invoice_number: null, invoice_date: null,
    order_number: null, vendor_name: 'SRI ANNAI ENTERPRISES', vendor_gstin: null,
    customer_name: null, customer_address: null, subtotal: 0, discount: 0,
    tax_amount: 0, total_amount: 0, shipping_charges: 0, commission_amount: 0,
    line_items: [], confidence: 0,
  };

  // Invoice No — LWACCB... or LWAD... format
  const invM = full.match(/Invoice\s+No[:\s]+([A-Z0-9]{8,20})/i);
  if (invM) result.invoice_number = invM[1].trim();

  // Invoice Date
  const invDateM = full.match(/Invoice\s+Date[:\s]+([\d.\-\/]+)/i);
  if (invDateM) result.invoice_date = parseDate(invDateM[1]);

  // Order ID: OD + 18 digits
  const orderM = full.match(/(OD\d{15,20})/);
  if (orderM) result.order_number = orderM[1];

  // GSTIN
  const gstinM = full.match(/GSTIN[:\s]+([A-Z0-9]{15})/i);
  if (gstinM) result.vendor_gstin = gstinM[1];

  // SKU from label section
  const skuHeaderIdx = lines.findIndex(l => /^SKU\s+ID/i.test(l));
  let globalSku = null;
  if (skuHeaderIdx >= 0) {
    for (let i = skuHeaderIdx + 1; i < Math.min(skuHeaderIdx + 4, lines.length); i++) {
      const skuM = lines[i].match(/^([A-Z]{3,}[A-Z0-9]{3,})/);
      if (skuM) { globalSku = skuM[1]; break; }
    }
  }

  // Also check SKU from product description in invoice "| SAEAB10716"
  if (!globalSku) {
    const inlineSkuM = full.match(/\|\s*([A-Z]{3,}[A-Z0-9]{3,})\s/);
    if (inlineSkuM) globalSku = inlineSkuM[1];
  }

  // Customer name from Billing Address
  const billIdx = lines.findIndex(l => /Billing\s+Address/i.test(l));
  if (billIdx >= 0) {
    for (let i = billIdx + 1; i < Math.min(billIdx + 6, lines.length); i++) {
      const l = lines[i];
      if (l && !/GSTIN|Shipping|Sold|^\d/.test(l) && l.length > 2) {
        result.customer_name = l.replace(/[:,]$/, '').trim();
        const addrLines = [];
        for (let j = i+1; j < Math.min(i+5, lines.length); j++) {
          if (/Shipping\s+ADDRESS|GSTIN|Sold\s+By|E\.\s*&/i.test(lines[j])) break;
          addrLines.push(lines[j]);
        }
        result.customer_address = addrLines.join(', ');
        break;
      }
    }
  }

  // Line items table
  const tableIdx = lines.findIndex(l => /Product.*Description|Description.*Qty/i.test(l));
  const lineItems = [];

  if (tableIdx >= 0) {
    let i = tableIdx + 1;
    while (i < lines.length) {
      const l = lines[i];
      if (/TOTAL\s+QTY|Seller\s+Registered|E\.\s*&\s*O|Ordered\s+Through/i.test(l)) break;
      if (/Handling\s+Fee/i.test(l)) { i++; continue; }

      // Product line — has product name with marketplace prefix like "Sae Fashions..."
      if (l.length > 5 && !/^[\d.]+$/.test(l) && !/^Product|^Description/i.test(l) && !/GSTIN|Tax\s+Invoice/i.test(l)) {
        const item = { product_name: l, sku: globalSku, hsn_code: null, quantity: 1,
          unit_price: 0, discount: 0, taxable_value: 0,
          cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0,
          igst_rate: 0, igst_amount: 0, total_amount: 0 };

        // Collect descriptor + amounts lines
        let j = i + 1;
        const descLines = [];
        while (j < lines.length && !/TOTAL\s+QTY|Handling\s+Fee/i.test(lines[j])) {
          const nextL = lines[j];
          // Amounts line: has numbers
          if (/^\d+\s+[\d.]|^\d+$/.test(nextL)) {
            // Parse: Qty Gross Discount Taxable TaxAmt CESS Total
            const nums = nextL.match(/[\d.]+/g)?.map(Number) || [];
            if (nums.length >= 4) {
              item.quantity = nums[0];
              item.unit_price = nums[1];
              item.discount = nums[2];
              item.taxable_value = nums[3];
              item.total_amount = nums[nums.length - 1];
            }
            j++;
            break;
          }
          descLines.push(nextL);
          j++;
        }
        i = j;

        const descText = descLines.join(' ') + ' ' + l;
        const hsnM = descText.match(/HSN[:\s]*(\d{4,8})/i);
        if (hsnM) item.hsn_code = hsnM[1];

        // Extract inline SKU from description "| SAEAB10716"
        const inlineSkuM = descText.match(/\|\s*([A-Z]{3,}[A-Z0-9]{3,})/);
        if (inlineSkuM) item.sku = inlineSkuM[1];

        // Tax rates
        const igstM = descText.match(/IGST[:\s]+([\d.]+)%/i);
        const cgstM = descText.match(/CGST[:\s]+([\d.]+)%/i);
        const sgstM = descText.match(/SGST[:\s]+([\d.]+)%/i);
        if (igstM) {
          item.igst_rate = parseFloat(igstM[1]);
          item.igst_amount = Math.round(item.taxable_value * item.igst_rate / 100 * 100) / 100;
        }
        if (cgstM) { item.cgst_rate = parseFloat(cgstM[1]); item.cgst_amount = Math.round(item.taxable_value * item.cgst_rate / 100 * 100) / 100; }
        if (sgstM) { item.sgst_rate = parseFloat(sgstM[1]); item.sgst_amount = Math.round(item.taxable_value * item.sgst_rate / 100 * 100) / 100; }

        if (item.product_name.length > 3 && item.total_amount > 0) lineItems.push(item);
      } else {
        i++;
      }
    }
  }

  result.line_items = lineItems;
  result.total_amount = lineItems.reduce((s, i) => s + i.total_amount, 0);
  result.tax_amount = lineItems.reduce((s, i) => s + i.cgst_amount + i.sgst_amount + i.igst_amount, 0);
  result.discount = lineItems.reduce((s, i) => s + Math.abs(i.discount), 0);
  result.subtotal = lineItems.reduce((s, i) => s + i.taxable_value, 0);

  // Fallback total
  if (result.total_amount === 0) {
    const totalM = full.match(/TOTAL\s+PRICE[:\s]+([\d.]+)/i);
    if (totalM) result.total_amount = parseFloat(totalM[1]);
  }

  let conf = 0;
  if (result.invoice_number) conf += 25;
  if (result.invoice_date) conf += 15;
  if (result.order_number) conf += 15;
  if (result.line_items.length > 0) conf += 25;
  if (globalSku) conf += 10;
  if (result.total_amount > 0) conf += 10;
  result.confidence = conf;
  return result;
}

// ── MEESHO PARSER ──
function parseMeeshoInvoice(text) {
  if (!text) return null;
  if (!text.includes('Meesho') && !text.includes('Delhivery') && !text.includes('MANI PRIYA') && !text.match(/Purchase\s+Order\s+No/i)) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const result = {
    marketplace: 'meesho', invoice_number: null, invoice_date: null,
    order_number: null, vendor_name: 'SRI ANNAI ENTERPRISES', vendor_gstin: null,
    customer_name: null, customer_address: null, subtotal: 0, discount: 0,
    tax_amount: 0, total_amount: 0, shipping_charges: 0, commission_amount: 0,
    line_items: [], confidence: 0,
  };

  // Invoice No: on line AFTER "Invoice No." header
  // Meesho puts headers on one line: "Purchase Order No. Invoice No. Order Date Invoice Date"
  // Values on next line: "307174806029408448 n5evl27679 13.07.2026 15.07.2026"
  const poHeaderIdx = lines.findIndex(l => /Purchase\s+Order\s+No/i.test(l) && /Invoice\s+No/i.test(l));
  if (poHeaderIdx >= 0 && poHeaderIdx + 1 < lines.length) {
    const valLine = lines[poHeaderIdx + 1];
    // Format: "307174806029408448 n5evl27679 13.07.2026 15.07.2026"
    const parts = valLine.trim().split(/\s+/);
    if (parts.length >= 2) {
      result.order_number = parts[0];
      result.invoice_number = parts[1];
      if (parts[3]) result.invoice_date = parseDate(parts[3]);
    }
  }

  // Fallback: separate regexes
  if (!result.invoice_number) {
    const invM = full.match(/Invoice\s+No\.?\s*[\n\r]+([a-z0-9]{6,15})/i);
    if (invM && !/^\d{10,}$/.test(invM[1])) result.invoice_number = invM[1].trim();
  }
  if (!result.order_number) {
    const orderM = full.match(/Purchase\s+Order\s+No\.?\s*[\n\r]+(\d{15,20})/i);
    if (orderM) result.order_number = orderM[1].trim();
  }
  if (!result.invoice_date) {
    const invDateM = full.match(/Invoice\s+Date\s*[\n\r]+([\d.\-\/]+)/i);
    if (invDateM) result.invoice_date = parseDate(invDateM[1]);
  }

  // GSTIN
  const gstinM = full.match(/GSTIN\s*[-:]\s*([A-Z0-9]{15})/i);
  if (gstinM) result.vendor_gstin = gstinM[1];

  // SKU from label table header row
  const skuHeaderIdx = lines.findIndex(l => /^SKU\b/i.test(l) && /Size|Qty/i.test(l));
  let globalSku = null;
  if (skuHeaderIdx >= 0 && skuHeaderIdx + 1 < lines.length) {
    const skuM = lines[skuHeaderIdx + 1].match(/^(\d{4,8})\b/);
    if (skuM) globalSku = skuM[1];
  }

  // Customer name from BILL TO / SHIP TO
  const billIdx = lines.findIndex(l => /BILL\s+TO\s*\/\s*SHIP\s+TO/i.test(l));
  if (billIdx >= 0) {
    for (let i = billIdx + 1; i < Math.min(billIdx + 3, lines.length); i++) {
      const l = lines[i];
      if (l && !/^\d/.test(l) && l.length > 2 && !/Place\s+of\s+Supply|Sold\s+by/i.test(l)) {
        // Extract first meaningful name segment (before address detail)
        const nameM = l.match(/^([A-Za-z\s\-\.]+?)(?:\s*-\s*nu\s*\d|\s*,\s*\d|\s+\d{6})/);
        result.customer_name = nameM ? nameM[1].trim() : l.split(/[,\-]/)[0].trim();
        result.customer_address = l;
        break;
      }
    }
  }

  // Line items table — Meesho puts entire row on one line:
  // "15 ROD MULTICOLOR ABACUS KIT - Free Size 901720 1 Rs.111.00 Rs.-26.00 Rs.65.25 IGST @18.0% Rs.11.75 Rs.85.00"
  const tableIdx = lines.findIndex(l => /Description.*HSN|HSN.*Qty.*Gross/i.test(l));
  const lineItems = [];

  if (tableIdx >= 0) {
    let i = tableIdx + 1;
    while (i < lines.length) {
      const l = lines[i];
      if (/^Total\b|Tax\s+is\s+not\s+payable/i.test(l)) break;

      if (/Other\s+Charges/i.test(l)) {
        const charges = [...l.matchAll(/Rs\.\s*([\d.]+)/g)].map(m => parseFloat(m[1])).filter(v => v > 0);
        if (charges.length > 0) result.shipping_charges = charges[charges.length - 1];
        i++; continue;
      }

      // Product line: has product text followed by HSN code (6 digits) and Rs. amounts
      if (/Rs\.\s*[\d.]/.test(l) && /\d{6}/.test(l) && !/GSTIN|TAX\s+INVOICE/i.test(l)) {
        const item = { product_name: '', sku: globalSku, hsn_code: null, quantity: 1,
          unit_price: 0, discount: 0, taxable_value: 0,
          cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0,
          igst_rate: 0, igst_amount: 0, total_amount: 0 };

        // Product name: everything before the 6-digit HSN
        const nameM = l.match(/^(.+?)\s+(\d{6})\s+/);
        if (nameM) {
          item.product_name = nameM[1].trim();
          item.hsn_code = nameM[2];
        } else {
          item.product_name = l.split(/\d{6}/)[0].trim();
        }

        // Rs. amounts in order: Gross, Discount, Taxable, [tax amount], Total
        const amounts = [...l.matchAll(/Rs\.\s*(-?[\d.]+)/g)].map(m => parseFloat(m[1]));
        if (amounts.length >= 3) {
          item.unit_price = Math.abs(amounts[0]);
          item.discount = Math.abs(amounts[1]);
          item.taxable_value = amounts[2];
          item.total_amount = Math.abs(amounts[amounts.length - 1]);
        }

        const igstM = l.match(/IGST\s*@\s*([\d.]+)%\s*Rs\.\s*([\d.]+)/i);
        const cgstM = l.match(/CGST\s*@\s*([\d.]+)%[:\s]*Rs\.\s*([\d.]+)/i);
        const sgstM = l.match(/SGST\s*@\s*([\d.]+)%[:\s]*Rs\.\s*([\d.]+)/i);
        if (igstM) { item.igst_rate = parseFloat(igstM[1]); item.igst_amount = parseFloat(igstM[2]); }
        if (cgstM) { item.cgst_rate = parseFloat(cgstM[1]); item.cgst_amount = parseFloat(cgstM[2]); }
        if (sgstM) { item.sgst_rate = parseFloat(sgstM[1]); item.sgst_amount = parseFloat(sgstM[2]); }

        if (item.product_name.length > 3 && item.total_amount > 0) lineItems.push(item);
      }
      i++;
    }
  }

  result.line_items = lineItems;
  result.total_amount = lineItems.reduce((s, i) => s + i.total_amount, 0) + result.shipping_charges;
  result.tax_amount = lineItems.reduce((s, i) => s + i.cgst_amount + i.sgst_amount + i.igst_amount, 0);
  result.discount = lineItems.reduce((s, i) => s + i.discount, 0);
  result.subtotal = lineItems.reduce((s, i) => s + i.taxable_value, 0);

  let conf = 0;
  if (result.invoice_number) conf += 25;
  if (result.invoice_date) conf += 15;
  if (result.order_number) conf += 15;
  if (result.line_items.length > 0) conf += 25;
  if (globalSku) conf += 10;
  if (result.total_amount > 0) conf += 10;
  result.confidence = conf;
  return result;
}

// ── TEST DATA ──

const AMAZON_TEXT = `Tax Invoice/Bill of Supply/Cash Memo (Triplicate for Supplier)
Sold By :
SRI ANNAI ENTERPRISES
NO. 111-A, EKAMBARANATHAR KOIL SANNATHI STREET,
KANCHEEPURAM, TAMIL NADU, 631502 IN
PAN No: ATMPP2365G
GST Registration No: 33ATMPP2365G1ZK
Billing Address :
RAJASEKAR.K.C
Sivasiva Pooja Store, 110 A, Big Sourashtra Street
TIRUCHIRAPPALLI, TAMIL NADU, 620008 IN
State/UT Code: 33
Shipping Address :
RAJASEKAR.K.C
State/UT Code: 33
Place of supply: TAMIL NADU
Place of delivery: TAMIL NADU
Order Number: 405-2114111-3809101
Order Date: 08.06.2026
Invoice Number : IN-672
Invoice Details : TN-1490790665-2627
Invoice Date : 08.06.2026
Sl.No Description Unit Price Qty Net Amount Tax Rate Tax Type Tax Amount Total Amount
1 SAE Fashions Tamil Motivational Quote Wall Frame, Theethum Nandrum Pirar Thara Vara, A4 Size, Black Frame | B0DZ7RHPX9 ( SAE25355 )
HSN:442090
₹266.10 1 ₹266.10 9% CGST ₹23.95
9% SGST ₹23.95 ₹314.00
TOTAL:
₹47.90 ₹314.00
Amount in Words:
Three Hundred Fourteen only
Whether tax is payable on reverse charge - No
Payment Transaction ID: i93r4K6kP7KDnMyzFspXpQFTed1QC7Ik6jp Date & Time: 08.06.2026, 17:46:06 hrs Invoice Value: 314.00 Mode of Payment: UPI`;

// Test with REAL pdfjs format (each value on its own line with " \n" spacers)
const FLIPKART_REAL = `Tax Invoice

Order Id:

OD438072975207154100

Order Date: 12-07-2026, 10:10 PM
Invoice No:

LWACCB0270004186

Invoice Date: 14-07-2026, 04:32
AM

GSTIN: 33ATMPP2365G1ZK

Billing Address

Palla Sreekala,
26/921 near varalaksmi apartmen

Shipping ADDRESS

Palla Sreekala,

SKU ID Description QTY
SAEAB10716 Sae Fashions 13 ROD YELLOW AND RED ABACUS KIT SET OF 2 Multicolor 1

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

Sae Fashions 13 ROD YELLOW AND
RED ABACUS KIT SET OF 2 NA
Multicolor | SAEAB10716 | IMEI/SrNo:
[[]]
HSN: 95030030 | IGST: 5.00%
| CESS: 0.00%

1

146.00

-0.00

139.05

6.95

0.00

146.00

Handling Fee

1

0.00

0

0.00

0.00

0.00

0.00

TOTAL QTY: 1

TOTAL PRICE: 146.00

Ordered Through

Sri Annai Enterprises
Authorized Signature`;
STD SURFACE
OD438072975207154100 COD
Ordered through
Flipkart
AWB No. FMPC6295860279
SKU ID Description QTY
SAEAB10716 Sae Fashions 13 ROD YELLOW AND RED ABACUS KIT SET OF 2 Multicolor 1
Tax Invoice
Order Id: OD438072975207154100
Invoice No: LWACCB0270004186
Order Date: 12-07-2026, 10:10 PM Invoice Date: 14-07-2026, 04:32 AM
GSTIN: 33ATMPP2365G1ZK PAN: ATMPP2365G
Sold By
Sri Annai Enterprises,
Periya, Periya, KANCHIPURAM - 631502
Billing Address
Palla Sreekala,
26/921 near varalaksmi apartment, Nagendra nagar Near Varalakshmi apartment,
Proddatur - 516360, IN-AP
Shipping ADDRESS
Palla Sreekala,
Proddatur - 516360, IN-AP
Product Description Qty Gross Amount Discount Taxable Value IGST CESS Total
Sae Fashions 13 ROD YELLOW AND RED ABACUS KIT SET OF 2 Multicolor | SAEAB10716 HSN: 95030030 | IGST: 5.00% | CESS: 0.00%
1 146.00 0.00 139.05 6.95 0.00 146.00
Handling Fee 1 0.00 0 0.00 0.00 0.00 0.00
TOTAL QTY: 1 TOTAL PRICE: 146.00
Seller Registered Address: Sri Annai Enterprises
E. & O.E. Ordered Through Flipkart Sri Annai Enterprises Authorized Signature`;

const MEESHO_TEXT = `Customer Address
Vanishree - nu 8 1st floor,lakkasandra 16 th cross 8th main road , lakkasandra near canara atm , canara atm 9688612319, banglore, Karnataka, 560030, Place of Supply: Karnataka
If undelivered, return to: Sri Annai Enterprises, Kanchipuram-631502
Prepaid: Do not collect cash
Delhivery
SKU Size Qty Color Order No.
25352 Free Size 1 Multicolor 307174806029408448_1
TAX INVOICE Original For Recipient
BILL TO / SHIP TO
Vanishree - nu 8 1st floor,lakkasandra 16 th cross 8th main road , lakkasandra near canara atm, banglore, Karnataka, 560030, Place of Supply: Karnataka
Sold by : MANI PRIYA
Sri Annai Enterprises, NO. 111-A EKAMBARANATHAR KOIL SANNATHI STREET , Kanchipuram, Tamil Nadu, 631502
GSTIN - 33ATMPP2365G1ZK
Purchase Order No. Invoice No. Order Date Invoice Date
307174806029408448 n5evl27679 13.07.2026 15.07.2026
Description HSN Qty Gross Amount Discount Taxable Value Taxes Total
15 ROD MULTICOLOR ABACUS KIT - Free Size 901720 1 Rs.111.00 Rs.-26.00 Rs.65.25 IGST @18.0% Rs.11.75 Rs.85.00
Other Charges 901720 NA Rs.0.00 Rs.0 Rs.0.00 IGST @18.0% Rs.0.00 Rs.0.00
Total Rs.11.75 Rs.85.00
Tax is not payable on reverse charge basis.`;

// ── RUN TESTS ──
console.log('\n========================================');
console.log('AMAZON PARSER TEST');
console.log('========================================');
const amazon = parseAmazonInvoice(AMAZON_TEXT);
if (amazon) {
  console.log('✓ invoice_number:', amazon.invoice_number, amazon.invoice_number === 'IN-672' ? '✓' : '✗ expected IN-672');
  console.log('✓ invoice_date:', amazon.invoice_date, amazon.invoice_date === '2026-06-08' ? '✓' : '✗ expected 2026-06-08');
  console.log('✓ order_number:', amazon.order_number, amazon.order_number === '405-2114111-3809101' ? '✓' : '✗');
  console.log('✓ vendor_gstin:', amazon.vendor_gstin, amazon.vendor_gstin === '33ATMPP2365G1ZK' ? '✓' : '✗');
  console.log('✓ customer_name:', amazon.customer_name, amazon.customer_name === 'RAJASEKAR.K.C' ? '✓' : '✗');
  console.log('✓ line_items:', amazon.line_items.length, amazon.line_items.length > 0 ? '✓' : '✗ NO ITEMS!');
  if (amazon.line_items.length > 0) {
    const item = amazon.line_items[0];
    console.log('  - product_name:', item.product_name?.substring(0, 50));
    console.log('  - sku:', item.sku, item.sku === 'SAE25355' ? '✓' : '✗ expected SAE25355');
    console.log('  - hsn_code:', item.hsn_code, item.hsn_code === '442090' ? '✓' : '✗ expected 442090');
    console.log('  - total_amount:', item.total_amount, item.total_amount === 314 ? '✓' : '✗ expected 314');
    console.log('  - cgst_rate:', item.cgst_rate, item.cgst_rate === 9 ? '✓' : '✗ expected 9');
    console.log('  - cgst_amount:', item.cgst_amount, item.cgst_amount === 23.95 ? '✓' : '✗ expected 23.95');
  }
  console.log('✓ total_amount:', amazon.total_amount, amazon.total_amount === 314 ? '✓' : '✗ expected 314');
  console.log('✓ confidence:', amazon.confidence);
} else {
  console.log('✗ FAILED — parser returned null');
}

console.log('\n========================================');
console.log('FLIPKART PARSER TEST');
console.log('========================================');
const flipkart = parseFlipkartInvoice(FLIPKART_TEXT);
if (flipkart) {
  console.log('✓ invoice_number:', flipkart.invoice_number, flipkart.invoice_number === 'LWACCB0270004186' ? '✓' : '✗ expected LWACCB0270004186');
  console.log('✓ invoice_date:', flipkart.invoice_date, flipkart.invoice_date === '2026-07-14' ? '✓' : '✗ expected 2026-07-14');
  console.log('✓ order_number:', flipkart.order_number, flipkart.order_number === 'OD438072975207154100' ? '✓' : '✗');
  console.log('✓ vendor_gstin:', flipkart.vendor_gstin, flipkart.vendor_gstin === '33ATMPP2365G1ZK' ? '✓' : '✗');
  console.log('✓ customer_name:', flipkart.customer_name);
  console.log('✓ line_items:', flipkart.line_items.length, flipkart.line_items.length > 0 ? '✓' : '✗ NO ITEMS!');
  if (flipkart.line_items.length > 0) {
    const item = flipkart.line_items[0];
    console.log('  - sku:', item.sku, item.sku === 'SAEAB10716' ? '✓' : '✗ expected SAEAB10716');
    console.log('  - hsn_code:', item.hsn_code, item.hsn_code === '95030030' ? '✓' : '✗ expected 95030030');
    console.log('  - total_amount:', item.total_amount, item.total_amount === 146 ? '✓' : '✗ expected 146');
    console.log('  - igst_rate:', item.igst_rate, item.igst_rate === 5 ? '✓' : '✗ expected 5');
  }
  console.log('✓ total_amount:', flipkart.total_amount, flipkart.total_amount === 146 ? '✓' : '✗ expected 146');
  console.log('✓ confidence:', flipkart.confidence);
} else {
  console.log('✗ FAILED — parser returned null');
}

console.log('\n========================================');
console.log('MEESHO PARSER TEST');
console.log('========================================');
const meesho = parseMeeshoInvoice(MEESHO_TEXT);
if (meesho) {
  console.log('✓ invoice_number:', meesho.invoice_number, meesho.invoice_number === 'n5evl27679' ? '✓' : '✗ expected n5evl27679');
  console.log('✓ invoice_date:', meesho.invoice_date, meesho.invoice_date === '2026-07-15' ? '✓' : '✗ expected 2026-07-15');
  console.log('✓ order_number:', meesho.order_number, meesho.order_number === '307174806029408448' ? '✓' : '✗');
  console.log('✓ vendor_gstin:', meesho.vendor_gstin, meesho.vendor_gstin === '33ATMPP2365G1ZK' ? '✓' : '✗');
  console.log('✓ customer_name:', meesho.customer_name);
  console.log('✓ line_items:', meesho.line_items.length, meesho.line_items.length > 0 ? '✓' : '✗ NO ITEMS!');
  if (meesho.line_items.length > 0) {
    const item = meesho.line_items[0];
    console.log('  - product_name:', item.product_name?.substring(0, 50));
    console.log('  - sku:', item.sku, item.sku === '25352' ? '✓' : '✗ expected 25352');
    console.log('  - hsn_code:', item.hsn_code, item.hsn_code === '901720' ? '✓' : '✗ expected 901720');
    console.log('  - total_amount:', item.total_amount, item.total_amount === 85 ? '✓' : '✗ expected 85');
    console.log('  - igst_rate:', item.igst_rate, item.igst_rate === 18 ? '✓' : '✗ expected 18');
    console.log('  - igst_amount:', item.igst_amount, item.igst_amount === 11.75 ? '✓' : '✗ expected 11.75');
  }
  console.log('✓ total_amount:', meesho.total_amount, meesho.total_amount === 85 ? '✓' : '✗ expected 85');
  console.log('✓ confidence:', meesho.confidence);
} else {
  console.log('✗ FAILED — parser returned null');
}

console.log('\n========================================');
console.log('All tests complete');
console.log('========================================\n');
