import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterControlCardProps {
  from: string;
  to: string;
  module: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onModuleChange: (v: string) => void;
  moduleOptions: string[];
  actions?: ReactNode;
  className?: string;
}

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

function Field({ label, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function FilterControlCard({
  from,
  to,
  module,
  onFromChange,
  onToChange,
  onModuleChange,
  moduleOptions,
  actions,
  className,
}: FilterControlCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3 items-end",
        className
      )}
    >
      <Field label="From">
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </Field>

      <Field label="To">
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </Field>

      <Field label="Report module" className="md:col-span-2">
        <Select value={module} onValueChange={onModuleChange}>
          <SelectTrigger>
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All modules</SelectItem>
            {moduleOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {actions != null && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
