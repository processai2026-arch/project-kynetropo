import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { isPhoneApp } from "@/lib/uiSkin";

/**
 * In the phone app (the Sales app on a phone) a dialog opens as a page, as in
 * Diamond Fencing's phone app: the whole screen, the coloured bar on top with
 * a back arrow and the title, and the phone's own Back button closes it.
 * Everywhere else it is the usual centred dialog.
 */
const PageMode = React.createContext<{ setHasHeader: (v: boolean) => void } | null>(null);

/**
 * Opening one pushes a history entry, so the phone's Back closes it instead of leaving the screen.
 *
 * Rendered INSIDE the dialog's content, which exists only while the dialog is open. The
 * DialogContent wrapper itself renders on every page that has a dialog, open or not, so a
 * hook there pushed an entry per closed dialog on arrival and the screen's own Back arrow
 * then only stepped through those.
 */
function BackCloses({ close }: { close: () => void }) {
  const closeRef = React.useRef(close);
  closeRef.current = close;
  React.useEffect(() => {
    const key = `dlg-${Math.random().toString(36).slice(2)}`;
    window.history.pushState({ ...(window.history.state ?? {}), kynDialog: key }, "");
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed from the screen: take back the entry pushed on opening. Left
      // alone when a navigation has already moved on from it.
      if ((window.history.state as { kynDialog?: string } | null)?.kynDialog === key) window.history.back();
    };
  }, []);
  return null;
}

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const page = typeof window !== "undefined" && isPhoneApp(window.location.pathname);
  const [hasHeader, setHasHeader] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const ctx = React.useMemo(() => ({ setHasHeader }), []);

  if (page) {
    return (
      <DialogPortal>
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            className,
            // After the caller's classes, so a dialog's size never shrinks the page.
            "fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-4 overflow-y-auto overscroll-contain rounded-none border-0 bg-background px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-0 shadow-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-8 sm:rounded-none",
          )}
          {...props}
        >
          <BackCloses close={() => closeRef.current?.click()} />
          <PageMode.Provider value={ctx}>{children}</PageMode.Provider>
          <DialogPrimitive.Close ref={closeRef} className={cn(
            "fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 grid h-10 w-10 place-items-center rounded-full bg-muted",
            hasHeader && "hidden",
          )}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const page = React.useContext(PageMode);
  React.useEffect(() => {
    if (!page) return;
    page.setHasHeader(true);
    return () => page.setHasHeader(false);
  }, [page]);
  if (page) {
    // The page's top bar: back arrow, then the title (and any line under it), in white on the brand colour.
    return (
      <div className="sticky top-0 z-20 -mx-4 flex min-h-14 shrink-0 items-center gap-1 bg-primary px-2 pt-[env(safe-area-inset-top)] text-primary-foreground shadow-sm [&_*]:!text-primary-foreground" {...props}>
        <DialogPrimitive.Close aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-white/20">
          <ArrowLeft className="h-6 w-6" />
        </DialogPrimitive.Close>
        <div className={cn("min-w-0 flex-1 py-2 text-left [&_h2]:truncate [&_h2]:!text-lg [&_h2]:!font-semibold [&_p]:text-xs [&_p]:opacity-85", className)}>{children}</div>
      </div>
    );
  }
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props}>{children}</div>;
};
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
