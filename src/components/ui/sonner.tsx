/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * On a phone the bottom of the screen belongs to the tab bar and the quick-add
 * button, so a toast landing there is half-covered and easy to miss. Toasts go
 * to the top on narrow screens and stay bottom-right on the desktop.
 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    setNarrow(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const narrow = useIsNarrow();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={narrow ? "top-center" : "bottom-right"}
      // Below the phone app's top bar (3.5rem), clear of the status bar when installed to a
      // home screen: over the bar a toast sat on the Back arrow, and a tap meant for Back
      // landed on the toast instead.
      // (Under 600px wide Sonner reads mobileOffset instead, so both are set.)
      offset={narrow ? "calc(4.25rem + env(safe-area-inset-top))" : undefined}
      mobileOffset={narrow ? { top: "calc(4.25rem + env(safe-area-inset-top))", left: 16, right: 16 } : undefined}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
