import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PasswordInputWithGenerateProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function PasswordInputWithGenerate({
  value,
  onChange,
  onGenerate,
  id,
  disabled = false,
  placeholder = "Enter password",
  className,
}: PasswordInputWithGenerateProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        onClick={onGenerate}
        disabled={disabled}
        className="shrink-0"
      >
        <RefreshCw className="h-4 w-4" />
        Generate
      </Button>
    </div>
  );
}
