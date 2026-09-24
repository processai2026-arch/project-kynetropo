import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FormPage, type FormPageProps } from "@/components/FormPage";
import { cn } from "@/lib/utils";
import "@/styles/record-form.css";

/**
 * A create/edit page in mpTV-erp's Operator-form style: back link, an icon
 * tile beside the title, then the form as separate section cards (each with an
 * icon, title and one-line purpose) and an optional side column.
 */
export function RecordFormPage({
  icon: Icon,
  children,
  ...props
}: Omit<FormPageProps, "headerIcon" | "embedded" | "className"> & { icon: LucideIcon }) {
  return (
    <div className="record-form">
      <FormPage
        {...props}
        bare
        headerIcon={<span data-form-page-icon="" aria-hidden="true"><Icon className="h-6 w-6" /></span>}
      >
        {children}
      </FormPage>
    </div>
  );
}

/** Main column plus a narrower side column; stacks under 72rem. */
export function FormLayout({ main, side }: { main: ReactNode; side?: ReactNode }) {
  return (
    <div data-form-layout="" data-has-side={side ? "" : undefined}>
      <div data-form-main="">{main}</div>
      {side && <div data-form-side="">{side}</div>}
    </div>
  );
}

export type FormTone = "blue" | "violet" | "indigo" | "cyan" | "green" | "amber";

/** One card of a form: icon tile, title, what the section is for, then fields. */
export function FormSectionCard({
  icon: Icon,
  tone = "blue",
  title,
  description,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: FormTone;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-form-section="" className={cn("space-y-4", className)}>
      <div data-form-section-heading="">
        <span data-form-section-icon={tone} aria-hidden="true"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** A leading icon inside a text input. */
export function IconInput({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div data-input-icon="">
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </div>
  );
}

export default RecordFormPage;
