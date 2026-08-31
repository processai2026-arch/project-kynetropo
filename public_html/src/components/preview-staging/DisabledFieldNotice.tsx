import { Label } from "@/components/ui/label";

interface DisabledFieldNoticeProps {
  /** The field label displayed above the notice box */
  label: string;
  /** The explanatory message shown inside the muted bordered box */
  message: string;
}

export function DisabledFieldNotice({ label, message }: DisabledFieldNoticeProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2 leading-relaxed">
        {message}
      </p>
    </div>
  );
}

export default DisabledFieldNotice;
