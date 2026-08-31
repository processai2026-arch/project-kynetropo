import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Zone {
  zone_id: number;
  zone_name: string;
  zone_code: string;
  zone_type: string;
  total_quantity: number;
  stock_value: number;
}

interface NestedZoneTableProps {
  zones: Zone[];
  currencySymbol?: string;
  emptyMessage?: string;
}

const zoneTypeStyles: Record<string, string> = {
  storage:      "bg-blue-50 text-blue-600 border-blue-200",
  refrigerated: "bg-cyan-50 text-cyan-600 border-cyan-200",
  hazardous:    "bg-red-50 text-red-600 border-red-200",
  staging:      "bg-amber-50 text-amber-600 border-amber-200",
  transit:      "bg-purple-50 text-purple-600 border-purple-200",
};

export function NestedZoneTable({
  zones,
  currencySymbol = "₹",
  emptyMessage = "No zones found",
}: NestedZoneTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider">
              Zone
            </th>
            <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider">
              Type
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium uppercase tracking-wider">
              Qty
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium uppercase tracking-wider">
              Stock Value
            </th>
          </tr>
        </thead>
        <tbody>
          {zones.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-4 text-center text-muted-foreground text-xs"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            zones.map((z) => (
              <tr
                key={z.zone_id}
                className="border-t hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-card-foreground">
                    {z.zone_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {z.zone_code}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    className={cn(
                      "border capitalize text-xs",
                      zoneTypeStyles[z.zone_type.toLowerCase()] ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {z.zone_type.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-card-foreground">
                  {z.total_quantity.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-card-foreground">
                  {currencySymbol}
                  {z.stock_value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
