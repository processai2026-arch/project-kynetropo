import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreditConditionalRowProps {
  isCredit: boolean;
  creditDays: string;
  onToggle: (checked: boolean) => void;
  onDaysChange: (days: string) => void;
}

export function CreditConditionalRow({
  isCredit,
  creditDays,
  onToggle,
  onDaysChange,
}: CreditConditionalRowProps) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          id="is_credit"
          checked={isCredit}
          onChange={e => onToggle(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="is_credit" className="cursor-pointer">
          Credit Purchase
        </Label>
      </div>
      {isCredit && (
        <div className="flex-1 space-y-1.5">
          <Label>Credit Days</Label>
          <Input
            type="number"
            value={creditDays}
            onChange={e => onDaysChange(e.target.value)}
            placeholder="30"
          />
        </div>
      )}
    </div>
  );
}
