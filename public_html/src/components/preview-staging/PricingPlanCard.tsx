import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PricingPlanCardProps {
  name: string;
  price: number;
  currency: string;
  cycle: "monthly" | "yearly";
  isCurrent?: boolean;
  isBusy?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  moneyFormatter: (amount: number, currency: string) => string;
}

const cycleLabel: Record<"monthly" | "yearly", string> = {
  monthly: "mo",
  yearly: "yr",
};

export function PricingPlanCard({
  name,
  price,
  currency,
  cycle,
  isCurrent = false,
  isBusy = false,
  disabled = false,
  onSelect,
  moneyFormatter,
}: PricingPlanCardProps) {
  const period = cycleLabel[cycle];

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-5",
        isCurrent && "border-primary ring-1 ring-primary/30"
      )}
    >
      <h3 className="font-semibold text-card-foreground">{name}</h3>
      <div className="mt-2 text-2xl font-bold text-card-foreground">
        {moneyFormatter(price, currency)}
        <span className="text-sm font-normal text-muted-foreground">/{period}</span>
      </div>
      <Button
        className="mt-4"
        disabled={isCurrent || isBusy || disabled}
        onClick={onSelect}
      >
        {isCurrent ? (
          "Current plan"
        ) : isBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting…
          </>
        ) : (
          "Subscribe"
        )}
      </Button>
    </div>
  );
}
