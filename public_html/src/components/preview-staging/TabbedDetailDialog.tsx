import { type ReactNode } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TabbedDetailTab {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabbedDetailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  tabs: TabbedDetailTab[];
  defaultTab?: string;
}

const tabGridClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function TabbedDetailDialog({
  open,
  onOpenChange,
  title,
  description,
  tabs,
  defaultTab,
}: TabbedDetailDialogProps) {
  const resolvedDefault = defaultTab ?? tabs[0]?.value;
  const colClass = tabGridClass[Math.min(tabs.length, 4)] ?? "grid-cols-4";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <Tabs defaultValue={resolvedDefault} className="w-full">
          <TabsList className={cn("grid w-full", colClass)}>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <div className="max-h-80 overflow-y-auto bg-muted/30 rounded-lg p-4 space-y-2.5 text-sm">
                {t.content}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
