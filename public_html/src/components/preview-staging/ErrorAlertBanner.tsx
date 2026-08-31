import { AlertCircle } from "lucide-react";

interface ErrorAlertBannerProps {
  message: string;
}

export function ErrorAlertBanner({ message }: ErrorAlertBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default ErrorAlertBanner;
