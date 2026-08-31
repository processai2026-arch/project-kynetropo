import { cn } from "@/lib/utils";

interface PaymentSideLabelProps {
  /** Financial direction of the payment — determines color and label text */
  side: "purchase" | "sale";
}

export function PaymentSideLabel({ side }: PaymentSideLabelProps) {
  return (
    <p
      className={cn(
        "text-[10px] font-medium uppercase tracking-wide mb-0.5 leading-none",
        side === "purchase" ? "text-amber-700" : "text-primary"
      )}
    >
      {side === "purchase" ? "Purchase" : "Sale"}
    </p>
  );
}

export default PaymentSideLabel;
