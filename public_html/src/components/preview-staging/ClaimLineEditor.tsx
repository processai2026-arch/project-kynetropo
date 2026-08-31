import { useRef } from "react";
import { AlertTriangle, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { cn } from "@/lib/utils";

export interface ClaimLineForm {
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  receiptUrl?: string;
  receiptName?: string;
}

export interface ClaimLineEditorProps {
  index: number;
  line: ClaimLineForm;
  isOnly: boolean;
  hasWarning: boolean;
  categoryTotal: number;
  policyLimit: number;
  onUpdate: (patch: Partial<ClaimLineForm>) => void;
  onRemove: () => void;
  onAttachReceipt: (file?: File) => void;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function ClaimLineEditor({
  index,
  line,
  isOnly,
  hasWarning,
  categoryTotal,
  policyLimit,
  onUpdate,
  onRemove,
  onAttachReceipt,
}: ClaimLineEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-card-foreground">Expense line {index + 1}</h3>
        {!isOnly && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Remove line"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input
            type="date"
            value={line.expenseDate}
            onChange={(e) => onUpdate({ expenseDate: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <CreatableCombobox
            optionsKey="general_expense_category"
            value={line.category ?? ""}
            onChange={(value) => onUpdate({ category: value })}
            placeholder="Select category…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Amount (₹)</Label>
          <Input
            type="number"
            min="1"
            value={line.amount}
            onChange={(e) => onUpdate({ amount: e.target.value.replace(/^0+(?=\d)/, "") })}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Receipt</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => onAttachReceipt(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 font-normal",
              line.receiptName ? "text-foreground" : "text-muted-foreground",
            )}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {line.receiptName ?? "Attach file…"}
            </span>
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          value={line.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="What was purchased and why?"
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {line.receiptName ? `Attached: ${line.receiptName}` : "No receipt attached"}
        </span>
        {hasWarning && (
          <span className="text-amber-700 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Category total {inr(categoryTotal)} exceeds {inr(policyLimit)}
          </span>
        )}
      </div>
    </div>
  );
}
