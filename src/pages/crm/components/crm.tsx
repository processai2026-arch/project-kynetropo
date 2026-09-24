import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** A client's journey, in order (AdminOpsClientController::STAGES). */
export const CLIENT_STAGES = [
  "First Meetup", "Onboarding", "Requirements", "Scope Freeze",
  "Advance Paid", "Development", "QA", "Delivery", "Full Payment", "Closed",
] as const;

/** A project's journey, in order. */
export const PROJECT_STAGES = [
  "Lead", "Onboarding", "Requirements", "Scope Freeze", "Development",
  "Internal QA", "Client UAT", "Bug Fixing", "Delivered", "Closed",
] as const;

export const HEALTH_OPTIONS = [
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
];

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const HEALTH_STYLES: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-600 border-amber-200",
  red: "bg-red-50 text-red-600 border-red-200",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gray-100 text-gray-500 border-gray-200",
  medium: "bg-blue-50 text-blue-600 border-blue-200",
  high: "bg-amber-50 text-amber-600 border-amber-200",
  critical: "bg-red-50 text-red-600 border-red-200",
};

export function HealthBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <Badge className={cn("border capitalize", HEALTH_STYLES[value] ?? "bg-muted text-muted-foreground")}>{value}</Badge>;
}

export function PriorityBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <Badge className={cn("border capitalize", PRIORITY_STYLES[value] ?? "bg-muted text-muted-foreground")}>{value}</Badge>;
}

/** A Client ID / Project ID as a list shows it. */
export function CodeText({ code }: { code: string | null | undefined }) {
  return <span className="font-mono text-sm whitespace-nowrap">{code || "—"}</span>;
}

/** ₹ with Indian grouping and no paise — how the CRM writes amounts. */
export const rupees = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === "" ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
