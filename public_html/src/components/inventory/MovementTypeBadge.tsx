import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  STOCK_IN:          { label: "Stock In",          bg: "bg-emerald-100", text: "text-emerald-700" },
  STOCK_OUT:         { label: "Stock Out",          bg: "bg-red-100",     text: "text-red-700"     },
  TRANSFER:          { label: "Transfer",           bg: "bg-blue-100",    text: "text-blue-700"    },
  ADJUSTMENT:        { label: "Adjustment",         bg: "bg-amber-100",   text: "text-amber-700"   },
  EMPLOYEE_ISSUE:    { label: "Employee Issue",     bg: "bg-purple-100",  text: "text-purple-700"  },
  DEALER_ALLOCATION: { label: "Dealer Allocation",  bg: "bg-indigo-100",  text: "text-indigo-700"  },
  PRODUCTION_USE:    { label: "Production Use",     bg: "bg-cyan-100",    text: "text-cyan-700"    },
  DAMAGE:            { label: "Damage",             bg: "bg-rose-100",    text: "text-rose-700"    },
  EMERGENCY_USE:     { label: "Emergency Use",      bg: "bg-orange-100",  text: "text-orange-700"  },
  RETURN:            { label: "Return",             bg: "bg-lime-100",    text: "text-lime-700"    },
};

export function MovementTypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLES[type] ?? { label: type, bg: "bg-muted", text: "text-muted-foreground" };
  return (
    <Badge className={cn("border-transparent", s.bg, s.text)}>
      {s.label}
    </Badge>
  );
}
