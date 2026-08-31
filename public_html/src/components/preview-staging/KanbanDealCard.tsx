import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ApiDeal, DealStage } from "@/lib/api/crm";

const DEAL_STAGES: DealStage[] = ["qualification", "proposal", "negotiation", "won", "lost"];

const STAGE_LABEL: Record<DealStage, string> = {
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export interface KanbanDealCardProps {
  deal_id: number;
  title: string;
  customer_name?: string;
  value: number;
  probability: number;
  expected_close_date?: string;
  stage: DealStage;
  onEdit: (deal: ApiDeal) => void;
  onDelete: (id: number) => void;
  onStageChange: (id: number, stage: DealStage) => void;
}

export function KanbanDealCard({
  deal_id,
  title,
  customer_name,
  value,
  probability,
  expected_close_date,
  stage,
  onEdit,
  onDelete,
  onStageChange,
}: KanbanDealCardProps) {
  const dealSnapshot: ApiDeal = {
    deal_id,
    title,
    customer_name: customer_name ?? null,
    value,
    probability,
    expected_close_date: expected_close_date ?? null,
    stage,
    customer_id: null,
    lead_id: null,
    currency: "INR",
    owner_id: null,
    notes: null,
    closed_at: null,
    created_at: "",
    updated_at: null,
  };

  return (
    <div className={cn("rounded-lg border bg-background p-3 space-y-2")}>
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-sm font-medium leading-tight cursor-pointer"
          onClick={() => onEdit(dealSnapshot)}
        >
          {title}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0"
          onClick={() => onDelete(deal_id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {customer_name && (
        <p className="text-xs text-muted-foreground">{customer_name}</p>
      )}

      <p className="text-sm font-semibold text-primary">{inr(value)}</p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{probability}%</span>
        {expected_close_date && (
          <span className="text-xs text-muted-foreground">{expected_close_date}</span>
        )}
      </div>

      <Select
        value={stage}
        onValueChange={(v) => onStageChange(deal_id, v as DealStage)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEAL_STAGES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              Move to {STAGE_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
