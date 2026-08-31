import React from "react";

interface ReceiptPrintHeaderProps {
  /** Company or brand name rendered as the main heading. */
  brandName: string;
  /** Document category shown as a subtitle (e.g. "Payment Receipt", "Tax Invoice"). */
  documentType: string;
}

export function ReceiptPrintHeader({ brandName, documentType }: ReceiptPrintHeaderProps) {
  return (
    <div className="mb-6 pb-4 border-b border-border">
      <h1 className="text-xl font-bold text-foreground">{brandName}</h1>
      <p className="text-xs text-muted-foreground mt-0.5">{documentType}</p>
    </div>
  );
}

export default ReceiptPrintHeader;
