import { cn } from "@/lib/utils";

export interface LineItem {
  product_name: string;
  sku?: string;
  qty?: number;
  quantity?: number;
  taxable_value?: number;
  igst_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  total_amount?: number;
  total?: number;
}

interface DetailLineItemsSubTableProps {
  lines: LineItem[];
  className?: string;
}

const HEADERS = ["Product", "SKU", "Qty", "Taxable", "IGST", "CGST", "SGST", "Total"] as const;

export function DetailLineItemsSubTable({ lines, className }: DetailLineItemsSubTableProps) {
  if (!lines || lines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No line items.</p>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            {HEADERS.map((h) => (
              <th
                key={h}
                className="text-left py-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
              <td className="py-2 px-2 font-medium text-card-foreground">{l.product_name}</td>
              <td className="py-2 px-2 font-mono text-muted-foreground">{l.sku || "—"}</td>
              <td className="py-2 px-2 text-card-foreground">{l.qty ?? l.quantity ?? 0}</td>
              <td className="py-2 px-2 text-card-foreground">
                ₹{(l.taxable_value || 0).toLocaleString("en-IN")}
              </td>
              <td className="py-2 px-2 text-blue-600">
                ₹{(l.igst_amount || 0).toLocaleString("en-IN")}
              </td>
              <td className="py-2 px-2 text-orange-600">
                ₹{(l.cgst_amount || 0).toLocaleString("en-IN")}
              </td>
              <td className="py-2 px-2 text-orange-600">
                ₹{(l.sgst_amount || 0).toLocaleString("en-IN")}
              </td>
              <td className="py-2 px-2 font-semibold text-card-foreground">
                ₹{(l.total_amount ?? l.total ?? 0).toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
