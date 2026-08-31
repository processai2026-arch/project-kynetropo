import { Download, ExternalLink, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, safeHref } from "@/lib/utils";
import type { Document } from "@/types/document";

// ── Category badge styles ────────────────────────────────────────────────────

const categoryStyles: Record<string, string> = {
  property_doc: "bg-blue-50 text-blue-700 border-blue-200",
  owner_doc:    "bg-purple-50 text-purple-700 border-purple-200",
  buyer_doc:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  agreement:    "bg-amber-50 text-amber-700 border-amber-200",
  quotation:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  receipt:      "bg-cyan-50 text-cyan-700 border-cyan-200",
  legal:        "bg-red-50 text-red-700 border-red-200",
  photo:        "bg-pink-50 text-pink-700 border-pink-200",
  other:        "bg-gray-100 text-gray-600 border-gray-200",
};

// ── Entity type badge styles ─────────────────────────────────────────────────

const entityTypeStyles: Record<string, string> = {
  property:   "bg-sky-50 text-sky-700 border-sky-200",
  land_owner: "bg-violet-50 text-violet-700 border-violet-200",
  buyer:      "bg-teal-50 text-teal-700 border-teal-200",
  lead:       "bg-orange-50 text-orange-700 border-orange-200",
  payment:    "bg-cyan-50 text-cyan-700 border-cyan-200",
  general:    "bg-gray-100 text-gray-600 border-gray-200",
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface DocRowProps {
  /** The document record to render. */
  doc: Document;
  /**
   * When true the doc code and title cells are indented (pl-7) to visually
   * nest the row inside an expanded folder group.
   */
  indent?: boolean;
  /**
   * Controls whether the "Linked To" column renders the entity badge + name.
   * Pass false inside an expanded group where the folder header already names
   * the entity — avoids repeating the same information on every child row.
   * Defaults to true.
   */
  showLinkedTo?: boolean;
  /**
   * When true the WhatsApp button is styled as active and triggers onSend.
   * When false the button is dimmed and shows a "not configured" toast instead.
   */
  whatsappEnabled: boolean;
  /** Called when the row itself is clicked (open detail panel). */
  onSelect: () => void;
  /** Called when the WhatsApp send icon is clicked and WhatsApp is enabled. */
  onSend: () => void;
  /** Called when the delete icon is clicked. */
  onDelete: () => void;
  /** Called when the preview/download icon is clicked (file documents only). */
  onPreview: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DocRow({
  doc,
  indent = false,
  showLinkedTo = true,
  whatsappEnabled,
  onSelect,
  onSend,
  onDelete,
  onPreview,
}: DocRowProps) {
  // A "link" document has an external URL and no stored file path.
  const isLink = !!doc.external_url && !doc.file_path;

  const handleWhatsApp = () => {
    if (whatsappEnabled) {
      onSend();
    } else {
      toast.info("Configure WhatsApp API key in Settings to enable sharing");
    }
  };

  return (
    <tr
      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      {/* Doc code */}
      <td className="py-3 px-4 text-card-foreground font-mono text-xs whitespace-nowrap">
        <span className={indent ? "pl-7 inline-block" : undefined}>
          {doc.doc_code}
        </span>
      </td>

      {/* Title + filename/size */}
      <td className="py-3 px-4">
        <div className="min-w-0 max-w-[260px]">
          <p className="text-card-foreground truncate font-medium">{doc.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {isLink
              ? "External link"
              : doc.file_name
                ? `${doc.file_name}${doc.file_size_kb ? ` · ${doc.file_size_kb} KB` : ""}`
                : "—"}
          </p>
        </div>
      </td>

      {/* Category badge */}
      <td className="py-3 px-4">
        <Badge
          className={cn(
            "border capitalize",
            categoryStyles[doc.category] ?? "bg-muted text-muted-foreground",
          )}
        >
          {doc.category.replace(/_/g, " ")}
        </Badge>
      </td>

      {/* Linked entity */}
      <td className="py-3 px-4">
        {!showLinkedTo ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : doc.entity_id ? (
          <div className="min-w-0 max-w-[200px]">
            <Badge
              className={cn(
                "border capitalize",
                entityTypeStyles[doc.entity_type] ?? "bg-muted text-muted-foreground",
              )}
            >
              {doc.entity_type.replace(/_/g, " ")}
            </Badge>
            {(doc.entity_name || doc.entity_code) && (
              <p className="text-xs text-muted-foreground truncate mt-1">
                {doc.entity_name ?? ""}
                {doc.entity_code && doc.entity_code !== doc.entity_name && (
                  <span className="font-mono"> {doc.entity_code}</span>
                )}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Upload date + uploader */}
      <td className="py-3 px-4 whitespace-nowrap">
        <p className="text-card-foreground text-sm">
          {doc.uploaded_at
            ? new Date(doc.uploaded_at).toLocaleDateString()
            : "—"}
        </p>
        {doc.uploaded_by_name && (
          <p className="text-xs text-muted-foreground">{doc.uploaded_by_name}</p>
        )}
      </td>

      {/* File actions — stopPropagation so row click does not fire */}
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {isLink ? (
            <Button variant="ghost" size="icon" asChild title="Open link">
              <a href={safeHref(doc.external_url)} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : doc.file_path ? (
            <Button
              variant="ghost"
              size="icon"
              title="Preview / Download"
              onClick={onPreview}
            >
              <Download className="h-4 w-4" />
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleWhatsApp}
            className={
              whatsappEnabled
                ? "text-green-600 hover:text-green-700"
                : "text-muted-foreground opacity-50"
            }
            title={
              whatsappEnabled
                ? "Send via WhatsApp"
                : "WhatsApp not configured — add API key in Settings"
            }
          >
            <MessageCircle className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default DocRow;
