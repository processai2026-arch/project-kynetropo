/**
 * Amazon Invoice Parser — handles real pdfjs text format
 *
 * Real pdfjs output for Amazon (amounts on same line, not separate lines):
 *   "₹266.10" then next line "1" then "₹266.10 9%" then "CGST" then "₹23.95 ₹314.00"
 * OR all amounts joined:
 *   "₹266.10 9% CGST ₹23.95 ₹314.00"
 *
 * Header split: "Sl." and "No" on separate lines
 */

export interface ParsedLineItem {
  product_name: string;
  sku: string | null;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  taxable_value: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_amount: number;
}

export interface ParsedInvoice {
  marketplace: string;
  invoice_number: string | null;
  invoice_date: string | null;
  order_number: string | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  customer_name: string | null;
  customer_gstin: string | null;
  customer_address: string | null;
  subtotal: number;
  discount: number;
  tax_amount: number;
  total_amount: number;
  shipping_charges: number;
  commission_amount: number;
  line_items: ParsedLineItem[];
  confidence: number;
  raw_text?: string;
}

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

export function parseAmazonInvoice(text: string): ParsedInvoice | null {
  if (!text) return null;
  if (!text.includes('Tax Invoice') && !text.includes('amazon') && !text.includes('Invoice Number')) return null;

  // Normalize: collapse "\n \n" spacers
  const normalized = text.replace(/\n \n/g, '\n').replace(/\n+/g, '\n').trim();
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const full = lines.join('\n');

  const result: ParsedInvoice = {
    marketplace: 'amazon',
    invoice_number: null, invoice_date: null, order_number: null,
    vendor_name: 'SRI ANNAI ENTERPRISES', vendor_gstin: null,
    customer_name: null, customer_gstin: null, customer_address: null,
    subtotal: 0, discount: 0, tax_amount: 0, total_amount: 0,
    shipping_charges: 0, commission_amount: 0,
    line_items: [], confidence: 0,
  };

  // Invoice Number — on next line after label
  const invMatch = full.match(/Invoice\s+Number\s*[:\-]\s*([A-Z]{2,3}[-_]?\d+)/i)
    || full.match(/Invoice\s+Number\s*[:\-]?\s*\n([A-Z]{2,3}[-_]?\d+)/i);
  if (invMatch) result.invoice_number = invMatch[1].trim();

  // Invoice Date
  const invDateMatch = full.match(/Invoice\s+Date\s*[:\-]\s*([\d.\/\-]+)/i);
  if (invDateMatch) result.invoice_date = parseDate(invDateMatch[1]);

  // Order Number
  const orderMatch = full.match(/Order\s+Number\s*[:\-\s]+([\d\-]+)/i);
  if (orderMatch) result.order_number = orderMatch[1].trim();

  // Vendor GSTIN
  const gstinMatch = full.match(/GST\s+Registration\s+No\s*[:\-]\s*([A-Z0-9]{15})/i);
  if (gstinMatch) result.vendor_gstin = gstinMatch[1];

  // Customer name from Billing Address
  const billingIdx = lines.findIndex(l => /Billing\s+Address/i.test(l));
  if (billingIdx >= 0) {
    for (let i = billingIdx + 1; i < Math.min(billingIdx + 5, lines.length); i++) {
      const l = lines[i];
      if (l && !/^\d/.test(l) && !/State|Place|Shipping|PAN/i.test(l) && l.length > 2) {
        result.customer_name = l.replace(/[:,]$/, '').trim();
        const addrLines: string[] = [];
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          if (/Shipping\s+Address|State\/UT\s+Code|Place\s+of/i.test(lines[j])) break;
          addrLines.push(lines[j]);
        }
        result.customer_address = addrLines.join(', ');
        break;
      }
    }
  }

  // ── Line items ────────────────────────────────────────────────────────────
  // Find table: "Sl." or "Sl.\nNo" or "Sl.No" — header may be split across lines
  // Also look for the SI number "1" after the Description header
  const tableIdx = lines.findIndex(l =>
    /^Sl\.?\s*(No\.?)?$/i.test(l) ||
    /^Sl\.?\s*No\s+Description/i.test(l) ||
    /Description.*Unit\s*Price|Unit\s*Price.*Qty/i.test(l)
  );

  const lineItems: ParsedLineItem[] = [];

  if (tableIdx >= 0) {
    let i = tableIdx + 1;
    // Skip all header word cells
    while (i < lines.length &&
      /^No\.?$|^Description$|^Unit$|^Price$|^Qty$|^Net$|^Amount$|^Tax$|^Rate$|^Type$|^Total$/i.test(lines[i])) i++;

    while (i < lines.length) {
      const l = lines[i];
      if (/^TOTAL[:\s]|Amount\s+in\s+Words|Whether\s+tax/i.test(l)) break;

      // SI number alone on a line
      if (/^\d{1,2}$/.test(l)) {
        i++;
        const item: ParsedLineItem = {
          product_name: '', sku: null, hsn_code: null, quantity: 1,
          unit_price: 0, discount: 0, taxable_value: 0,
          cgst_rate: 0, cgst_amount: 0,
          sgst_rate: 0, sgst_amount: 0,
          igst_rate: 0, igst_amount: 0,
          total_amount: 0,
        };

        // Collect product name lines until we hit HSN or a ₹ amount
        const nameLines: string[] = [];
        while (i < lines.length) {
          const cl = lines[i];
          if (/^TOTAL|Amount\s+in\s+Words|Whether\s+tax/i.test(cl)) break;
          if (/^HSN[:\s]*\d/i.test(cl) || /^₹/.test(cl)) break;
          // ₹ embedded in line (real format: "₹266.10 9%" or "₹266.10")
          if (/₹\d/.test(cl) && !/[|(\[]/. test(cl)) break;

          if (/HSN[:\s]*(\d{4,8})/i.test(cl)) {
            const hsnM = cl.match(/HSN[:\s]*(\d{4,8})/i);
            if (hsnM) item.hsn_code = hsnM[1];
          } else {
            nameLines.push(cl);
            // SKU in parentheses ( SAE25355 ) — seller SKU, NOT the ASIN (B0XXXXXXXX)
            const skuM = cl.match(/\(\s*([A-Z0-9\-]{4,20})\s*\)/);
            if (skuM && !/^B[0-9A-Z]{9}$/.test(skuM[1])) item.sku = skuM[1].trim();
          }
          i++;
        }

        item.product_name = nameLines
          .join(' ')
          .split(/\|\s*[A-Z]{2,}[A-Z0-9]/)[0]
          .replace(/\[\[.*?\]\]/g, '')
          .replace(/\s+/g, ' ').trim();

        // HSN on its own line
        if (i < lines.length && /^HSN[:\s]*\d/i.test(lines[i])) {
          const hsnM = lines[i].match(/HSN[:\s]*(\d{4,8})/i);
          if (hsnM) item.hsn_code = hsnM[1];
          i++;
        }

        // Qty — standalone integer before ₹ amounts
        if (i < lines.length && /^\d{1,3}$/.test(lines[i])) {
          item.quantity = parseInt(lines[i]);
          i++;
        }

        // Collect all remaining lines for this item until TOTAL/next item
        const amtBlock: string[] = [];
        while (i < lines.length) {
          const cl = lines[i];
          if (/^TOTAL[:\s]|Amount\s+in\s+Words|Whether\s+tax/i.test(cl)) break;
          // Next SI number
          if (/^\d{1,2}$/.test(cl)) {
            const nx = lines[i + 1] ?? '';
            if (nx.length > 8 && !/^₹|^\d+%|^CGST$|^SGST$|^IGST$|^[\d.]+$|^TOTAL/i.test(nx)) break;
          }
          amtBlock.push(cl);
          i++;
        }

        // Extract total from "TOTAL: ₹47.90 ₹314.00" — last ₹ on TOTAL line is grand total
        // Also check "Invoice Value: 314.00"
        const totalLineMatch = blockText.match(/TOTAL[:\s].*?₹\s*([\d,]+\.\d+)\s*$/im)
          || blockText.match(/Invoice\s+Value[:\s]+([\d,]+\.?\d*)/i);

        // All ₹ amounts with decimals from block
        const rupeeAmts = [...blockText.matchAll(/₹\s*([\d,]+\.\d+)/g)]
          .map(m => parseFloat(m[1].replace(/,/g, '')))
          .filter(v => v > 0);

        if (rupeeAmts.length >= 2) {
          item.unit_price    = rupeeAmts[0];
          item.taxable_value = rupeeAmts[1] <= rupeeAmts[0] * 1.1 ? rupeeAmts[1] : rupeeAmts[0];
        }

        // Total = from TOTAL line, or last ₹ amount, or Invoice Value
        if (totalLineMatch) {
          item.total_amount = parseFloat(totalLineMatch[1].replace(/,/g, ''));
        } else if (rupeeAmts.length > 0) {
          // Find the largest ₹ amount after taxable — that's the total
          const candidateTotals = rupeeAmts.filter(v => v >= (item.taxable_value || item.unit_price));
          item.total_amount = candidateTotals.length > 0
            ? Math.max(...candidateTotals)
            : rupeeAmts[rupeeAmts.length - 1];
        }

        // Tax rates and amounts from block text
        const cgstM = blockText.match(/(\d+)%\s*CGST/i);
        const sgstM = blockText.match(/(\d+)%\s*SGST/i);
        const igstM = blockText.match(/(\d+)%\s*IGST/i);
        if (cgstM) {
          item.cgst_rate   = parseFloat(cgstM[1]);
          item.cgst_amount = Math.round(item.taxable_value * item.cgst_rate / 100 * 100) / 100;
        }
        if (sgstM) {
          item.sgst_rate   = parseFloat(sgstM[1]);
          item.sgst_amount = Math.round(item.taxable_value * item.sgst_rate / 100 * 100) / 100;
        }
        if (igstM) {
          item.igst_rate   = parseFloat(igstM[1]);
          item.igst_amount = Math.round(item.taxable_value * item.igst_rate / 100 * 100) / 100;
        }
      } else {
        i++;
      }
    }
  }

  // Fallback: try to get total from "Invoice Value:" line
  if (lineItems.length === 0) {
    const invValMatch = full.match(/Invoice\s+Value[:\s]+([\d,]+\.?\d*)/i);
    if (invValMatch) result.total_amount = parseFloat(invValMatch[1].replace(/,/g, ''));
  }

  result.line_items   = lineItems;
  result.total_amount = lineItems.length > 0
    ? lineItems.reduce((s, i) => s + i.total_amount, 0)
    : result.total_amount;
  result.tax_amount   = lineItems.reduce((s, i) => s + i.cgst_amount + i.sgst_amount + i.igst_amount, 0);
  result.subtotal     = lineItems.reduce((s, i) => s + (i.taxable_value || i.unit_price * i.quantity), 0);

  let conf = 0;
  if (result.invoice_number) conf += 25;
  if (result.invoice_date)   conf += 15;
  if (result.order_number)   conf += 15;
  if (result.line_items.length > 0) conf += 25;
  if (result.line_items[0]?.sku) conf += 10;
  if (result.total_amount > 0) conf += 10;
  result.confidence = conf;

  return result;
}
