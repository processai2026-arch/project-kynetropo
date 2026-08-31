import { cn } from "@/lib/utils";

interface EntityTypeHeaderProps {
  type: "Customer" | "Dealer";
}

export function EntityTypeHeader({ type }: EntityTypeHeaderProps) {
  const isDealer = type === "Dealer";

  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
        <svg
          className={cn("h-4 w-4", isDealer ? "text-indigo-400" : "text-primary")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {isDealer ? (
            <>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </>
          ) : (
            <>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </>
          )}
        </svg>
        {isDealer ? "Dealer Details" : "Customer Details"}
      </span>
      <span
        className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-medium",
          isDealer
            ? "bg-indigo-500/15 text-indigo-400"
            : "bg-primary/10 text-primary"
        )}
      >
        {type}
      </span>
    </div>
  );
}
