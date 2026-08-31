import { cn } from "@/lib/utils";

interface InlineTextContentSectionProps {
  heading: string;
  content: string | null | undefined;
  fallback?: string;
}

export function InlineTextContentSection({
  heading,
  content,
  fallback = "—",
}: InlineTextContentSectionProps) {
  return (
    <section className="space-y-1">
      <h4 className="text-sm font-semibold text-foreground">{heading}</h4>
      <p className={cn("text-sm text-muted-foreground whitespace-pre-wrap")}>
        {content || fallback}
      </p>
    </section>
  );
}
