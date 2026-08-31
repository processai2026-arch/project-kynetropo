/**
 * Meesho Invoice Parser
 *
 * Meesho PDFs: 1 page per order, shipping label on top, tax invoice on bottom.
 * Courier: Delhivery
 *
 * Key patterns:
 * - Invoice No: "n5evl27679" (alphanumeric, short)
 * - Purchase Order No: "307174806029408448" (Meesho order, 18 digits)
 * - SKU: numeric code in label table "SKU | Size | Qty | Color | Order No."
 * - HSN: dedicated column in invoice table
 * - Tax: "IGST @18.0% Rs.XX.XX" or "SGST @9.0% :Rs.XX / CGST @9.0% :Rs.XX"
 * - Line item table: Description | HSN | Qty | Gross Amount | Discount | Taxable Value | Taxes | Total
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
  return parseFloat(s.replace(/[₹Rs,\s:]/g, '')) || 0;
}

export function parseMeeshoInvoice(text: string): ParsedInvoice | null {
  if (!text) return null;
  if (!text.includes('Meesho') && !text.includes('Delhivery') && !text.includes('MANI PRIYA') && !text.match(/Purchase\s+Order\s+No/i)) return null;

  // Normalize pdfjs multi-line output: collapse "\n \n" spacers
  const normalized = text.replace(/\n \n/g, '\n').replace(/\n+/g, '\n').trim();
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const result: ParsedInvoice = {
    marketplace: 'meesho',
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

  // All fields on two lines: headers then values
  // "Purchase Order No. Invoice No. Order Date Invoice Date"
  // "307174806029408448 n5evl27679 13.07.2026 15.07.2026"
  const poHeaderIdx = lines.findIndex(l => /Purchase\s+Order\s+No/i.test(l) && /Invoice\s+No/i.test(l));
  if (poHeaderIdx >= 0 && poHeaderIdx + 1 < lines.length) {
    const parts = lines[poHeaderIdx + 1].trim().split(/\s+/);
    if (parts.length >= 2) {
      result.order_number   = parts[0];
      result.invoice_number = parts[1];
      if (parts[3]) result.invoice_date = parseDate(parts[3]);
    }
  }
  // Fallback individual regexes
  if (!result.invoice_number) {
    const m = full.match(/Invoice\s+No\.?\s*[\n\r]+([a-z0-9]{6,15})/i);
    if (m && !/^\d{10,}$/.test(m[1])) result.invoice_number = m[1].trim();
  }
  if (!result.order_number) {
    const m = full.match(/Purchase\s+Order\s+No\.?\s*[\n\r]+(\d{15,20})/i);
    if (m) result.order_number = m[1].trim();
  }
  if (!result.invoice_date) {
    const m = full.match(/Invoice\s+Date\s*[\n\r]+([\d.\-\/]+)/i);
    if (m) result.invoice_date = parseDate(m[1]);
  }

  // GSTIN
  const gstinMatch = full.match(/GSTIN\s*[-:]\s*([A-Z0-9]{15})/i);
  if (gstinMatch) result.vendor_gstin = gstinMatch[1];

  // SKU from label section — two formats:
  // Format 1 (combined PDF): "SKU Size Qty Color Order No." header, value on next row
  // Format 2 (invoice-only PDF): "SKU" alone on one line, value on next line
  const skuHeaderIdx = lines.findIndex(l => /^SKU\b/i.test(l) && /Size|Qty|Color/i.test(l));
  const skuSoloIdx  = lines.findIndex(l => /^SKU$/i.test(l));
  let globalSku: string | null = null;
  if (skuHeaderIdx >= 0 && skuHeaderIdx + 1 < lines.length) {
    const skuRow = lines[skuHeaderIdx + 1];
    const skuM = skuRow.match(/^(\d{4,8})\b/);
    if (skuM) globalSku = skuM[1];
  } else if (skuSoloIdx >= 0 && skuSoloIdx + 1 < lines.length) {
    const nextLine = lines[skuSoloIdx + 1];
    const skuM = nextLine.match(/^(\d{4,8})\b/);
    if (skuM) globalSku = skuM[1];
  }

  // Customer name — first line after "BILL TO / SHIP TO"
  const billToIdx = lines.findIndex(l => /BILL\s+TO\s*\/\s*SHIP\s+TO/i.test(l));
  if (billToIdx >= 0) {
    for (let i = billToIdx + 1; i < Math.min(billToIdx + 3, lines.length); i++) {
      const l = lines[i];
      if (l && !/^\d/.test(l) && l.length > 2 && !/Place\s+of\s+Supply|Sold\s+by/i.test(l)) {
        result.customer_name = l.split(/\s+-\s+|\s*,/)[0].trim();
        result.customer_address = l;
        break;
      }
    }
  }

  // Line items — Meesho puts entire row on one line:
  // "15 ROD MULTICOLOR ABACUS KIT - Free Size 901720 1 Rs.111.00 Rs.-26.00 Rs.65.25 IGST @18.0% Rs.11.75 Rs.85.00"
  const tableHeaderIdx = lines.findIndex(l => /Description.*HSN|HSN.*Qty/i.test(l));
  const lineItems: ParsedLineItem[] = [];

  if (tableHeaderIdx >= 0) {
    let i = tableHeaderIdx + 1;
    while (i < lines.length) {
      const l = lines[i];
      if (/^Total\b|Tax\s+is\s+not\s+payable/i.test(l)) break;

      // Other Charges — extract logistics fee if non-zero
      if (/Other\s+Charges/i.test(l)) {
        const charges = [...l.matchAll(/Rs\.\s*([\d.]+)/g)].map(m => parseFloat(m[1])).filter(v => v > 0);
        if (charges.length > 0) result.shipping_charges = charges[charges.length - 1];
        i++; continue;
      }

      // Product line: has 6-digit HSN and Rs. amounts on same line
      if (/Rs\.\s*[\d.]/.test(l) && /\b\d{6}\b/.test(l) && !/GSTIN|TAX\s+INVOICE/i.test(l)) {
        const item: ParsedLineItem = {
          product_name: '', sku: globalSku, hsn_code: null, quantity: 1,
          unit_price: 0, discount: 0, taxable_value: 0,
          cgst_rate: 0, cgst_amount: 0,
          sgst_rate: 0, sgst_amount: 0,
          igst_rate: 0, igst_amount: 0,
          total_amount: 0,
        };

        // Product name: everything before the 6-digit HSN
        const nameM = l.match(/^(.+?)\s+(\d{6})\s+/);
        if (nameM) { item.product_name = nameM[1].trim(); item.hsn_code = nameM[2]; }
        else { item.product_name = l.split(/\d{6}/)[0].trim(); }

        // Rs. amounts in order: Gross | Discount | Taxable | [tax] | Total
        const amounts = [...l.matchAll(/Rs\.\s*(-?[\d.]+)/g)].map(m => parseFloat(m[1]));
        if (amounts.length >= 3) {
          item.unit_price    = Math.abs(amounts[0]);
          item.discount      = Math.abs(amounts[1]);
          item.taxable_value = amounts[2];
          item.total_amount  = Math.abs(amounts[amounts.length - 1]);
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

  // Fallback total from page
  if (result.total_amount === 0) {
    const totalM = full.match(/^Total\s+(Rs\.\s*[\d.]+)/im);
    if (totalM) result.total_amount = cleanAmount(totalM[1]);
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
