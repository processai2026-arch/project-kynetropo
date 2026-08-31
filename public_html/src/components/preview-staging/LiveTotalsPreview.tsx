import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface LiveTotalsLine {
  quantity: number;
  unit_price: number;
  gst_rate: number;
}

export interface LiveTotalsPreviewProps {
  lines: LiveTotalsLine[];
  deliveryFee?: string;
  discount?: string;
  customerState?: string;
  sellerState?: string;
}

const inr = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export function LiveTotalsPreview({
  lines,
  deliveryFee = "0",
  discount = "0",
  customerState = "",
  sellerState = "",
}: LiveTotalsPreviewProps) {
  return (() => {
    const isInterstate =
      customerState.trim() !== "" &&
      sellerState.trim() !== "" &&
      customerState.trim().toLowerCase() !== sellerState.trim().toLowerCase();

    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

    const gstByRate = lines.reduce<Record<number, number>>((acc, l) => {
      if (l.gst_rate > 0) {
        acc[l.gst_rate] =
          (acc[l.gst_rate] ?? 0) + l.quantity * l.unit_price * (l.gst_rate / 100);
      }
      return acc;
    }, {});

    const totalGst = Object.values(gstByRate).reduce((s, v) => s + v, 0);
    const delivery = Math.max(0, parseFloat(deliveryFee) || 0);
    const disc = Math.max(0, parseFloat(discount) || 0);
    const preTotalRaw = subtotal + totalGst + delivery - disc;
    const grandTotal = Math.round(preTotalRaw);
    const roundOff = grandTotal - preTotalRaw;

    return (
      <div className="mt-3 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{inr(subtotal)}</span>
          </div>

          {Object.entries(gstByRate)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([rate, amount]) => {
              const r = Number(rate);
              if (isInterstate) {
                return (
                  <div
                    key={`igst-${rate}`}
                    className="flex justify-between text-muted-foreground"
                  >
                    <span>IGST {r}%</span>
                    <span>{inr(amount)}</span>
                  </div>
                );
              }
              return (
                <Fragment key={`gst-${rate}`}>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST {r / 2}%</span>
                    <span>{inr(amount / 2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST {r / 2}%</span>
                    <span>{inr(amount / 2)}</span>
                  </div>
                </Fragment>
              );
            })}

          {delivery > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span>{inr(delivery)}</span>
            </div>
          )}

          {disc > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="text-destructive">-{inr(disc)}</span>
            </div>
          )}

          {Math.abs(roundOff) >= 0.005 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Round-off</span>
              <span
                className={cn(
                  roundOff < 0 ? "text-emerald-600" : "text-destructive"
                )}
              >
                {roundOff > 0 ? `+${inr(roundOff)}` : inr(roundOff)}
              </span>
            </div>
          )}

          <div className="flex justify-between border-t pt-1 font-bold">
            <span>Total</span>
            <span className="text-primary">{inr(grandTotal)}</span>
          </div>
        </div>
      </div>
    );
  })();
}
