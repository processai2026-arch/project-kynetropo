/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * On a phone a message looks like a phone app's: a dark bar at the bottom, one at
 * a time, sitting above the tab bar and the buttons fixed at the bottom of a
 * screen (Android's snackbar), and swiped down to dismiss. It used to drop over
 * the top bar, where it covered the Back arrow. On the desktop: bottom-right cards.
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

  if (narrow) {
    const bottom = "calc(6rem + env(safe-area-inset-bottom))";
    return (
      <Sonner
        theme={theme as ToasterProps["theme"]}
        position="bottom-center"
        offset={{ bottom }}
        // Under 600px wide Sonner reads mobileOffset instead, so both are set.
        mobileOffset={{ bottom, left: 16, right: 16 }}
        visibleToasts={1}
        duration={3000}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              "group toast !items-center !gap-3 !rounded-xl !border-0 !px-4 !py-3.5 !text-[15px] !font-medium !shadow-xl group-[.toaster]:!bg-zinc-900 group-[.toaster]:!text-white dark:group-[.toaster]:!bg-zinc-100 dark:group-[.toaster]:!text-zinc-900",
            description: "group-[.toast]:!text-white/75 dark:group-[.toast]:!text-zinc-600",
            icon: "!m-0",
            success: "[&_[data-icon]]:!text-emerald-400 dark:[&_[data-icon]]:!text-emerald-600",
            error: "[&_[data-icon]]:!text-rose-400 dark:[&_[data-icon]]:!text-rose-600",
            warning: "[&_[data-icon]]:!text-amber-400 dark:[&_[data-icon]]:!text-amber-600",
            actionButton: "group-[.toast]:!bg-transparent group-[.toast]:!font-semibold group-[.toast]:!text-sky-300",
            cancelButton: "group-[.toast]:!bg-transparent group-[.toast]:!text-white/70",
          },
        }}
        {...props}
      />
    );
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
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
