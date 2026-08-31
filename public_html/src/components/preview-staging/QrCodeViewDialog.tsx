import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrImage } from "@/components/QrImage";

export interface QrCodeRecord {
  name: string;
  id: string;
  designation?: string;
  qrToken: string;
}

interface QrCodeViewDialogProps {
  record: QrCodeRecord | null;
  onClose: () => void;
  onDownloadFront: (record: QrCodeRecord) => void;
  onDownloadBack: (record: QrCodeRecord) => void;
  onDownloadBoth: (record: QrCodeRecord) => void;
  caption?: string;
}

const DEFAULT_CAPTION =
  "Print and give to the employee. They scan it at the QR kiosk for check-in/out.";

export function QrCodeViewDialog({
  record,
  onClose,
  onDownloadFront,
  onDownloadBack,
  onDownloadBoth,
  caption = DEFAULT_CAPTION,
}: QrCodeViewDialogProps) {
  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {record && (
          <>
            <DialogHeader>
              <DialogTitle>{record.name}</DialogTitle>
              <DialogDescription>
                {record.id}
                {record.designation ? ` - ${record.designation}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="bg-white p-4 rounded-lg border inline-block">
                <QrImage value={record.qrToken} size={200} />
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {record.qrToken}
              </code>
              <p className="text-xs text-muted-foreground text-center">{caption}</p>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => onDownloadFront(record)}
                className="gap-1"
              >
                <Download className="h-4 w-4" /> Front
              </Button>
              <Button
                variant="outline"
                onClick={() => onDownloadBack(record)}
                className="gap-1"
              >
                <Download className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => onDownloadBoth(record)} className="gap-1">
                <Download className="h-4 w-4" /> Both
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
