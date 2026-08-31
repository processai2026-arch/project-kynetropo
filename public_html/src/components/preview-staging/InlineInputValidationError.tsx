import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineInputValidationErrorProps {
  label: string;
  value: string;
  isInvalid?: boolean;
  errorMessage?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export function InlineInputValidationError({
  label,
  value,
  isInvalid = false,
  errorMessage = "",
  inputProps = {},
}: InlineInputValidationErrorProps) {
  const { className: inputClassName, ...restInputProps } = inputProps;

  return (
    <div>
      <label className="text-sm font-medium text-card-foreground">{label}</label>
      <Input
        {...restInputProps}
        value={value}
        className={cn("mt-1", isInvalid && "border-destructive", inputClassName)}
      />
      {isInvalid && (
        <p className="text-xs text-destructive mt-1">{errorMessage}</p>
      )}
    </div>
  );
}
