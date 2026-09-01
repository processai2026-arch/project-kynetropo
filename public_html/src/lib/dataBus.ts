import { useEffect } from "react";

/**
 * Tells already-mounted pages that data they show has changed.
 *
 * apiFetch clears its GET cache after any write, so the *next* fetch is fresh —
 * but a page that is already open never makes that fetch. Receiving a purchase
 * order updates stock, purchase billing and payables at once; without a signal,
 * a second tab or a page behind a dialog kept showing the old numbers until it
 * was reloaded by hand.
 *
 * Deliberately a plain event, not a store: pages already own their loading via
 * useEffect + load(), and this only has to tell them when to run it again.
 */

/** Areas a write can invalidate. A page subscribes to what it displays. */
export type DataTopic =
  | "inventory"    // stock levels, product rows
  | "purchases"    // GRNs / purchase receipts
  | "payables"     // money owed to suppliers
  | "receivables"  // money owed by customers
  | "invoices"
  | "orders"
  | "customers"
  | "quotations";

const TARGET = "vbs:data-changed";

/** Announce that one or more areas changed. */
export function publishDataChange(...topics: DataTopic[]): void {
  if (typeof window === "undefined") return;
  for (const topic of topics) {
    window.dispatchEvent(new CustomEvent(TARGET, { detail: topic }));
  }
}

/**
 * Re-run `onChange` whenever one of `topics` changes.
 *
 * The handler is read through a ref-like closure on every event, so a page can
 * pass an inline function without the listener being torn down and rebuilt on
 * each render.
 */
export function useDataRefresh(topics: DataTopic[], onChange: () => void): void {
  // Serialised so the effect does not re-subscribe when a caller passes a new
  // array literal with the same contents on every render.
  const key = topics.join(",");
  useEffect(() => {
    const wanted = new Set(key.split(",") as DataTopic[]);
    const handler = (e: Event) => {
      const topic = (e as CustomEvent<DataTopic>).detail;
      if (wanted.has(topic)) onChange();
    };
    window.addEventListener(TARGET, handler);
    return () => window.removeEventListener(TARGET, handler);
    // onChange is intentionally excluded: pages pass an inline arrow, and
    // including it would resubscribe on every render for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
