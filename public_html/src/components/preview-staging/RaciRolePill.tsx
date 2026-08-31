import { cn } from "@/lib/utils";

type RaciRole = "R" | "A" | "C" | "I" | "-";

interface RaciRolePillProps {
  role: RaciRole;
  colorClass?: string;
}

export function RaciRolePill({ role, colorClass = "" }: RaciRolePillProps) {
  return (
    <span
      className={cn(
        "inline-block w-7 h-7 leading-7 rounded-full text-[11px] font-bold text-center",
        colorClass
      )}
    >
      {role === "-" ? "" : role}
    </span>
  );
}
