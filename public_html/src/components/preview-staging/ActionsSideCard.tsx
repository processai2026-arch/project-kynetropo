import { type ReactNode } from "react";

interface ActionsSideCardProps {
  /** Heading text rendered at the top of the card */
  title: string;
  /** Action buttons or any content stacked inside the card */
  children: ReactNode;
}

export function ActionsSideCard({ title, children }: ActionsSideCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
      <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default ActionsSideCard;
