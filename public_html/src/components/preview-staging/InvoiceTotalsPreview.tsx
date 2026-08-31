import { inr } from "@/lib/currency";

export interface InvoiceLine {
  quantity: number;
  unit_price: number;
  gst_rate: number;
}

export interface InvoiceTotalsPreviewProps {
  lines: InvoiceLine[];
  delivery_fee: number | string;
  discount: number | string;
  customer_state: string;
  seller_state: string;
}

export function InvoiceTotalsPreview({
  lines,
  delivery_fee,
  discount,
  customer_state,
  seller_state,
}: InvoiceTotalsPreviewProps) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const rawGst = lines.reduce(
    (s, l) => s + l.quantity * l.unit_price * (l.gst_rate / 100),
    0
  );

  const delivery = parseFloat(String(delivery_fee)) || 0;
  const disc = parseFloat(String(discount)) || 0;

  const taxable = Math.max(0, subtotal - disc);
  const gstTotal = subtotal > 0 ? rawGst * (taxable / subtotal) : 0;

  const rawTotal = taxable + gstTotal + delivery;
  const total = Math.round(rawTotal);
  const roundOff = total - rawTotal;

  const interState =
    customer_state.trim().toLowerCase() !== seller_state.trim().toLowerCase();

  return (
    <div className="mt-3 flex justify-end">
      <div className="w-64 space-y-1 text-sm">
        {/* Subtotal */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-card-foreground">{inr(subtotal)}</span>
        </div>

        {/* GST — IGST for inter-state, CGST + SGST for intra-state */}
        {interState ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">IGST</span>
            <span className="text-card-foreground">{inr(gstTotal)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CGST</span>
              <span className="text-card-foreground">{inr(gstTotal / 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SGST</span>
              <span className="text-card-foreground">{inr(gstTotal / 2)}</span>
            </div>
          </>
        )}

        {/* Delivery — only when non-zero */}
        {delivery > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className="text-card-foreground">{inr(delivery)}</span>
          </div>
        )}

        {/* Discount — only when non-zero, styled destructive */}
        {disc > 0 && (
          <div className="flex justify-between text-destructive">
            <span>Discount</span>
            <span>− {inr(disc)}</span>
          </div>
        )}

        {/* Round-off — only when meaningful (>= 0.005) */}
        {Math.abs(roundOff) >= 0.005 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Round Off</span>
            <span className="text-card-foreground">
              {roundOff >= 0 ? "+" : "−"} ₹{Math.abs(roundOff).toFixed(2)}
            </span>
          </div>
        )}

        {/* Grand total */}
        <div className="flex justify-between border-t border-border pt-2 font-bold">
          <span className="text-foreground">Total</span>
          <span className="text-primary">{inr(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default InvoiceTotalsPreview;
