import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface AsymmetricTwoColLayoutProps {
  fixedWidth?: string;
  left: ReactNode;
  right: ReactNode;
  gap?: string;
}

export function AsymmetricTwoColLayout({
  fixedWidth = "360px",
  left,
  right,
  gap = "gap-5",
}: AsymmetricTwoColLayoutProps) {
  return (
    <div
      className={cn("grid", gap, "lg:grid-cols-[var(--col-fixed)_1fr]")}
      style={{ "--col-fixed": fixedWidth } as CSSProperties}
    >
      <div className="rounded-md border bg-card">{left}</div>
      <div className="rounded-md border bg-card">{right}</div>
    </div>
  );
}
