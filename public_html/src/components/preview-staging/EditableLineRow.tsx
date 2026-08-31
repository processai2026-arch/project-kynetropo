import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export interface JournalLineDraft {
  account_id: number;
  description: string;
  debit: string;
  credit: string;
}

export interface AccountOption {
  account_id: number;
  code: string;
  name: string;
}

export interface EditableLineRowProps {
  line: JournalLineDraft;
  index: number;
  activeAccounts: AccountOption[];
  totalLines: number;
  minLines?: number;
  onUpdate: (index: number, patch: Partial<JournalLineDraft>) => void;
  onRemove: (index: number) => void;
}

export function EditableLineRow({
  line,
  index,
  activeAccounts,
  totalLines,
  minLines = 2,
  onUpdate,
  onRemove,
}: EditableLineRowProps) {
  const handleDebitChange = (value: string) => {
    onUpdate(index, value !== "" ? { debit: value, credit: "" } : { debit: "" });
  };

  const handleCreditChange = (value: string) => {
    onUpdate(index, value !== "" ? { credit: value, debit: "" } : { credit: "" });
  };

  return (
    <tr className="border-t">
      <td className="px-2 py-2">
        <Select
          value={line.account_id ? String(line.account_id) : ""}
          onValueChange={(v) => onUpdate(index, { account_id: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {activeAccounts.map((a) => (
              <SelectItem key={a.account_id} value={String(a.account_id)}>
                {a.code} · {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-2">
        <Input
          value={line.description}
          onChange={(e) => onUpdate(index, { description: e.target.value })}
          placeholder="Description"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          className={cn("text-right", line.debit !== "" && "font-medium")}
          type="number"
          min="0"
          step="0.01"
          value={line.debit}
          onChange={(e) => handleDebitChange(e.target.value)}
          placeholder="0.00"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          className={cn("text-right", line.credit !== "" && "font-medium")}
          type="number"
          min="0"
          step="0.01"
          value={line.credit}
          onChange={(e) => handleCreditChange(e.target.value)}
          placeholder="0.00"
        />
      </td>
      <td className="px-2 py-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={totalLines <= minLines}
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
