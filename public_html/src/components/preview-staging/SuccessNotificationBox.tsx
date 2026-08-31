import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessNotificationBoxProps {
  message: string;
  className?: string;
}

export function SuccessNotificationBox({ message, className }: SuccessNotificationBoxProps) {
  return (
    <div
      className={cn(
        "bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3",
        className
      )}
    >
      <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
      <p className="text-sm font-semibold text-emerald-800">{message}</p>
    </div>
  );
}

export default SuccessNotificationBox;
