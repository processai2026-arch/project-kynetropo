import { cn } from "@/lib/utils";

interface PrintDocumentFooterProps {
  /** Disclaimer text. Defaults to the standard "computer-generated document" notice. */
  message?: string;
  /** Extra Tailwind classes merged via cn() for layout overrides. */
  className?: string;
}

export function PrintDocumentFooter({ message, className }: PrintDocumentFooterProps) {
  return (
    <div
      className={cn(
        "mt-8 pt-4 border-t text-xs text-muted-foreground text-center",
        className
      )}
    >
      {message ?? "This is a computer-generated document. No signature required."}
    </div>
  );
}

export default PrintDocumentFooter;
