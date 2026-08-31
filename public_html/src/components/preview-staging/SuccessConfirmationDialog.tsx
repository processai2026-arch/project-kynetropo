import { CheckCircle, Mail, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface NotificationChannel {
  label: string;
  value: string;
  icon?: LucideIcon;
}

export interface SuccessConfirmationDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityName: string;
  channels: NotificationChannel[];
  icon?: LucideIcon;
}

function SuccessIconCircle({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
      <Icon className="h-8 w-8 text-primary" />
    </div>
  );
}

function IconNotificationRow({ label, value, icon: Icon = Mail }: NotificationChannel) {
  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="text-left">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-card-foreground">{value}</p>
      </div>
    </div>
  );
}

export function SuccessConfirmationDialog({
  open,
  onOpenChange,
  entityName,
  channels,
  icon = CheckCircle,
}: SuccessConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <div className="flex flex-col items-center gap-4 py-4">
          <SuccessIconCircle icon={icon} />
          <DialogHeader className="text-center">
            <DialogTitle>Credentials Sent!</DialogTitle>
            <DialogDescription>
              Sent to{" "}
              <span className="font-semibold text-card-foreground">{entityName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="w-full space-y-2 text-sm">
            {channels.map((c) => (
              <IconNotificationRow key={c.label} {...c} />
            ))}
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full mt-2">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
