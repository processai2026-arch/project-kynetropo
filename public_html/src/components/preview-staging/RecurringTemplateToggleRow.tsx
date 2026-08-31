import { Button } from "@/components/ui/button";
import type { RecurringInvoiceTemplate } from "@/lib/api/invoices";

export interface RecurringTemplateToggleRowProps {
  template: RecurringInvoiceTemplate;
  onToggle: (template: RecurringInvoiceTemplate) => void;
}

export function RecurringTemplateToggleRow({
  template,
  onToggle,
}: RecurringTemplateToggleRowProps) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-medium">{template.template_name}</td>
      <td className="px-3 py-2">{template.customer_name}</td>
      <td className="px-3 py-2 capitalize">{template.frequency}</td>
      <td className="px-3 py-2">{template.next_run_date}</td>
      <td className="px-3 py-2">{template.generated_count ?? 0}</td>
      <td className="px-3 py-2 text-right">
        <Button
          size="sm"
          variant={template.active ? "outline" : "secondary"}
          onClick={() => onToggle(template)}
        >
          {template.active ? "Active" : "Paused"}
        </Button>
      </td>
    </tr>
  );
}
