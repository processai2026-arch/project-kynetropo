/**
 * Invoice Parser Router
 *
 * Routes PDF text to the correct platform parser based on marketplace selection.
 * Falls back to Groq Vision AI if text extraction fails or yields low confidence.
 *
 * Usage:
 *   const result = await extractInvoiceFromPdf(file, 'flipkart');
 *   // result is ParsedInvoice or null (falls back to server AI)
 */

import { parseAmazonInvoice } from './amazon';
import { parseFlipkartInvoice } from './flipkart';
import { parseMeeshoInvoice } from './meesho';
import type { ParsedInvoice } from './amazon';

export type { ParsedInvoice };
export type { ParsedLineItem } from './amazon';

const MIN_CONFIDENCE = 40; // below this, fall back to AI

// Extract text from a PDF page using pdfjs-dist (text layer only — instant, no API)
async function extractPdfPageText(file: File, pageNum: number): Promise<string> {
  const pdfjsLib = await getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  if (pageNum > pdf.numPages) return '';
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  return content.items.map((item: any) => ('str' in item ? item.str : '')).join('\n');
}

// Shared pdfjs instance — init worker once
let pdfjsInitialized = false;
async function getPdfjsLib() {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsInitialized) {
    // Use the hashed .mjs asset — now served correctly after .htaccess fix
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    pdfjsInitialized = true;
  }
  return pdfjsLib;
}

// Get page count from PDF using pdfjs
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const pdfjsLib = await getPdfjsLib();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    return pdf.numPages;
  } catch (err) {
    console.warn('[Parser] getPdfPageCount failed:', err);
    return 1;
  }
}

// Parse one page of a PDF using the platform parser
// Returns ParsedInvoice on success, null if should fall back to AI
export async function extractInvoiceFromPdfPage(
  file: File,
  pageNum: number,
  marketplace: string,
): Promise<ParsedInvoice | null> {
  try {
    const text = await extractPdfPageText(file, pageNum);
    if (!text || text.trim().length < 50) return null;

    // Debug: log full text to console
    console.log(`[Parser] Page ${pageNum} FULL TEXT:`, text);

    return parseForMarketplace(text, marketplace);
  } catch (err) {
    console.error('[Parser] PDF text extraction failed:', err);
    return null;
  }
}

// Parse text for a specific marketplace
export function parseForMarketplace(text: string, marketplace: string): ParsedInvoice | null {
  let result: ParsedInvoice | null = null;

  const mp = marketplace.toLowerCase();

  if (mp === 'amazon') {
    result = parseAmazonInvoice(text);
  } else if (mp === 'flipkart') {
    result = parseFlipkartInvoice(text);
  } else if (mp === 'meesho') {
    result = parseMeeshoInvoice(text);
  } else {
    // Auto-detect from text content
    if (text.includes('amazon') || text.includes('ATSPL') || text.match(/Order Number.*\d{3}-\d{7}/i)) {
      result = parseAmazonInvoice(text);
    } else if (text.includes('Flipkart') || text.includes('E-Kart') || text.match(/OD\d{18}/)) {
      result = parseFlipkartInvoice(text);
    } else if (text.includes('Meesho') || text.includes('Delhivery') || text.match(/Purchase\s+Order\s+No/i)) {
      result = parseMeeshoInvoice(text);
    }
  }

  if (!result || result.confidence < MIN_CONFIDENCE) return null;
  return result;
}

// Convert ParsedInvoice to the format expected by the backend /approve endpoint
export function parsedInvoiceToValidatedData(parsed: ParsedInvoice) {
  return {
    invoice_number:   parsed.invoice_number,
    invoice_date:     parsed.invoice_date,
    vendor_name:      parsed.vendor_name,
    vendor_gstin:     parsed.vendor_gstin,
    customer_name:    parsed.customer_name,
    customer_gstin:   parsed.customer_gstin,
    customer_address: parsed.customer_address,
    subtotal:         parsed.subtotal,
    tax_amount:       parsed.tax_amount,
    total_amount:     parsed.total_amount,
    shipping_charges: parsed.shipping_charges,
    commission_amount: parsed.commission_amount,
    ai_confidence_score: parsed.confidence,
    line_items: parsed.line_items.map(item => ({
      product_name:    item.product_name,
      sku:             item.sku,
      hsn_code:        item.hsn_code,
      quantity:        item.quantity,
      unit_price:      item.unit_price,
      discount:        item.discount,
      taxable_value:   item.taxable_value,
      cgst_rate:       item.cgst_rate,
      cgst_amount:     item.cgst_amount,
      sgst_rate:       item.sgst_rate,
      sgst_amount:     item.sgst_amount,
      igst_rate:       item.igst_rate,
      igst_amount:     item.igst_amount,
      total_amount:    item.total_amount,
      confidence:      parsed.confidence,
      confidence_score: parsed.confidence, // review page uses confidence_score
    })),
    field_confidence: {
      invoice_number: parsed.invoice_number ? 95 : 0,
      invoice_date:   parsed.invoice_date ? 95 : 0,
      vendor_name:    90,
      vendor_gstin:   parsed.vendor_gstin ? 95 : 0,
      line_items:     parsed.line_items.length > 0 ? 90 : 0,
      totals:         parsed.total_amount > 0 ? 90 : 0,
    },
  };
}
