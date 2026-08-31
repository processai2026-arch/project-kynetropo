/**
 * Flipkart Invoice Parser
 *
 * Flipkart PDFs: 1 page per order, dashed cut line separates shipping label (top) from invoice (bottom).
 * We only parse the invoice section (bottom half).
 *
 * Key patterns:
 * - Invoice No: "LWACCB0270004186"
 * - Order Id: "OD438072975207154100"
 * - SKU: dedicated "SKU ID" field in label section: "SAEAB10716"
 * - HSN: in Description column "HSN: 95030030 | IGST: 5.00%"
 * - Tax: IGST% or CGST/SGST% from description
 * - Line item table: Product | Description | Qty | Gross Amount | Discount | Taxable Value | IGST/CGST/SGST | CESS | Total
 */

import type { ParsedInvoice, ParsedLineItem } from './amazon';

function parseDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function cleanAmount(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[₹Rs,\s]/g, '')) || 0;
}

export function parseFlipkartInvoice(text: string): ParsedInvoice | null {
  if (!text) return null;
  if (!text.includes('Flipkart') && !text.includes('LWACCB') && !text.includes('E-Kart')) return null;

  // pdfjs puts each text element on its own line with " \n" spacers between values
  // Normalize: "Invoice No:\n\nLWACCB..." → "Invoice No: LWACCB..."
  const normalized = text
    .replace(/\n \n/g, '\n')    // blank-space-blank line → single newline
    .replace(/\n+/g, '\n')      // multiple newlines → one
    .trim();

  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const result: ParsedInvoice = {
    marketplace: 'flipkart',
    invoice_number: null,
    invoice_date: null,
    order_number: null,
    vendor_name: 'SRI ANNAI ENTERPRISES',
    vendor_gstin: null,
    customer_name: null,
    customer_gstin: null,
    customer_address: null,
    subtotal: 0,
    discount: 0,
    tax_amount: 0,
    total_amount: 0,
    shipping_charges: 0,
    commission_amount: 0,
    line_items: [],
    confidence: 0,
  };

  // Invoice No — value is on next line after "Invoice No:" in pdfjs output
  const invMatch = full.match(/Invoice\s+No[:\s]*\n([A-Z0-9]+)/i)
    || full.match(/Invoice\s+No[:\s]+([A-Z0-9]{8,20})/i);
  if (invMatch) result.invoice_number = invMatch[1].trim();

  // Invoice Date
  const invDateMatch = full.match(/Invoice\s+Date[:\s]+([\d\-\.\/]+)/i);
  if (invDateMatch) result.invoice_date = parseDate(invDateMatch[1]);

  // Order Id: "Order Id" followed by "OD..." (18+ chars)
  const orderMatch = full.match(/Order\s+I[dD][:\s]+(OD\d+)/i);
  if (orderMatch) result.order_number = orderMatch[1].trim();

  // GSTIN of seller
  const gstinMatch = full.match(/GSTIN[:\s]+([A-Z0-9]{15})/i);
  if (gstinMatch) result.vendor_gstin = gstinMatch[1];

  // SKU — appears in label section "SKU ID | Description | QTY" table
  // or in the label area as a standalone line after "SKU ID"
  const skuHeaderIdx = lines.findIndex(l => /SKU\s*ID/i.test(l));
  let globalSku: string | null = null;
  if (skuHeaderIdx >= 0) {
    // Next row in the table has SKU value
    for (let i = skuHeaderIdx + 1; i < Math.min(skuHeaderIdx + 4, lines.length); i++) {
      const skuMatch = lines[i].match(/^([A-Z]{2,}[A-Z0-9]+)/);
      if (skuMatch && skuMatch[1].length >= 6) { globalSku = skuMatch[1]; break; }
    }
  }

  // Billing address / customer name — after "Billing Address"
  const billingIdx = lines.findIndex(l => /Billing\s+Address/i.test(l));
  if (billingIdx >= 0) {
    for (let i = billingIdx + 1; i < Math.min(billingIdx + 6, lines.length); i++) {
      const l = lines[i];
      if (l && !/^\d/.test(l) && !/GSTIN|Shipping|Sold\s+By/i.test(l) && l.length > 2) {
        result.customer_name = l.replace(/[:,]$/, '').trim();
        const addrLines: string[] = [];
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          if (/Shipping\s+ADDRESS|GSTIN|Sold\s+By/i.test(lines[j])) break;
          addrLines.push(lines[j]);
        }
        result.customer_address = addrLines.join(', ');
        break;
      }
    }
  }

  // Line items — pdfjs puts each cell value on its own line.
  // After normalization the structure per item is:
  //   [product name lines]
  //   [HSN/tax rate line]
  //   [numbers: qty, gross, discount, taxable, tax, cess, total — one per line]
  // Find table start (after "Product" / "Description" header lines)
  const tableHeaderIdx = lines.findIndex(l => /^Product$|^Description$|Gross\s*Amount/i.test(l));
  const lineItems: ParsedLineItem[] = [];

  if (tableHeaderIdx >= 0) {
    let i = tableHeaderIdx + 1;
    // Skip remaining header cells (Description, Qty, Gross Amount, etc.)
    while (i < lines.length && /^Description$|^Qty$|^Gross$|^Amount$|^Discount$|^Taxable$|^Value$|^IGST$|^CGST$|^SGST|^CESS$|^Total$|^UTGST$/i.test(lines[i])) i++;

    while (i < lines.length) {
      const l = lines[i];
      if (/TOTAL\s+QTY|Seller\s+Registered|E\.\s*&\s*O\.E\.|Ordered\s+Through|All\s+values/i.test(l)) break;
      if (/^Handling\s+Fee/i.test(l)) { i++; continue; }

      // Product line: starts with text (not a standalone number)
      if (l.length > 3 && !/^-?[\d.]+$/.test(l) && !/^HSN:/i.test(l)) {
        const item: ParsedLineItem = {
          product_name: l,
          sku: globalSku,
          hsn_code: null,
          quantity: 1,
          unit_price: 0, discount: 0, taxable_value: 0,
          cgst_rate: 0, cgst_amount: 0,
          sgst_rate: 0, sgst_amount: 0,
          igst_rate: 0, igst_amount: 0,
          total_amount: 0,
        };

        // Extract SKU/HSN/tax rates from the product name line itself
        // (Flipkart often puts "| SAEAB10716 | IMEI... HSN: 95030030 | IGST: 5.00%" on same line)
        const skuOnLine = l.match(/\|\s*([A-Z]{3,}[A-Z0-9]{3,})\b/);
        if (skuOnLine && !skuOnLine[1].startsWith('IMEI')) item.sku = skuOnLine[1];
        const hsnOnLine = l.match(/HSN[:\s]*(\d{4,8})/i);
        if (hsnOnLine) item.hsn_code = hsnOnLine[1];
        const igstOnLine = l.match(/IGST[:\s]+([\d.]+)%/i);
        const cgstOnLine = l.match(/CGST[:\s]+([\d.]+)%/i);
        const sgstOnLine = l.match(/SGST[:\s]+([\d.]+)%/i);
        if (igstOnLine) item.igst_rate = parseFloat(igstOnLine[1]);
        if (cgstOnLine) item.cgst_rate = parseFloat(cgstOnLine[1]);
        if (sgstOnLine) item.sgst_rate = parseFloat(sgstOnLine[1]);

        // Collect product name continuation lines + HSN line
        i++;
        while (i < lines.length) {
          const cl = lines[i];
          if (/^-?[\d.]+$/.test(cl)) break; // number line = amounts start
          if (/TOTAL\s+QTY|Handling\s+Fee|Ordered\s+Through/i.test(cl)) break;

          if (/HSN[:\s]*([\d]{4,8})/i.test(cl)) {
            const hsnM = cl.match(/HSN[:\s]*(\d{4,8})/i);
            if (hsnM) item.hsn_code = hsnM[1];
            // Also extract tax rates from this line
            const igstM = cl.match(/IGST[:\s]+([\d.]+)%/i);
            const cgstM = cl.match(/CGST[:\s]+([\d.]+)%/i);
            const sgstM = cl.match(/SGST[:\s]+([\d.]+)%/i);
            if (igstM) item.igst_rate = parseFloat(igstM[1]);
            if (cgstM) item.cgst_rate = parseFloat(cgstM[1]);
            if (sgstM) item.sgst_rate = parseFloat(sgstM[1]);
          } else if (/\|\s*IGST[:\s]+([\d.]+)%|IGST[:\s]+([\d.]+)%/i.test(cl)) {
            const igstM = cl.match(/IGST[:\s]+([\d.]+)%/i);
            const cgstM = cl.match(/CGST[:\s]+([\d.]+)%/i);
            const sgstM = cl.match(/SGST[:\s]+([\d.]+)%/i);
            if (igstM) item.igst_rate = parseFloat(igstM[1]);
            if (cgstM) item.cgst_rate = parseFloat(cgstM[1]);
            if (sgstM) item.sgst_rate = parseFloat(sgstM[1]);
          } else if (!/^\[\[|^\|/.test(cl) && !/^IMEI|^CESS/i.test(cl)) {
            // Continuation of product name
            item.product_name += ' ' + cl;
          }

          // Extract inline SKU: "| SAEAB10716 |" or "| SAEAB10716"
          const skuM = cl.match(/\|\s*([A-Z]{3,}[A-Z0-9]{3,})\b/);
          if (skuM && !skuM[1].startsWith('IMEI')) item.sku = skuM[1];
          i++;
        }

        // Clean product name — strip SKU and everything after |
        item.product_name = item.product_name
          .split(/\|\s*[A-Z]{3,}[A-Z0-9]/)[0]
          .replace(/\[\[.*?\]\]/g, '')
          .replace(/\s+/g, ' ').trim();

        // Collect consecutive number lines (qty, gross, discount, taxable, tax, cess, total)
        const nums: number[] = [];
        while (i < lines.length && /^-?[\d.]+$/.test(lines[i])) {
          nums.push(parseFloat(lines[i]));
          i++;
        }

        // Assign: qty(0) gross(1) discount(2) taxable(3) tax(4) cess(5) total(6)
        // For CGST+SGST there are 8 numbers: qty gross discount taxable cgst sgst cess total
        if (nums.length >= 7) {
          item.quantity      = nums[0];
          item.unit_price    = nums[1];
          item.discount      = Math.abs(nums[2]);
          item.taxable_value = nums[3];
          if (nums.length === 8) {
            // CGST + SGST format: qty gross discount taxable cgst sgst cess total
            item.cgst_amount   = nums[4];
            item.sgst_amount   = nums[5];
            item.total_amount  = nums[7];
          } else {
            // IGST format
            item.igst_amount   = nums[4];
            item.total_amount  = nums[6];
          }
        }

        // Calculate tax amounts from rates if amounts not set
        if (item.igst_amount === 0 && item.igst_rate > 0) item.igst_amount = Math.round(item.taxable_value * item.igst_rate / 100 * 100) / 100;
        if (item.cgst_amount === 0 && item.cgst_rate > 0) item.cgst_amount = Math.round(item.taxable_value * item.cgst_rate / 100 * 100) / 100;
        if (item.sgst_amount === 0 && item.sgst_rate > 0) item.sgst_amount = Math.round(item.taxable_value * item.sgst_rate / 100 * 100) / 100;

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

  // Fallback: TOTAL PRICE from bottom of page
  if (result.total_amount === 0) {
    const totalMatch = full.match(/TOTAL\s+PRICE[:\s]+([\d.]+)/i);
    if (totalMatch) result.total_amount = parseFloat(totalMatch[1]);
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
