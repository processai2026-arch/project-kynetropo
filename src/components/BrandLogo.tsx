import { useState } from "react";
import { BRAND } from "@/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  fallbackClassName?: string;
};

export function BrandLogo({ className, fallbackClassName }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className={cn("font-bold tracking-tight text-foreground", fallbackClassName)}>{BRAND.name}</span>;
  }

  return (
    <img
      src="/kynetropo-logo.png"
      alt={BRAND.name}
      className={cn("h-8 w-auto object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}
